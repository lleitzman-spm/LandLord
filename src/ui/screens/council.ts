/**
 * The council: your household of delegates seated around an oak table. A seat
 * for each role. Filled seats show the delegate and let you adjust their wage,
 * speak to them at the table, or let them go. Empty seats say why they are
 * empty, or show the candidates waiting to be seen. OWNER: ui-screens-c.
 *
 * open(arg): arg may be a StaffRole or a staff id; that seat is highlighted.
 */
import type { Screen, UICtx } from '../api';
import {
  RANK_ORDER, STAFF_ROLES, DAYS_PER_YEAR, DAYS_PER_MONTH,
  type GameState, type StaffRole, type StaffMember, type Candidate, type Action, type Id, type JobKind, type RankId,
} from '../../sim/types';
import { h, addStyle, clear, fromHTML, num, plural, cap, meter, button } from '../kit';
import { SCREENS_C_CSS } from '../css/screens-c';
import { iconSvg } from '../icons';
import { createPortrait, type Portrait, type PortraitSpec } from '../portraits';
import { dateOf } from '../../sim/core';
import { fairWage, TUNE as STAFF_TUNE } from '../../sim/staff';
import { BUILDINGS, RANKS, BAL, TEMPERAMENT_DEFS, SPECIES_DEFS, ROLE_TITLES, RANK_TITLES, BUILDING_TYPES } from '../../data';
import type { IconId, BuildingType, SfxId } from '../../data/ids';
import type { Exchange, Mood } from '../../word/api';

const ROLE_ICON: Record<StaffRole, IconId> = { mason: 'trowel', bailiff: 'key', crier: 'bell', steward: 'quill' };
const ROLE_DOES: Record<StaffRole, string> = {
  mason: 'Builds and mends: repairs, renovations, new walls. Until there is one, the hammer is yours.',
  bailiff: 'Walks the rent round, serves notices, sees off squatters and carries out writs.',
  crier: 'Cries vacancies in the square and shows applicants round. Homes fill faster.',
  steward: 'Keeps the books, prices vacancies, asks after applicants and settles sureties.',
};
const DOMAIN: Record<StaffRole, string> = { mason: 'repairs', bailiff: 'late rent, writs and squatters', crier: 'applicants', steward: 'sureties, renewals and pets' };
/** their line of work, for petitioners heard at full judgment */
const LINE: Record<StaffRole, string> = { mason: 'walls, roofs and drains', bailiff: 'debts, doors and trespass', crier: 'lettings and the square', steward: 'money and the books' };
/** something one might say to each, offered under the speaking box */
const SAYINGS: Record<StaffRole, string[]> = {
  mason: ['Always mend leaks properly. No patching.', 'If a proper repair costs over forty crowns, patch it.'],
  bailiff: ['Never serve notice on a widow in winter.', 'If they owe under ten crowns, give them more time.'],
  crier: ['Ask the last landlord of anyone who applies.', 'Never turn anyone away for being a goblin.'],
  steward: ['Keep only what the damage cost from any surety.', 'Hold the rent at renewal for anyone here over two years.'],
};
const JOB_TO: Record<JobKind, string> = {
  build: 'build', repair: 'mend it', renovate: 'renovate it', demolish: 'pull it down', clear_land: 'clear the ground',
  collect: 'collect the rent', show: 'show an applicant round', screen: 'ask after an applicant', serve_notice: 'nail up a Notice to Quit',
  evict: 'carry out the writ', inspect: 'inspect the place', incident: 'see to a matter', visit: 'pay a call',
};
const JOB_ING: Record<JobKind, string> = {
  build: 'Building at', repair: 'Mending', renovate: 'Renovating', demolish: 'Pulling down', clear_land: 'Clearing ground at',
  collect: 'Collecting rent at', show: 'Showing an applicant round', screen: 'Asking after an applicant for', serve_notice: 'Serving notice at',
  evict: 'Carrying out a writ at', inspect: 'Inspecting', incident: 'Seeing to a matter at', visit: 'Paying a call at',
};
const TILT = ['-0.6deg', '0.45deg', '-0.3deg', '0.7deg'];

