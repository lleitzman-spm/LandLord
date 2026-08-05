// Holding court — the docket (Edwin, 2026-07-27).
//
// "Ideally 'holding court' is where the king has all decisions he needs to make
// brought before him in order of importance and urgency, across all
// departments, fiefs, etc. Everything else he (or his regent acting in his
// name) may do is proactively going TO an area and administering, but HOLDING
// COURT is everyone else's chance to get a signoff on an approval or a blessing
// or guidance."
//
// So court is not a thing you do at a keep — it is the one place the whole
// realm's pending decisions come TO the Crown, ranked. This is that reading:
// every matter standing anywhere in the kingdom that cannot move without a
// human word, folded into one docket and sorted by what it costs to leave it.
//
// A reading like every other: nothing stored. The matters are folded fresh from
// the records each time court is held, so a decision taken elsewhere simply
// stops appearing — there is no queue to keep in step.

import type { EventLog, CaseReading } from './events';
import { awaitingHuman, clerkProposals, ageInDays } from './events';
import { severityOf } from './consequences';
import type { GuildReading } from './guilds';
import type { PatronReading } from './consequences';
import type { FiefReading } from './states';
import { spendSignal, seatLabel } from './caselabel';

/** What kind of word the Crown is being asked for. */
export type MatterKind =
  | 'proposal' // a clerk reasoned and stopped: ratify or refuse
  | 'approval' // a case standing on a human hand
  | 'seat' // a Crown office with no Chancellor
  | 'keep' // a fief with no holder
  | 'placement'; // an owner in no knight's care

export interface Matter {
  /** Stable within a folding — the case id, or the subject's id. */
  id: string;
  kind: MatterKind;
  /** What is asked, in the kingdom's plain words. */
  asks: string;
  /** Who brings it — a clerk's desk, a guild, a knight, or the realm itself. */
  brings: string;
  /** The subject it concerns, for the card's title. */
  subject: string;
  /** How long it has stood waiting, in days. */
  waitingDays: number;
  /** True when coin cannot move until the word is given. */
  holdsMoney: boolean;
  /** True when the matter has rotted past the crisis threshold. */
  inCrisis: boolean;
  /** Importance × urgency, folded to one number — the docket's order. */
  weight: number;
  /** Where the Crown goes to give the word. */
  go: { kind: 'case'; caseId: string } | { kind: 'guild'; guildId: string } | { kind: 'fief'; territoryId: string } | { kind: 'place' };
}

// ── The weighing ──────────────────────────────────────────────────────────
//
// Importance is what the matter BLOCKS; urgency is how long it has blocked it.
// A clerk's proposal outranks a bare waiting case because a whole cascade is
// stopped behind it; money outranks both, because coin held is work not done.
// Standing debts (a headless Crown office, an unplaced owner) are important but not
// urgent — they sit below the day's decisions unless they have festered.

const BASE: Record<MatterKind, number> = {
  proposal: 60,
  approval: 40,
  keep: 30,
  seat: 25,
  placement: 20,
};

const CRISIS_BONUS = 50;
const MONEY_BONUS = 30;
/** Age is dampened (a square root) AND capped: a decade-old trifle must never
 *  outrank a live crisis on seniority alone. Uncapped, a 3,650-day case scored
 *  362 on age — three times the whole rest of the scale — and sat above every
 *  real decision. Age is a weight on the scale, not the scale. */
const AGE_CAP = 45;

/** A matter's place in the docket: what it blocks, plus what the wait has cost. */
function weigh(kind: MatterKind, waitingDays: number, holdsMoney: boolean, inCrisis: boolean): number {
  return (
    BASE[kind] +
    (inCrisis ? CRISIS_BONUS : 0) +
    (holdsMoney ? MONEY_BONUS : 0) +
    Math.min(AGE_CAP, Math.round(Math.sqrt(Math.max(0, waitingDays)) * 6))
  );
}

