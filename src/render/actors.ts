/**
 * OWNER: render-figures agent. Figures for the sim's actors: the ruler, the
 * delegates, applicants, petitioners and visitors.
 *
 * The sim says where each one is and what they are about; this layer makes it
 * look like someone doing it. Position follows the sim smoothly, heading comes
 * from movement, and the animation from the actor's state and the kind of job:
 * a hammer for building and mending, a purse held high after a collection, a
 * pointing mitten when showing a vacancy, a knock and a shaken fist for an
 * eviction. Petitioners kept waiting shift their weight and look at the ruler.
 * Idle delegates keep busy in character. At night, whoever is idle nods off.
 */
import * as THREE from 'three';
import type { RenderCtx, Env, FigureSpec } from './api';
import type { GameState, SimEvent, Id, Actor, Job, StaffRole } from '../sim/types';
import { NPCS, type AnimId, type EmoteId, type NpcId } from '../data/ids';
import type { FigureLayer, LayerHelpers } from './townlife';
import { createLivingFigure, defaultProp, type LivingFigure, type PropId } from './figures';
import { HALF_W, HALF_H } from './figures/nav';
import { pickFigure, popScale } from './figures/crowd';
import { Rng, clamp, damp, hashStr } from './figures/util';

interface Puppet {
  id: Id; a: Actor | null; fig: LivingFigure; key: string; rng: Rng;
  role: StaffRole | 'ruler' | null; npc: NpcId | null; baseProp: PropId; prop: PropId;
  x: number; y: number; heading: number; speed: number; pop: number; stamp: number;
  /** a turn of feeling that overrides everything for a moment */
  forced: AnimId | null; forcedT: number;
  /** seconds spent in the current sim state (game-paced) */
  stateT: number; lastState: string; lastJob: Id | null;
  carryT: number; idleT: number; fidget: AnimId | null; asked: boolean; selected: boolean;
}

const NPC_SET: ReadonlySet<string> = new Set<string>(NPCS);
/** what a visitor does with their hands while they wait to be heard */
const NPC_WAIT: Partial<Record<NpcId, AnimId>> = {
  crown_herald: 'talk', royal_assessor: 'read', tax_collector: 'count', moneylender: 'count', bishop: 'pray', guild_inspector: 'read',
  travelling_wizard: 'read', goblin_chief: 'count', commons_warden: 'read', dragon_adjuster: 'read', reeves_court_judge: 'read',
};
const JOB_PROP: Partial<Record<Job['kind'], PropId>> = {
  build: 'hammer', repair: 'hammer', renovate: 'hammer', demolish: 'hammer', clear_land: 'shovel', serve_notice: 'scroll', evict: 'keys', inspect: 'ledger', screen: 'scroll',
};