function rolesUnlocked(s: GameState): StaffRole[] {
  const i = RANK_ORDER.indexOf(s.realm.rank);
  return RANK_ORDER.slice(0, i + 1).flatMap(r => RANKS[r].staff);
}
function roleRank(role: StaffRole): RankId { return RANK_ORDER.find(r => RANKS[r].staff.includes(role)) ?? 'knight'; }
function staffBuilding(role: StaffRole): BuildingType | null { return (BUILDING_TYPES as readonly BuildingType[]).find(t => BUILDINGS[t]?.staffRole === role) ?? null; }
function staffFor(s: GameState, role: StaffRole): StaffMember | null { return Object.values(s.staff).find(m => m.role === role) ?? null; }
function loyaltyWord(l: number): string { return l >= 80 ? 'Devoted' : l >= 60 ? 'Loyal' : l >= 40 ? 'Wavering' : l >= 20 ? 'Disgruntled' : 'On the point of leaving'; }
function moodFor(l: number): Mood { return l >= 75 ? 'pleased' : l >= 45 ? 'neutral' : l >= 25 ? 'worried' : 'annoyed'; }
function speciesName(sp: string): string { return (SPECIES_DEFS[sp as keyof typeof SPECIES_DEFS]?.name ?? cap(sp)); }
function served(s: GameState, m: StaffMember): string {
  const months = Math.max(0, Math.floor((s.day - m.hiredDay) / 30));
  return months < 1 ? 'less than a month' : plural(months, 'month');
}
function pips(n: number): HTMLElement {
  const v = Math.max(0, Math.min(5, Math.round(n)));
  return h('span', { class: 'cnc-pips', role: 'img', 'aria-label': `Skill ${v} of 5`, title: `Skill ${v} of 5` }, [0, 1, 2, 3, 4].map(i => h('i', { class: i < v ? 'on' : '' })));
}
function temperLine(id: StaffMember['temperament'] | null, known: boolean): HTMLElement {
  const def = id ? TEMPERAMENT_DEFS[id] : null;
  if (!known || !def) return h('div', { class: 'cnc-temper is-unknown' }, h('span', { class: 'tn' }, 'Temperament: not yet known'), h('span', { class: 'tb' }, 'It will show itself in the work.'));
  return h('div', { class: 'cnc-temper' }, h('span', { class: 'tn' }, def.name, def.epithet ? h('i', null, `, ${def.epithet}`) : null), def.blurb ? h('span', { class: 'tb' }, def.blurb) : null);
}

interface SpeakBox { el: HTMLElement; input: HTMLInputElement; log: HTMLElement; busy: boolean; stop: () => void }

/** A portrait, or a plain roundel if the painter is having a bad day. */
function safePortrait(spec: PortraitSpec): Portrait {
  try { return createPortrait(spec); } catch (err) {
    console.warn('[portrait]', err);
    const el = document.createElement('div');
    el.className = 'ldg-noface'; el.style.width = el.style.height = spec.size + 'px';
    return { el, setMood() {}, setTalking() {}, lookAt() {}, dispose() {} };
  }
}