/** The last note on a case — what the matter actually asks. */
function lastNote(c: CaseReading): string | null {
  for (let i = c.events.length - 1; i >= 0; i--) {
    if (c.events[i].note) return c.events[i].note ?? null;
  }
  return null;
}

/** The door the case concerns, or the case id's last readable segment. */
function subjectOf(caseId: string): string {
  const parts = caseId.split(' · ');
  const door = parts.find((s) => s.includes(', '));
  if (door) return door.split(' — ')[0].trim();
  return parts[parts.length - 1] ?? caseId;
}

export interface CourtReading {
  /** The matters the court HEARS this sitting — heaviest first, bounded by
   *  `cap`. Not everything that waits; see `waiting`. */
  matters: Matter[];
  /** Everything awaiting the Crown's word, before the cap. `matters` is a
   *  window onto this.
   *
   *  These three used to be folded over two different sets: `matters` after the
   *  cap, the counts before it — so the court read "Before the court: 60 · In
   *  crisis: 1,842" above a list of sixty rows, and no amount of scrolling could
   *  reconcile the numbers with the docket. A stat that cannot be checked against
   *  the thing it sits on top of is a stat that gets ignored. The cap is now a
   *  fact the reading states rather than one it hides. (Adversarial sweep,
   *  2026-07-28.) */
  waiting: number;
  /** How many of the matters the court HEARS stand in crisis — the count that
   *  should shame a long court. */
  inCrisis: number;
  /** …and of those, how many hold coin still. */
  holdingMoney: number;
  /** Crisis and coin across everything waiting, cap or no cap. */
  inCrisisAll: number;
  holdingMoneyAll: number;
}

/** Fold the docket: everything in the realm that cannot move without a word.
 *  `cap` bounds what the court hears at once — the rest keep their place and
 *  come up as those above them are answered. */