export function createActorLayer(ctx: RenderCtx, h: LayerHelpers): FigureLayer {
  const root = new THREE.Group(); root.name = 'actors';
  ctx.scene.add(root);
  const puppets: Puppet[] = [];
  const byId = new Map<Id, Puppet>();
  const _pos = new THREE.Vector3();
  let state: GameState | null = null;
  let stamp = 0, selectedId: Id | null = null, disposed = false, fresh = true, vacancy = false, vacancyT = 0;
  let ruler: Puppet | null = null;
  void h;

  // ───────────── who is this ─────────────

  function specOf(a: Actor, s: GameState): FigureSpec {
    if (a.kind === 'ruler') return { species: 'human', role: 'ruler', rank: s.realm.rank, seed: (hashStr(s.realm.ruler || 'ruler') ^ (s.realm.crest | 0)) | 0 };
    const ref = a.refId;
    if (ref) {
      const m = s.staff[ref];
      if (m) return { species: m.species, role: m.role, seed: m.portraitSeed };
      const ap = s.applicants[ref];
      if (ap) return { species: ap.household.species, trade: ap.household.trade, seed: ap.household.portraitSeed };
      const t = s.tenants[ref];
      if (t) return { species: t.species, trade: t.trade, seed: t.portraitSeed };
      if (NPC_SET.has(ref)) return { species: 'human', npc: ref as NpcId, seed: hashStr(ref) | 0 };
    }
    return { species: 'human', seed: hashStr(a.id) | 0 };
  }
  function keyOf(a: Actor, s: GameState): string {
    return a.kind === 'ruler' ? 'ruler:' + s.realm.rank + ':' + s.realm.ruler : a.kind + ':' + (a.refId ?? '');
  }

  function dress(p: Puppet, a: Actor, s: GameState): void {
    const spec = specOf(a, s);
    const was = p.fig as LivingFigure | undefined;
    const fig = createLivingFigure(spec, ctx);
    if (was) { fig.setHeading(was.heading(), true); was.dispose(); }
    p.fig = fig; p.key = keyOf(a, s);
    p.role = spec.role ?? null; p.npc = spec.npc ?? null;
    p.baseProp = a.kind === 'applicant' ? 'sack' : defaultProp(spec);
    if (spec.role === 'ruler' && (spec.rank === 'king')) p.baseProp = 'sceptre';
    p.prop = p.baseProp; fig.setProp(p.prop);
    fig.group.position.set(p.x - HALF_W, 0, p.y - HALF_H);
    fig.setSelected(p.selected);
    root.add(fig.group);
  }

  function make(a: Actor, s: GameState): Puppet {
    const p: Puppet = {
      id: a.id, a, fig: null as unknown as LivingFigure, key: '', rng: new Rng(hashStr(a.id) | 0),
      role: null, npc: null, baseProp: 'none', prop: 'none',
      x: a.x, y: a.y, heading: a.facing, speed: 0, pop: fresh ? 1 : 0, stamp,
      forced: null, forcedT: 0, stateT: 0, lastState: a.state, lastJob: a.jobId,
      carryT: 0, idleT: 2 + (hashStr(a.id) % 40) / 10, fidget: null, asked: false, selected: a.id === selectedId,
    };
    dress(p, a, s);
    p.fig.setHeading(p.heading, true);
    puppets.push(p); byId.set(a.id, p);
    if (a.kind === 'ruler') ruler = p;
    return p;
  }

  function drop(p: Puppet): void {
    p.fig.dispose();
    const i = puppets.indexOf(p);
    if (i >= 0) puppets.splice(i, 1);
    if (byId.get(p.id) === p) byId.delete(p.id);
    if (ruler === p) ruler = null;
  }

  function reconcile(s: GameState): void {
    stamp++;
    for (const id in s.actors) {
      const a = s.actors[id]!;
      let p = byId.get(id);
      if (!p) p = make(a, s);
      else {
        p.a = a;
        // a new rank, or a different person behind the same actor: new clothes
        if (p.key !== keyOf(a, s)) { dress(p, a, s); p.fig.react('hop'); }
      }
      p.stamp = stamp;
    }
    for (let i = puppets.length - 1; i >= 0; i--) { const p = puppets[i]!; if (p.stamp !== stamp) p.a = null; }
  }

  // ───────────── what are they doing ─────────────

  function force(p: Puppet, anim: AnimId, dur: number): void { p.forced = anim; p.forcedT = dur; }

  function setProp(p: Puppet, prop: PropId): void { if (p.prop !== prop) { p.prop = prop; p.fig.setProp(prop); } }

  /** the animation for someone at work on a job, by how long they have been at it */
  function workAnim(p: Puppet, j: Job, s: GameState): AnimId {
    const t = p.stateT;
    switch (j.kind) {
      case 'build': case 'repair': case 'renovate': case 'demolish': return 'hammer';
      case 'clear_land': return 'sweep';
      case 'collect': return 'bow';
      case 'show': return (Math.floor(t / 2.4) & 1) ? 'talk' : 'point';
      case 'screen': return 'read';
      case 'serve_notice': return t < 1.9 ? 'knock' : 'read';
      case 'evict': return t < 1.9 ? 'knock' : (Math.floor((t - 1.9) / 2.2) & 1) ? 'point' : 'shake_fist';
      case 'inspect': return (Math.floor(t / 2.8) & 1) ? 'point' : 'read';
      case 'visit': return t < 1.9 ? 'knock' : t < 5 ? 'talk' : 'wave';
      case 'incident': {
        const inc = j.incidentId ? s.incidents[j.incidentId] : null;
        const mend = j.outcomeId === 'fix' || j.outcomeId === 'patch' || (!!inc && inc.defId.indexOf('repair') >= 0);
        if (mend) return 'hammer';
        return (Math.floor(t / 2.6) & 1) ? 'point' : 'talk';
      }
      default: return 'idle';
    }
  }

  function idleLife(p: Puppet, env: Env, dtG: number): AnimId {
    // nothing to do: keep busy in character
    if (env.night > 0.55) return 'sleep';
    p.idleT -= dtG;
    if (p.idleT <= 0) {
      if (p.fidget) { p.fidget = null; p.idleT = p.rng.range(3.5, 8); }
      else {
        const r = p.rng.next();
        let f: AnimId | null = null;
        switch (p.role) {
          case 'mason': f = r < 0.45 ? 'hammer' : r < 0.6 ? 'count' : null; break;
          case 'bailiff': f = r < 0.4 ? 'count' : r < 0.5 ? 'read' : null; break;
          case 'crier': f = vacancy ? (r < 0.55 ? 'wave' : 'talk') : r < 0.3 ? 'wave' : null; break;
          case 'steward': f = r < 0.5 ? 'read' : r < 0.8 ? 'count' : null; break;
          case 'ruler': f = r < 0.12 ? 'shrug' : null; break;
          default: break;
        }
        p.fidget = f; p.idleT = f ? p.rng.range(2.2, 4.2) : p.rng.range(2, 5);
        if (f === 'wave' && p.role === 'crier' && p.rng.chance(0.4)) p.fig.emote('alert');
      }
    }
    return p.fidget ?? 'idle';
  }

  function drive(p: Puppet, a: Actor, s: GameState, env: Env): void {
    const dt = env.dt, dtG = dt * (env.speed > 0 ? Math.min(env.speed, 2) : 0);
    const fig = p.fig;
    // follow the sim
    const far = Math.abs(a.x - p.x) + Math.abs(a.y - p.y);
    const px = p.x, py = p.y;
    if (far > 3.5) { p.x = a.x; p.y = a.y; p.speed = 0; }
    else {
      p.x = damp(p.x, a.x, 15, dt); p.y = damp(p.y, a.y, 15, dt);
      if (dt > 1e-5) p.speed = damp(p.speed, Math.hypot(p.x - px, p.y - py) / dt, 10, dt);
    }
    if (a.state !== p.lastState || a.jobId !== p.lastJob) {
      if (a.state === 'working' && p.lastState !== 'working') fig.react('nod');
      p.lastState = a.state; p.lastJob = a.jobId; p.stateT = 0; p.asked = false;
    }
    p.stateT += dtG;
    const j = a.jobId ? s.jobs[a.jobId] ?? null : null;
    const moving = p.speed > 0.22 || (far > 0.12 && a.state === 'walking');
    if (p.carryT > 0) p.carryT -= dtG;

    // what is in the hand
    const carrying = p.carryT > 0;
    let prop = p.baseProp;
    if (carrying) prop = 'purse';
    else if (j && a.state !== 'idle') { const jp = JOB_PROP[j.kind]; if (jp) prop = jp; }
    setProp(p, prop);

    // which way to face, what to look at
    let anim: AnimId = 'idle';
    let lookX = NaN, lookY = NaN, lookH = NaN;
    if (moving) {
      const dx = a.x - p.x, dy = a.y - p.y;
      if (dx * dx + dy * dy > 0.0009) p.heading = Math.atan2(dx, dy); else p.heading = a.facing;
      anim = p.speed > 3.3 ? 'run' : carrying || a.kind === 'applicant' ? 'carry' : 'walk';
      fig.setRestless(0);
    } else if (a.state === 'working' && j) {
      p.heading = a.facing;
      anim = workAnim(p, j, s);
      fig.setRestless(0);
    } else if (a.state === 'waiting' && a.kind !== 'ruler' && a.kind !== 'staff') {
      // kept waiting: shift from foot to foot, and look at whoever is keeping them
      const r = ruler;
      fig.setRestless(clamp(0.3 + p.stateT / 22, 0.3, 1));
      if (a.kind === 'applicant') {
        const ap = a.refId ? s.applicants[a.refId] : null;
        const b = ap ? s.buildings[ap.buildingId] : null;
        if (b) { lookX = b.x + b.w / 2; lookY = b.y + b.h / 2; lookH = 0.8; }
        if (r && Math.abs(r.x - p.x) + Math.abs(r.y - p.y) < 3) { lookX = r.x; lookY = r.y; lookH = 0.5; }
        if ((Math.floor(p.stateT / 5.5) & 1) && !(r && Math.abs(r.x - p.x) + Math.abs(r.y - p.y) < 3)) lookX = NaN;
      } else if (r && r !== p) { lookX = r.x; lookY = r.y; lookH = 0.55; }
      if (env.night > 0.6) anim = 'sleep';
      else {
        const habit = p.npc ? NPC_WAIT[p.npc] : undefined;
        anim = habit && (Math.floor(p.stateT / 3.4) % 3 === 1) ? habit : 'idle';
        if (p.npc === 'your_mother' && Math.floor(p.stateT / 4.2) !== Math.floor((p.stateT - dtG) / 4.2) && p.stateT > 3) fig.react('shake');
        if (!p.asked && p.stateT > 13) { p.asked = true; fig.emote('question'); }
      }
      if (lookX === lookX && anim !== 'sleep') p.heading = Math.atan2(lookX - p.x, lookY - p.y);
    } else {
      p.heading = a.facing;
      fig.setRestless(0);
      anim = idleLife(p, env, dtG);
      if (a.kind === 'ruler' && anim !== 'sleep') {
        // someone at the door wants a word
        let best = 5;
        for (let i = 0; i < puppets.length; i++) {
          const o = puppets[i]!;
          if (o === p || !o.a || o.a.state !== 'waiting' || o.a.kind === 'staff') continue;
          const d = Math.abs(o.x - p.x) + Math.abs(o.y - p.y);
          if (d < best) { best = d; lookX = o.x; lookY = o.y; lookH = 0.45; }
        }
      }
    }
    if (p.forcedT > 0) { p.forcedT -= dt; if (p.forced && !moving) anim = p.forced; if (p.forcedT <= 0) p.forced = null; }
    fig.setAnim(anim);
    if (p.selected && !moving && anim !== 'sleep' && lookX !== lookX) { const cam = ctx.camera.position; fig.lookAt(cam.x, cam.z, cam.y); }
    else if (lookX === lookX && anim !== 'sleep') { if (lookH === lookH) fig.lookAt(lookX - HALF_W, lookY - HALF_H, lookH); else fig.lookAt(lookX - HALF_W, lookY - HALF_H); }
    else fig.lookAt(null);
    fig.group.position.set(p.x - HALF_W, 0, p.y - HALF_H);
    fig.setHeading(p.heading);
  }

  function feelings(s: GameState): void {
    // bearing follows fortune; checked now and then, not every frame
    vacancy = false;
    for (const id in s.buildings) { const b = s.buildings[id]!; if (b.state !== 'ready') continue; for (const u of b.units) if (!u.tenantId && u.listed) { vacancy = true; break; } if (vacancy) break; }
    for (let i = 0; i < puppets.length; i++) {
      const p = puppets[i]!, a = p.a;
      if (!a) continue;
      let m = 0.62;
      if (a.kind === 'ruler') m = s.ended ? 0.1 : s.gold < 0 ? 0.3 : clamp(0.5 + (s.renown - 40) / 150, 0.4, 0.82);
      else if (a.kind === 'staff') { const st = a.refId ? s.staff[a.refId] : null; if (st) m = clamp(0.25 + st.loyalty / 135, 0.15, 0.9); }
      else if (a.refId && s.tenants[a.refId]) m = clamp(s.tenants[a.refId]!.happiness / 100, 0.08, 0.95);
      p.fig.setMood(m);
    }
  }

  function emoteBody(p: Puppet, e: EmoteId): void {
    switch (e) {
      case 'happy': case 'love': if (p.a && p.a.state === 'waiting') force(p, p.rng.chance(0.5) ? 'bow' : 'cheer', 1.8); else p.fig.react('hop'); break;
      case 'cheer': force(p, 'cheer', 2.6); break;
      case 'angry': if (p.a && p.a.state === 'waiting') force(p, 'shake_fist', 2); else p.fig.react('shake'); break;
      case 'question': if (p.a && p.a.state === 'waiting') force(p, 'shrug', 1.8); else p.fig.react('nod'); break;
      case 'sad': p.fig.react('shake'); break;
      case 'shock': case 'alert': p.fig.react('startle'); break;
      case 'sweat': p.fig.react('flinch'); break;
      case 'idea': p.fig.react('nod'); break;
      default: break;
    }
  }

  function puppetFor(ev: { actorId?: Id; tenantId?: Id; staffId?: Id }, s: GameState): Puppet | null {
    if (ev.actorId) { const p = byId.get(ev.actorId); if (p) return p; }
    if (ev.staffId) { const m = s.staff[ev.staffId]; const p = m && m.actorId ? byId.get(m.actorId) : undefined; if (p) return p; }
    const ref = ev.staffId ?? (ev.actorId ? undefined : ev.tenantId);
    if (ref) for (let i = 0; i < puppets.length; i++) if (puppets[i]!.a && puppets[i]!.a!.refId === ref) return puppets[i]!;
    return null;
  }

  function onEvent(ev: SimEvent, s: GameState): void {
    switch (ev.type) {
      case 'emote': { const p = puppetFor(ev, s); if (p && p.pop > 0.5) { p.fig.emote(ev.emote); emoteBody(p, ev.emote); } break; }
      case 'say': { const p = puppetFor(ev, s); if (p) force(p, 'talk', 2.6); break; }
      case 'job': {
        const j = s.jobs[ev.jobId];
        const p = j && j.assignee ? byId.get(j.assignee) : undefined;
        if (!p) break;
        if (ev.phase === 'start') p.fig.react('nod');
        else if (ev.phase === 'done') { p.fig.react('hop'); if (j && (j.kind === 'repair' || j.kind === 'build' || j.kind === 'renovate') && p.rng.chance(0.4)) p.fig.emote('happy'); }
        break;
      }
      case 'purse_collected': {
        const p = ev.byActor ? byId.get(ev.byActor) : ruler;
        if (p) { p.carryT = 4.5; p.fig.emote('coin'); p.fig.react('hop'); }
        break;
      }
      case 'promotion':
        for (const p of puppets) if (p.a && (p.a.kind === 'ruler' || p.a.kind === 'staff')) force(p, p.a.kind === 'ruler' ? 'cheer' : p.rng.chance(0.5) ? 'cheer' : 'bow', p.a.kind === 'ruler' ? 4 : 2.8);
        break;
      case 'demotion': if (ruler) { force(ruler, 'shrug', 2.4); ruler.fig.emote('sad'); } break;
      case 'charter_ready': if (ruler) { force(ruler, 'cheer', 2); ruler.fig.emote('idea'); } break;
      case 'staff_hired': { const m = s.staff[ev.staffId]; const p = m && m.actorId ? byId.get(m.actorId) : undefined; if (p) force(p, 'bow', 1.8); break; }
      case 'rent_day': for (const p of puppets) { if (p.role === 'crier') { force(p, 'wave', 3); p.fig.emote('alert'); } else if (p.role === 'ruler') p.fig.react('nod'); } break;
      case 'tribute': if (ruler && !ev.paid) { ruler.fig.react('flinch'); ruler.fig.emote('sweat'); } break;
      case 'oath': if (ruler) { if (ev.state === 'kept') ruler.fig.react('nod'); else if (ev.state === 'broken') ruler.fig.react('flinch'); } break;
      case 'sfx': if (ev.id === 'cheer') for (const p of puppets) if (p.a && p.a.state !== 'working') force(p, 'cheer', p.rng.range(2.5, 4.5)); break;
      case 'game_over': if (ruler) { ruler.fig.setMood(0.05); force(ruler, 'shrug', 3); } break;
      default: break;
    }
  }

  function clear(): void {
    for (const p of puppets) p.fig.dispose();
    puppets.length = 0; byId.clear(); ruler = null;
  }

  const layer: FigureLayer = {
    reset(s) {
      clear();
      state = s; fresh = true;
      reconcile(s); feelings(s);
      fresh = false;
    },
    sync(s) {
      if (disposed) return;
      if (!state) { layer.reset(s); return; }
      state = s;
      reconcile(s);
    },
    handleEvents(events, s) {
      if (disposed) return;
      state = s;
      for (let i = 0; i < events.length; i++) onEvent(events[i]!, s);
    },
    update(env) {
      if (disposed) return;
      const s = state, dt = env.dt;
      if (s && (vacancyT -= dt) <= 0) { vacancyT = 0.7; feelings(s); }
      for (let i = puppets.length - 1; i >= 0; i--) {
        const p = puppets[i]!;
        const a = p.a;
        if (!a || !s) {
          // gone from the sim: off the table with a small pop
          p.pop -= dt / 0.28;
          if (p.pop <= 0) { drop(p); continue; }
        } else {
          if (p.pop < 1) p.pop = Math.min(1, p.pop + dt / 0.32);
          drive(p, a, s, env);
        }
        p.fig.group.scale.setScalar(popScale(p.pop));
        p.fig.update(env);
      }
    },
    positionOf(id) {
      const p = byId.get(id);
      if (!p || p.pop < 0.3) return null;
      return _pos.set(p.x - HALF_W, p.fig.height + 0.04, p.y - HALF_H);
    },
    pick(raycaster) {
      let best: Puppet | null = null, bd = Infinity;
      for (let i = 0; i < puppets.length; i++) {
        const p = puppets[i]!;
        if (!p.a || p.pop < 0.6) continue;
        const d = pickFigure(raycaster.ray, p.fig);
        if (d < bd) { bd = d; best = p; }
      }
      return best ? best.id : null;
    },
    setSelected(id) {
      if (id === selectedId) return;
      const was = selectedId ? byId.get(selectedId) : undefined;
      if (was) { was.selected = false; was.fig.setSelected(false); }
      selectedId = id;
      const p = id ? byId.get(id) : undefined;
      if (p) { p.selected = true; p.fig.setSelected(true); }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clear();
      root.removeFromParent();
    },
  };
  return layer;
}