export function create(ctx: UICtx): Screen {
  addStyle('screens-c', SCREENS_C_CSS);

  let isOpen = false;
  let lastSig = '';
  let highlight: string | null = null;
  let confirmDismiss: Id | null = null;
  const speaking = new Set<Id>();
  const boxes = new Map<Id, SpeakBox>();

  const title = h('h2', { class: 'cnc-title' });
  const sub = h('p', { class: 'cnc-sub' });
  const seekBtn = button('Seek new candidates', () => act({ type: 'refresh_candidates' }, 'bell'), { title: 'Send word that the posts are open.' });
  const closeBtn = h('button', { class: 'll-seal ll-close cnc-close', type: 'button', title: 'Leave the council', 'aria-label': 'Leave the council', onclick: () => ctx.close('council') }, '✕');
  const hall = h('div', { class: 'cnc-hall' });
  const room = h('div', { class: 'cnc-room' }, h('div', { class: 'cnc-head' }, h('div', { class: 'grow' }, title, sub), seekBtn, closeBtn), hall);
  const el = h('div', { class: 'll-veil cnc-veil', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'The Council' }, room);
  el.addEventListener('pointerdown', e => { if (e.target === el) ctx.close('council'); });

  // ── portraits, cached across renders
  const portraits = new Map<string, Portrait>();
  let used = new Set<string>();
  function portrait(key: string, spec: PortraitSpec): Portrait {
    used.add(key);
    let p = portraits.get(key);
    if (!p) { p = safePortrait(spec); portraits.set(key, p); }
    return p;
  }
  function sweep(): void { for (const [k, p] of portraits) if (!used.has(k)) { p.dispose(); portraits.delete(k); } }
  function disposeAll(): void { for (const p of portraits.values()) p.dispose(); portraits.clear(); }

  function act(a: Action, sfx?: SfxId): void {
    const r = ctx.act(a);
    if (r.ok && sfx) { try { ctx.audio.sfx(sfx, { volume: 0.55 }); } catch { /* silence is acceptable */ } }
    lastSig = ''; render();
  }

  // ── speaking at the table
  function speakBox(m: StaffMember): SpeakBox {
    const have = boxes.get(m.id); if (have) return have;
    const input = h('input', { class: 'll-input', type: 'text', placeholder: `Speak to ${m.first}…`, 'aria-label': `Speak to ${m.first}`, autocomplete: 'off', enterkeyhint: 'send' });
    const log = h('div', { class: 'll-col', 'aria-live': 'polite' });
    let typing: ReturnType<typeof setInterval> | null = null;
    let voice: { stop(): void } | null = null;
    const stop = () => { if (typing) clearInterval(typing); typing = null; voice?.stop(); voice = null; portraits.get('s' + m.id)?.setTalking(false); };
    const box: SpeakBox = { el: h('div'), input, log, busy: false, stop };
    const send = async (e: Event) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text || box.busy) return;
      box.busy = true; input.value = ''; stop(); clear(log);
      const sy = box.el.querySelector('.cnc-sayings') as HTMLElement | null; if (sy) sy.hidden = true;
      const reply = h('p', { class: 'cnc-reply is-think' }, `${m.first} considers this`, h('span', { class: 'dots' }, h('i', null, '.'), h('i', null, '.'), h('i', null, '.')));
      log.append(h('p', { class: 'cnc-said' }, text), reply);
      let ex: Exchange | null = null;
      try { ex = await ctx.word.speak(text, { to: m.role }); } catch { ex = null; }
      box.busy = false;
      const p = portraits.get('s' + m.id);
      const line = ex?.reply || `${m.first} frowns, as if the words came from a long way off.`;
      reply.className = 'cnc-reply' + (ex && (ex.status === 'refused' || ex.status === 'error') ? ' is-refused' : '');
      reply.textContent = '';
      if (ex) p?.setMood(ex.speaker.mood);
      p?.setTalking(true);
      try { voice = ctx.audio.voice(m.portraitSeed, line); } catch { voice = null; }
      let i = 0;
      typing = setInterval(() => {
        i = Math.min(line.length, i + 2);
        reply.textContent = line.slice(0, i);
        if (i >= line.length) { if (typing) clearInterval(typing); typing = null; p?.setTalking(false); afterReply(ex); }
      }, 26);
    };
    const afterReply = (ex: Exchange | null) => {
      if (!ex) return;
      if (ex.status === 'needs_confirm') {
        const row = h('div', { class: 'cnc-acts' },
          button('Nay', () => { ex.cancel(); row.replaceWith(h('p', { class: 'cnc-note' }, 'Unsaid. Nothing is done.')); input.focus(); }, { kind: 'quiet' }),
          button('Aye', () => { ex.confirm(); row.replaceWith(h('p', { class: 'cnc-note good' }, 'So be it.')); lastSig = ''; render(); }, { kind: 'primary' }));
        log.append(row);
      } else if (ex.status === 'unclear') {
        log.append(h('p', { class: 'cnc-note' }, 'Plainer words may serve. Name what, where, and when.'));
      } else if (ex.status === 'done' && (ex.orders.length || ex.applied.length)) {
        log.append(h('p', { class: 'cnc-note good' }, ex.orders.length ? 'Written among the standing orders.' : 'It is in hand.'));
        lastSig = ''; render();
      }
    };
    const form = h('form', { onsubmit: send as EventListener }, input);
    const mic = ctx.word.mic;
    if (mic.supported) {
      const micBtn = h('button', { type: 'button', class: 'cnc-mic', title: 'Speak aloud', 'aria-label': `Speak aloud to ${m.first}`, 'aria-pressed': 'false' });
      micBtn.innerHTML = iconSvg('mic');
      const setOn = (on: boolean) => { micBtn.classList.toggle('is-on', on); micBtn.setAttribute('aria-pressed', String(on)); };
      micBtn.addEventListener('click', () => {
        if (mic.listening) { mic.stop(); setOn(false); return; }
        setOn(true);
        mic.start({
          onPartial: t => { input.value = t; },
          onFinal: t => { setOn(false); input.value = t; if (t.trim()) form.requestSubmit(); },
          onError: code => { setOn(false); if (code === 'denied') ctx.toast('The court cannot hear you. The microphone is not permitted.', 'bad'); },
        });
      });
      form.append(micBtn);
    }
    form.append(button('Say it', () => form.requestSubmit(), { kind: 'primary', title: 'Speak (Enter)' }));
    const sayings = h('div', { class: 'cnc-sayings' }, h('span', { class: 'lab' }, 'You might say'),
      SAYINGS[m.role].map(t => h('button', { type: 'button', class: 'cnc-saying', title: 'Put these words in your mouth', onclick: () => { input.value = t; input.focus(); } }, t)));
    box.el = h('div', { class: 'cnc-speak' }, form, sayings, log,
      h('div', { class: 'cnc-acts' }, button('Done speaking', () => { speaking.delete(m.id); stop(); if (mic.listening) mic.stop(); render(); }, { kind: 'quiet' })));
    boxes.set(m.id, box);
    return box;
  }

  // ── what a delegate is doing
  function doingNow(s: GameState, m: StaffMember): string {
    const a = m.actorId ? s.actors[m.actorId] : null;
    const job = a ? Object.values(s.jobs).find(j => j.assignee === a.id && (j.state === 'traveling' || j.state === 'working')) : null;
    const queued = Object.values(s.jobs).filter(j => j.state === 'queued' && j.role === m.role).length;
    const waiting = queued ? ` ${plural(queued, 'more job')} waiting.` : '';
    if (job) {
      const where = (job.buildingId && s.buildings[job.buildingId]?.name) || (job.tenantId && s.tenants[job.tenantId]?.name) || null;
      if (job.state === 'traveling') return `On the way${where ? ' to ' + where : ''} to ${JOB_TO[job.kind]}.${waiting}`;
      return `${JOB_ING[job.kind]}${where ? ' ' + where : ''}, ${Math.round(job.progress * 100)}% done.${waiting}`;
    }
    if (queued) return `Between jobs. ${plural(queued, 'job')} waiting for them.`;
    if (a?.state === 'walking') return 'Walking the lanes. Nothing in hand.';
    return 'Idle, and available for instruction.';
  }

  // ── seats
  function filledCard(s: GameState, m: StaffMember, i: number): HTMLElement {
    let going = m.wage;
    try { going = fairWage(m.skill); } catch { going = BAL.wageBySkill[Math.max(1, Math.min(BAL.wageBySkill.length - 1, Math.round(m.skill)))] ?? m.wage; }
    const wageNote = m.wage < going ? h('p', { class: 'cnc-note warn' }, `Below the going rate of ${going}. ${m.first} has noticed.`)
      : m.wage > going ? h('p', { class: 'cnc-note good' }, `Above the going rate of ${going}. Loyalty, at a price.`)
      : h('p', { class: 'cnc-note' }, `The going rate for their skill, exactly.`);
    const auth = m.authority === 0 ? 'Handles the routine. Asks you about the rest.'
      : m.authority === 1 ? `Settles the usual questions of ${DOMAIN[m.role]} by their own lights, and tells you after. Petitioners with a story still come to you.`
      : `Full judgment. Also hears petitioners about ${LINE[m.role]}, and tells you what was decided. Great matters are still yours.`;
    const isBaron = RANK_ORDER.indexOf(s.realm.rank) >= RANK_ORDER.indexOf('baron');
    const servedDays = s.day - m.hiredDay;
    const needLoyal = STAFF_TUNE?.fullJudgmentLoyalty ?? 70, keepLoyal = STAFF_TUNE?.fullJudgmentKeep ?? 50;
    const authNext = !isBaron ? 'At Baron, they may rule within their own domain.'
      : m.authority === 2 ? `Kept while loyalty stays at ${keepLoyal} or more.`
      : servedDays < DAYS_PER_YEAR ? `Full judgment after a year and a day in your service (${plural(Math.max(1, Math.ceil((DAYS_PER_YEAR - servedDays) / DAYS_PER_MONTH)), 'month')} more), with loyalty of ${needLoyal}.`
      : m.loyalty < needLoyal ? `Full judgment once their loyalty reaches ${needLoyal}.` : '';
    const bound = s.orders.filter(o => o.to === m.role || o.to === 'all').length;
    const confirming = confirmDismiss === m.id;
    const isSpeaking = speaking.has(m.id);
    const l = Math.round(m.loyalty);
    const card = h('div', { class: 'll-parch cnc-card', style: `--tilt:${TILT[i]}` },
      h('h3', { class: 'cnc-name' }, m.name),
      h('p', { class: 'cnc-role' }, `${ROLE_TITLES[m.role]} · ${speciesName(m.species)}`),
      temperLine(m.temperament, true),
      h('div', { class: 'cnc-row' }, h('span', { class: 'k' }, 'Skill'), pips(m.skill), h('span', { class: 'v ldg-faint', style: 'font-size:13px' }, `${plural(m.jobsDone, 'job')} done`)),
      h('div', { class: 'cnc-row' }, h('span', { class: 'k' }, 'Wage'),
        h('span', { class: 'cnc-wage', role: 'group', 'aria-label': `${m.first}'s wage` },
          h('button', { type: 'button', 'aria-label': 'Pay less', title: 'One crown less a month', disabled: m.wage <= 1, dataset: { fk: 'wage-dn-' + m.id }, onclick: () => act({ type: 'set_wage', staffId: m.id, wage: Math.max(1, m.wage - 1) }, 'click') }, '−'),
          h('span', { class: 'wv' }, num(m.wage)),
          h('button', { type: 'button', 'aria-label': 'Pay more', title: 'One crown more a month', dataset: { fk: 'wage-up-' + m.id }, onclick: () => act({ type: 'set_wage', staffId: m.id, wage: m.wage + 1 }, 'coin') }, '+')),
        h('span', { class: 'ldg-faint', style: 'font-size:13px' }, 'a month')),
      wageNote,
      h('div', { class: 'cnc-loyal' }, h('div', { class: 'cnc-row' }, h('span', { class: 'k' }, 'Loyalty'), h('span', { class: 'v' }, `${loyaltyWord(l)}, ${l}`)), meter(l, { title: `Loyalty ${l}` })),
      h('p', { class: 'cnc-auth' }, h('b', null, 'Authority. '), auth, authNext ? h('span', { class: 'next' }, authNext) : null),
      h('p', { class: 'cnc-now' }, fromHTML(iconSvg('hourglass')), h('span', null, doingNow(s, m))),
      h('div', { class: 'cnc-links' },
        h('span', { class: 'ldg-faint' }, `In your service ${served(s, m)}.`),
        bound ? button(`Bound by ${plural(bound, 'standing order')}`, () => ctx.open('ledger', 'orders'), { kind: 'quiet', title: 'Read them in the ledger' }) : null),
      confirming
        ? h('div', { class: 'cnc-confirm' },
          h('p', null, `Let ${m.name} go? ${cap(served(s, m))} in your service, ${plural(m.jobsDone, 'job')} done${m.loyalty >= 70 ? ', and fond of the place' : m.loyalty < 40 ? ', and not sorry to hear it' : ''}. The post stands empty until you hire again, and the rest of the household will draw its own conclusions.`),
          h('div', { class: 'cnc-acts' },
            button(`Keep ${m.first}`, () => { confirmDismiss = null; render(); }, { kind: 'quiet' }),
            button(`Dismiss ${m.first}`, () => { confirmDismiss = null; speaking.delete(m.id); boxes.get(m.id)?.stop(); boxes.delete(m.id); act({ type: 'dismiss_staff', staffId: m.id }, 'door'); }, { kind: 'danger' })))
        : isSpeaking ? speakBox(m).el
        : h('div', { class: 'cnc-acts' },
          button('Speak', () => { speaking.add(m.id); render(); requestAnimationFrame(() => boxes.get(m.id)?.input.focus()); }, { kind: 'primary', title: `Give ${m.first} an order` }),
          button('Dismiss', () => { confirmDismiss = m.id; render(); }, { kind: 'danger', title: `Let ${m.first} go` })),
    );
    return card;
  }

  function candidateCard(s: GameState, c: Candidate, canHire: boolean, why: string, i: number): HTMLElement {
    const p = portrait('c' + c.id, { species: c.species, seed: c.portraitSeed, role: c.role, size: 52, frame: true });
    return h('div', { class: 'cnc-cand' + (canHire ? '' : ' is-dim'), style: `--tilt:${['0.5deg', '-0.4deg', '0.2deg'][i % 3]}` },
      h('div', { class: 'top' }, h('span', { class: 'pt' }, p.el), h('span', { class: 'nm' }, c.name, h('span', { class: 'sp' }, `${speciesName(c.species)}, would-be ${ROLE_TITLES[c.role].toLowerCase()}`))),
      h('p', { class: 'cnc-pitch' }, c.pitch),
      h('div', { class: 'meta' }, h('span', null, 'Skill'), pips(c.skill), h('span', { class: 'wage' }, `asks ${num(c.wage)} a month`)),
      c.temperamentKnown && TEMPERAMENT_DEFS[c.temperament]
        ? h('span', { class: 'tmp', title: TEMPERAMENT_DEFS[c.temperament].blurb || undefined }, `${TEMPERAMENT_DEFS[c.temperament].name}${TEMPERAMENT_DEFS[c.temperament].epithet ? ', ' + TEMPERAMENT_DEFS[c.temperament].epithet : ''}`)
        : h('span', { class: 'tmp unk' }, 'Temperament: not yet known'),
      button(canHire ? `Hire ${c.first}` : why, () => act({ type: 'hire', candidateId: c.id }, 'stamp'), { kind: canHire ? 'primary' : 'plain', disabled: !canHire, title: canHire ? `Take ${c.first} into your household at ${c.wage} crowns a month` : why }),
    );
  }

  function emptyCard(s: GameState, role: StaffRole, i: number): HTMLElement {
    const unlocked = rolesUnlocked(s).includes(role);
    const card = h('div', { class: 'll-parch cnc-card', style: `--tilt:${TILT[i]}` });
    if (!unlocked) {
      const rk = roleRank(role);
      const hopefuls = s.candidates.filter(c => c.role === role);
      card.append(h('div', { class: 'cnc-why' },
        h('span', { class: 'big' }, `Locked until ${RANK_TITLES[rk]}`),
        h('p', null, ROLE_DOES[role]),
        h('p', { class: 'ldg-faint', style: 'font-style:italic' }, `The Crown permits a ${ROLE_TITLES[role]} from the rank of ${RANK_TITLES[rk]}. Until then, the chair is for show.`),
        hopefuls.length ? h('div', { class: 'cnc-hopefuls' },
          h('span', { class: 'faces', 'aria-hidden': 'true' }, hopefuls.slice(0, 3).map(c => portrait('c' + c.id, { species: c.species, seed: c.portraitSeed, role: c.role, size: 30, frame: true }).el)),
          h('span', null, `${['No one', 'One hopeful', 'Two hopefuls', 'Three hopefuls'][hopefuls.length] ?? plural(hopefuls.length, 'hopeful')} ${hopefuls.length === 1 ? 'has' : 'have'} already asked after the post.`)) : null));
      return card;
    }
    const bt = staffBuilding(role);
    const blds = bt ? Object.values(s.buildings).filter(b => b.type === bt) : [];
    const ready = !bt || blds.some(b => b.state === 'ready');
    const going = blds.find(b => b.state === 'building');
    let why = '';
    if (!ready && bt) {
      const def = BUILDINGS[bt];
      why = `Needs ${def.name.startsWith('The') ? '' : 'a '}${def.name}`;
      card.append(h('div', { class: 'cnc-why' },
        h('span', { class: 'big' }, going ? `The ${def.name} is going up` : `Build ${/^[AEIOU]/.test(def.name) ? 'an' : 'a'} ${def.name} first`),
        h('p', null, going ? `${Math.round(going.progress * 100)}% built. A ${ROLE_TITLES[role]} can be taken on once it stands.` : `A ${ROLE_TITLES[role]} needs somewhere to work from. It costs ${num(def.cost)} crowns, from the pattern book.`),
        h('p', { class: 'ldg-faint', style: 'font-size:13px' }, ROLE_DOES[role])));
    } else {
      card.append(h('div', { class: 'cnc-why' }, h('span', { class: 'big' }, 'The chair is empty'), h('p', null, ROLE_DOES[role])));
    }
    const cands = s.candidates.filter(c => c.role === role);
    if (cands.length) {
      card.append(h('div', { class: 'cnc-cands' }, h('h4', { class: 'cnc-cands-h' }, ready ? 'Waiting to be seen' : 'Would take the post'),
        cands.map((c, k) => candidateCard(s, c, ready, why, k))));
    } else {
      card.append(h('p', { class: 'cnc-note', style: 'text-align:center' }, 'Nobody has asked after the post. Seek new candidates.'));
    }
    return card;
  }

  function seat(s: GameState, role: StaffRole, i: number): HTMLElement {
    const m = staffFor(s, role);
    const hl = highlight !== null && (highlight === role || (m && highlight === m.id));
    let face: HTMLElement;
    if (m) {
      const p = portrait('s' + m.id, { species: m.species, seed: m.portraitSeed, role: m.role, size: 128, frame: true });
      if (!speaking.has(m.id)) p.setMood(moodFor(m.loyalty));
      face = h('div', { class: 'cnc-portrait' }, p.el);
    } else {
      face = h('div', { class: 'cnc-portrait is-empty', 'aria-hidden': 'true' }, fromHTML(iconSvg(ROLE_ICON[role])));
    }
    return h('section', { class: 'cnc-seat' + (hl ? ' is-hl' : ''), dataset: { role }, 'aria-label': m ? `${m.name}, ${ROLE_TITLES[role]}` : `The ${ROLE_TITLES[role]}'s seat, empty` },
      h('div', { class: 'cnc-chair', 'aria-hidden': 'true' }),
      face,
      h('div', { class: 'cnc-plate' }, ROLE_TITLES[role]),
      m ? filledCard(s, m, i) : emptyCard(s, role, i));
  }

  function render(): void {
    if (!isOpen) return;
    const s = ctx.state();
    const active = document.activeElement as HTMLElement | null;
    const focusKey = active?.dataset?.fk ?? null;
    const keepScroll = el.scrollTop;
    used = new Set();
    const unlocked = rolesUnlocked(s);
    const filled = STAFF_ROLES.filter(r => staffFor(s, r)).length;
    const wages = Object.values(s.staff).reduce((a, m) => a + m.wage, 0);
    const openSeats = unlocked.filter(r => !staffFor(s, r));
    const waitingN = s.candidates.filter(c => openSeats.includes(c.role)).length;
    title.innerHTML = '';
    title.append('The Council of ', h('b', null, s.realm.name));
    sub.textContent = unlocked.length === 0
      ? `A ${RANK_TITLES[s.realm.rank]} keeps no household; every chair is for show. The Crown permits delegates from the rank of Knight.`
      : `${filled} of ${unlocked.length} seats filled. Wages, all told: ${num(wages)} crowns a month.${waitingN ? ` ${plural(waitingN, 'candidate')} waiting to be seen.` : ''}`;
    seekBtn.hidden = openSeats.length === 0;
    const fee = STAFF_TUNE?.refreshFee?.[s.realm.rank];
    seekBtn.title = `Send word that the posts are open. The first call each month is free${fee ? `; after that, ${fee} crowns a time` : ''}.`;

    // keep any speak box that holds focus alive across the redraw
    clear(hall);
    const table = h('div', { class: 'cnc-table', 'aria-hidden': 'true' }, [25, 50, 75].map(x => h('div', { class: 'cnc-candle', style: `left:${x}%` })));
    hall.append(table, ...STAFF_ROLES.map((r, i) => seat(s, r, i)));
    sweep();
    for (const [id, b] of boxes) if (!s.staff[id]) { b.stop(); boxes.delete(id); speaking.delete(id); }
    el.scrollTop = keepScroll;
    if (active && active.isConnected && el.contains(active)) active.focus({ preventScroll: true });
    else if (focusKey) (el.querySelector(`[data-fk="${CSS.escape(focusKey)}"]`) as HTMLElement | null)?.focus({ preventScroll: true });
    lastSig = sig(s);
  }

  function sig(s: GameState): string {
    const st = Object.values(s.staff).map(m => `${m.id}:${m.wage}:${Math.round(m.loyalty)}:${m.jobsDone}:${m.authority}:${m.skill}`).join(',');
    const jobs = Object.values(s.jobs).filter(j => j.state !== 'done' && j.state !== 'cancelled').map(j => `${j.id}${j.state[0]}${Math.round(j.progress * 10)}`).join(',');
    const bl = Object.values(s.buildings).filter(b => BUILDINGS[b.type]?.category === 'staff').map(b => `${b.id}${b.state[0]}${Math.round(b.progress * 20)}`).join(',');
    return [s.realm.rank, st, s.candidates.map(c => c.id + (c.temperamentKnown ? 'k' : '')).join(','), jobs, bl, s.orders.length, Math.floor(dateOf(s.day).monthIndex)].join('|');
  }

  return {
    el,
    pauses: true,
    open(arg?: unknown) {
      highlight = typeof arg === 'string' ? arg : null;
      isOpen = true; el.hidden = false; confirmDismiss = null;
      el.scrollTop = 0;
      render();
      ctx.audio.sfx('door', { volume: 0.5 });
      if (highlight) {
        const target = hall.querySelector('.cnc-seat.is-hl') as HTMLElement | null;
        target?.scrollIntoView({ block: 'nearest' });
      }
    },
    close() {
      isOpen = false; el.hidden = true; confirmDismiss = null;
      for (const b of boxes.values()) b.stop();
      boxes.clear(); speaking.clear();
      disposeAll();
    },
    update(state: GameState) {
      if (!isOpen) return;
      if (sig(state) !== lastSig) {
        // never redraw under someone mid-sentence
        const typingNow = [...boxes.values()].some(b => b.busy || (document.activeElement === b.input && b.input.value.length > 0));
        if (!typingNow) render();
      }
    },
  };
}