export function readCourt(
  log: EventLog,
  now: string,
  opts: {
    guilds?: GuildReading[];
    fiefs?: FiefReading[];
    unplaced?: PatronReading[];
  } = {},
  cap = 60,
): CourtReading {
  const matters: Matter[] = [];

  // ① The clerks' proposals — a cascade stopped, waiting to be ratified.
  const proposals = clerkProposals(log).filter((p) => p.awaiting);
  const proposed = new Set(proposals.map((p) => p.caseId));
  // A proposal ages like any other case: one left unanswered long enough is a
  // crisis, and must be able to say so — it was reading as fresh forever.
  const caseById = new Map(awaitingHuman(log).map((c) => [c.caseId, c]));
  for (const p of proposals) {
    const waited = Math.max(0, Math.floor((Date.parse(now) - Date.parse(p.at)) / 86_400_000));
    const money = spendSignal(p.note)?.tone === 'warn';
    const own = caseById.get(p.caseId);
    const rotted = own ? severityOf(own, now).band === 'crisis' : false;
    matters.push({
      id: p.caseId,
      kind: 'proposal',
      asks: p.note || 'A clerk proposes the next step.',
      brings: `the clerk at ${seatLabel(p.seat)}`,
      subject: subjectOf(p.caseId),
      waitingDays: waited,
      holdsMoney: money,
      inCrisis: rotted,
      weight: weigh('proposal', waited, money, rotted),
      go: { kind: 'case', caseId: p.caseId },
    });
  }

  // ② Every other case standing on a human hand.
  for (const c of awaitingHuman(log)) {
    if (proposed.has(c.caseId)) continue; // already before the court, as a proposal
    const note = lastNote(c);
    const sev = severityOf(c, now);
    const money = spendSignal(note)?.tone === 'warn';
    const waited = ageInDays(c, now) ?? 0;
    matters.push({
      id: c.caseId,
      kind: 'approval',
      asks: note || 'Waits on a human word.',
      brings: c.holder ? seatLabel(c.holder) : 'the realm',
      subject: subjectOf(c.caseId),
      waitingDays: waited,
      holdsMoney: money,
      inCrisis: sev.band === 'crisis',
      weight: weigh('approval', waited, money, sev.band === 'crisis'),
      go: { kind: 'case', caseId: c.caseId },
    });
  }

  // ③ The standing debts — a craft with no Chancellor, a fief with no holder, an
  //    owner in no knight's care. Not urgent by the day, but they are decisions
  //    only the Crown can take, and court is where they are brought.
  for (const g of opts.guilds ?? []) {
    if (g.manned) continue;
    matters.push({
      id: `guild:${g.guild.id}`,
      kind: 'seat',
      asks: `No Chancellor heads ${g.guild.name}. Seat one, or its work keeps pooling on the Regent.`,
      brings: g.guild.name,
      subject: g.guild.name,
      waitingDays: g.oldestDays,
      holdsMoney: false,
      inCrisis: false,
      weight: weigh('seat', g.oldestDays, false, false),
      go: { kind: 'guild', guildId: g.guild.id },
    });
  }
  for (const f of opts.fiefs ?? []) {
    if (f.state !== 'stewardship') continue;
    matters.push({
      id: `fief:${f.territory.id}`,
      kind: 'keep',
      asks: `${f.territory.name} has neither lord nor keeper — grant it, or it falls to the Regent.`,
      brings: f.territory.name,
      subject: f.territory.name,
      waitingDays: 0,
      holdsMoney: false,
      inCrisis: false,
      weight: weigh('keep', 0, false, false),
      go: { kind: 'fief', territoryId: f.territory.id },
    });
  }
  const unplaced = opts.unplaced ?? [];
  if (unplaced.length > 0) {
    const doors = unplaced.reduce((n, p) => n + p.doors.length, 0);
    const worst = unplaced.reduce((a, b) => (a.faith <= b.faith ? a : b));
    matters.push({
      id: 'placement:all',
      kind: 'placement',
      asks: `${unplaced.length} owner${unplaced.length === 1 ? '' : 's'} stand in no knight's care — ${doors} doors adrift. Place them.`,
      brings: 'the realm',
      subject: `${unplaced.length} owner${unplaced.length === 1 ? '' : 's'} unplaced`,
      waitingDays: 0,
      holdsMoney: false,
      inCrisis: worst.faith < 60,
      weight: weigh('placement', 0, false, worst.faith < 60),
      go: { kind: 'place' },
    });
  }

  matters.sort((a, b) => b.weight - a.weight || a.subject.localeCompare(b.subject));

  // "Across all departments, fiefs, etc." — so no ONE kind may starve the
  // others. A live muster carries thousands of waiting cases; taken purely by
  // weight they filled every slot and the unmanned crafts were never heard at
  // all. Each kind is guaranteed its first few places; the rest of the docket
  // fills by weight, in order.
  const FLOOR = 3;
  const heard = new Set<string>();
  const seatedByKind = new Map<MatterKind, number>();
  for (const m of matters) {
    const n = seatedByKind.get(m.kind) ?? 0;
    if (n >= FLOOR) continue;
    seatedByKind.set(m.kind, n + 1);
    heard.add(m.id);
    if (heard.size >= cap) break;
  }
  for (const m of matters) {
    if (heard.size >= cap) break;
    heard.add(m.id);
  }
  const docket = matters.filter((m) => heard.has(m.id));

  return {
    matters: docket,
    waiting: matters.length,
    // Counted over the DOCKET, so the three stats and the list below them
    // describe the same sitting…
    inCrisis: docket.filter((m) => m.inCrisis).length,
    holdingMoney: docket.filter((m) => m.holdsMoney).length,
    // …and over everything, so the backlog is still visible when it is capped.
    inCrisisAll: matters.filter((m) => m.inCrisis).length,
    holdingMoneyAll: matters.filter((m) => m.holdsMoney).length,
  };
}
