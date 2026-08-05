// The Census, rebuilt as a COURT HIERARCHY (docs/WRIT-THE-BROKERAGE.md).
//
// Edwin: *"move away from it feeling just like a website scrolling list"*, with
// *"clear sections for the different types of subjects, that also allows for
// subject management."* What stood before was the list: five pledge buckets and
// a flat map, with one door out (a person's page) and one act (enroll).
//
// This draws the realm's actual shape instead — the Crown at the head, the three
// crafts beneath it, the land and its line of answer beside them, the outside
// trades last — with the line of answer drawn as a literal rule down the left of
// each branch. And design law 6 holds throughout: every act stands beside the
// record it changes. A Chancellor is seated ON the office, a knight sworn IN the
// fief, a squire dubbed UNDER their knight, and anyone struck where they stand.
//
// Reading-first: everything rendered here is folded by `readCourtTree` from the
// census and the acts. This file adds no state of its own beyond the text in the
// forms.

import { useState } from 'react';
import type { CourtTree, FiefCourtReading, OfficeReading } from './domain/courtTree';
import { readCourtTree } from './domain/courtTree';
import { FIEF_STATE_LABEL } from './domain/states';
import type { Kingdom, Person, PledgeType } from './domain/types';
import type { CensusActions, CourtActions } from './store/chronicleStore';
import { Explain, InlineLink, PLEDGE_HINT, PLEDGE_LABEL, PLEDGE_ORDER } from './components';
import { useNav } from './nav';

interface Props {
  kingdom: Kingdom;
  census: CensusActions;
  court: CourtActions;
}

/** Only an agent may hold land or head a craft — the Crown's own staff and the
 *  agents are the same pledge in the book (`vassal`), and the artisans are
 *  outside hands who may keep land but never hold it. So the pick-lists for a
 *  seat offer vassals; the pick-lists for a keeper or a station offer artisans
 *  too, which is exactly what the acts already allow. */
const seatable = (kingdom: Kingdom) => kingdom.people.filter((p) => p.pledge === 'vassal');
const knightable = (kingdom: Kingdom) =>
  kingdom.people.filter((p) => p.pledge === 'vassal' || p.pledge === 'squire');
const hands = (kingdom: Kingdom) => kingdom.people.filter((p) => p.pledge === 'sellsword');

// ── The small pieces the sections share ─────────────────────────────────────

/** A section of the court: a titled band with its own count and fine print. */
function Section({
  numeral,
  title,
  count,
  hint,
  children,
}: {
  numeral: string;
  title: string;
  count?: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ct-sec">
      <header className="ct-sec-h">
        <span className="ct-num" aria-hidden="true">
          {numeral}
        </span>
        <h3>{title}</h3>
        {count != null && <span className="ct-count">{count}</span>}
      </header>
      <Explain className="wt-fine">{hint}</Explain>
      {children}
    </section>
  );
}

/** A subject where they stand: their name is the door to their page, their
 *  standing reads beside it, and the acts that touch them sit on the same line.
 *  `role` names what they are HERE — Chancellor, lord, knight — which is not
 *  always their pledge. */
function Subject({
  person,
  role,
  tone,
  onStrike,
  extra,
}: {
  person: Person;
  role?: string;
  tone?: 'crown' | 'seat' | 'hand';
  /** Strike the ACT that puts them here (revoke), not the person. */
  onStrike?: { label: string; act: () => void };
  extra?: React.ReactNode;
}) {
  const nav = useNav();
  return (
    <div className={`ct-subject${tone ? ` ct-${tone}` : ''}`}>
      <span className="ct-badge" aria-hidden="true">
        {initials(person.name)}
      </span>
      <span className="ct-who">
        <span className="ct-name">
          <InlineLink onClick={() => nav.goToPerson(person.id)}>
            <b>{person.name}</b>
          </InlineLink>
          <span className="ct-role">{role ?? PLEDGE_LABEL[person.pledge]}</span>
        </span>
        {person.note && <span className="ct-note">{person.note}</span>}
      </span>
      <span className="ct-acts">
        {extra}
        {onStrike && (
          <button className="wt-go ct-quiet" onClick={onStrike.act} title={onStrike.label}>
            {onStrike.label}
          </button>
        )}
        <button className="wt-go" onClick={() => nav.goToPerson(person.id)} title="Their page">
          →
        </button>
      </span>
    </div>
  );
}

/** "1 Fiefs" is the kind of small lie that makes a careful surface read careless. */
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Two letters for a medallion — the same shorthand the board uses elsewhere. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '?';
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
  return (first + second).toUpperCase();
}

/** A seat standing empty. Never a silent gap — an empty seat is delegation debt
 *  and the gauge must read it aloud, with the act to fill it right there. */
function Vacancy({ what, children }: { what: string; children: React.ReactNode }) {
  return (
    <div className="ct-vacancy">
      <span className="ct-vac-mark" aria-hidden="true">
        ✧
      </span>
      <span className="ct-vac-t">{what}</span>
      {children}
    </div>
  );
}

/** Pick a person, press the verb. The act is made where its record would stand. */
function Seat({
  label,
  verb,
  people,
  onAct,
}: {
  label: string;
  verb: string;
  people: Person[];
  onAct: (personId: string) => void;
}) {
  const [id, setId] = useState('');
  if (people.length === 0) {
    return <span className="ct-none">nobody in the census can take it yet</span>;
  }
  return (
    <form
      className="ct-seat"
      onSubmit={(e) => {
        e.preventDefault();
        if (!id) return;
        onAct(id);
        setId('');
      }}
    >
      <select
        className="wt-select"
        value={id}
        onChange={(e) => setId(e.target.value)}
        aria-label={label}
      >
        <option value="">{label}</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.pledge === 'squire' ? ' (squire)' : ''}
            {p.pledge === 'sellsword' ? ' (artisan)' : ''}
          </option>
        ))}
      </select>
      <button type="submit" className="wt-go" disabled={!id}>
        {verb}
      </button>
    </form>
  );
}

// ── ① The Crown ─────────────────────────────────────────────────────────────

function CrownSection({ tree, kingdom, census }: { tree: CourtTree } & Omit<Props, 'court'>) {
  return (
    <Section
      numeral="I"
      title="The Crown"
      hint="The King, and the Regent who administers the kingdom in his name. Everything undelegated falls to the Regent's desk — that is the catch-basin, and its depth is the gauge."
    >
      <div className="wt-card ct-crown">
        {tree.king ? (
          <Subject person={tree.king} role="King · the sovereign" tone="crown" />
        ) : (
          <Vacancy what="The throne stands empty.">
            <Seat
              label="Crown a king…"
              verb="Crown"
              people={seatable(kingdom)}
              onAct={(id) => census.repledge(id, 'king')}
            />
          </Vacancy>
        )}
        {tree.regent ? (
          <Subject person={tree.regent} role="Regent · in the King's name" tone="crown" />
        ) : (
          <Vacancy what="No Regent stands. Nothing undelegated has a desk to fall to.">
            <Seat
              label="Name a Regent…"
              verb="Name"
              people={seatable(kingdom)}
              onAct={(id) => census.repledge(id, 'steward')}
            />
          </Vacancy>
        )}
        {tree.wards.length > 0 && (
          <div className="ct-branch">
            <div className="ct-branch-t">In the Crown's own care</div>
            {tree.wards.map((w) => (
              <Subject
                key={w.id}
                person={w}
                role="Squire · an agent in training"
                onStrike={{ label: 'strike', act: () => census.strike(w.id) }}
              />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

// ── ② The Crown offices ─────────────────────────────────────────────────────

function OfficeCard({
  office,
  kingdom,
  court,
}: { office: OfficeReading } & Props) {
  const nav = useNav();
  return (
    <div className="wt-card ct-house">
      <div className="ct-house-h">
        <InlineLink onClick={() => nav.goToTerritory(office.territory.id)}>
          <b className="ct-house-n">{office.territory.name}</b>
        </InlineLink>
        <span className={`ct-tag${office.chancellor ? '' : ' ct-tag-bad'}`}>
          {office.chancellor ? 'Headed' : 'Headless'}
        </span>
      </div>

      {office.chancellor && office.grant ? (
        <Subject
          person={office.chancellor}
          role="Chancellor"
          tone="seat"
          onStrike={{ label: 'unseat', act: () => court.revoke(office.grant!.id) }}
        />
      ) : (
        <Vacancy what="This craft has no Chancellor. The Crown owes it a decision.">
          <Seat
            label="Seat a Chancellor…"
            verb="Seat"
            people={seatable(kingdom)}
            onAct={(id) => court.grant(office.territory.id, id, 'lord')}
          />
        </Vacancy>
      )}

      <div className="ct-branch">
        <div className="ct-branch-t">
          Its hands{office.hands.length > 0 ? ` · ${office.hands.length}` : ''}
        </div>
        {office.hands.map((h) => (
          <Subject
            key={h.fealty.id}
            person={h.person}
            role="Sworn to the office"
            tone="hand"
            onStrike={{ label: 'release', act: () => court.revoke(h.fealty.id) }}
          />
        ))}
        {office.garrison.map((g) => (
          <Subject
            key={g.posting.id}
            person={g.person}
            role="Artisan · stationed here"
            tone="hand"
            onStrike={{ label: 'end the station', act: () => court.revoke(g.posting.id) }}
          />
        ))}
        {office.hands.length === 0 && office.garrison.length === 0 && (
          <p className="ct-none">The Chancellor works this craft alone.</p>
        )}
        <Seat
          label="Swear a hand to this office…"
          verb="Swear"
          people={knightable(kingdom)}
          onAct={(id) => court.swear(office.territory.id, id)}
        />
      </div>
    </div>
  );
}

function OfficesSection(props: Props & { tree: CourtTree }) {
  const { tree, census } = props;
  const [name, setName] = useState('');
  const headless = tree.offices.filter((o) => !o.chancellor).length;
  return (
    <Section
      numeral="II"
      title="The Crown offices"
      count={`${tree.offices.length}${headless ? ` · ${headless} headless` : ''}`}
      hint="The household's own crafts, seated in the palace. An office is never land and never appears on the map — it is a place in the record so a Chancellor's seat is a grant like any other, revocable the same way. The offices SERVE the land; they do not command it."
    >
      {tree.offices.map((office) => (
        <OfficeCard key={office.territory.id} office={office} {...props} />
      ))}
      {tree.offices.length === 0 && (
        <p className="ct-none">No office stands. The household has no crafts of its own.</p>
      )}
      <form
        className="wt-card ct-found"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          census.found({ name: name.trim(), kind: 'office' });
          setName('');
        }}
      >
        <input
          className="wt-textin"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Found another office…"
          aria-label="New office's name"
        />
        <button type="submit" className="wt-go" disabled={!name.trim()}>
          Found
        </button>
      </form>
    </Section>
  );
}

// ── ③ The land: knights and lords ───────────────────────────────────────────

function FiefCard({ fief, kingdom, census, court }: { fief: FiefCourtReading } & Props) {
  const nav = useNav();
  return (
    <div className="wt-card ct-house">
      <div className="ct-house-h">
        <InlineLink onClick={() => nav.goToTerritory(fief.territory.id)}>
          <b className="ct-house-n">{fief.territory.name}</b>
        </InlineLink>
        <span className={`ct-tag ct-st-${fief.state}`}>{FIEF_STATE_LABEL[fief.state]}</span>
      </div>

      {fief.lord && fief.grant ? (
        <Subject
          person={fief.lord}
          role="Lord · the group's lead"
          tone="seat"
          onStrike={{ label: 'unseat', act: () => court.revoke(fief.grant!.id) }}
        />
      ) : fief.keeper ? (
        <Subject
          person={fief.keeper}
          role="Keeper · holds it for an absent lord"
          tone="seat"
          extra={
            <Seat
              label="Grant it a lord…"
              verb="Grant"
              people={seatable(kingdom)}
              onAct={(id) => court.grant(fief.territory.id, id, 'lord')}
            />
          }
        />
      ) : (
        <Vacancy what="No lord holds this land. It falls to the Regent's desk.">
          <Seat
            label="Grant it a lord…"
            verb="Grant"
            people={seatable(kingdom)}
            onAct={(id) => court.grant(fief.territory.id, id, 'lord')}
          />
        </Vacancy>
      )}

      <div className="ct-branch">
        <div className="ct-branch-t">
          Its knights{fief.knights.length > 0 ? ` · ${fief.knights.length}` : ''}
        </div>
        {fief.knights.map((k) => (
          <div key={k.fealty.id}>
            <Subject
              person={k.person}
              role="Knight · pledged to this fief"
              onStrike={{ label: 'release', act: () => court.revoke(k.fealty.id) }}
            />
            <div className="ct-branch ct-deep">
              {k.squires.map((s) => (
                <Subject
                  key={s.id}
                  person={s}
                  role={`Squire · pledged to ${k.person.name}`}
                  tone="hand"
                  onStrike={{ label: 'strike', act: () => census.strike(s.id) }}
                />
              ))}
              <DubSquire knight={k.person} census={census} />
            </div>
          </div>
        ))}
        {fief.knights.length === 0 && (
          <p className="ct-none">No knight is pledged here yet.</p>
        )}
        <Seat
          label="Swear a knight to this fief…"
          verb="Swear"
          people={knightable(kingdom)}
          onAct={(id) => court.swear(fief.territory.id, id)}
        />
      </div>

      {(fief.garrison.length > 0 || fief.hamlets.length > 0) && (
        <div className="ct-branch">
          <div className="ct-branch-t">Working the land</div>
          {fief.garrison.map((g) => (
            <Subject
              key={g.posting.id}
              person={g.person}
              role="Artisan · stationed here"
              tone="hand"
              onStrike={{ label: 'end the station', act: () => court.revoke(g.posting.id) }}
            />
          ))}
          {fief.hamlets.map((h) => (
            <div className="ct-hamlet" key={h.territory.id}>
              <InlineLink onClick={() => nav.goToTerritory(h.territory.id)}>
                {h.territory.name}
              </InlineLink>
              <span className="ct-note">
                {h.mayor ? `Mayored by ${h.mayor.name}` : 'Garrisoned — no local lead'}
              </span>
              <button
                className="wt-go ct-quiet"
                onClick={() => census.promote(h.territory.id)}
                title="A hamlet grown into a fief of its own"
              >
                promote
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A squire pledges to a PERSON, not a fief, and is seated where their knight
 *  stands. So the act to make one belongs under that knight and nowhere else. */
function DubSquire({ knight, census }: { knight: Person; census: CensusActions }) {
  const [name, setName] = useState('');
  return (
    <form
      className="ct-seat"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        census.enroll({
          name: name.trim(),
          pledge: 'squire',
          pledgedTo: knight.id,
          note: `An agent in training under ${knight.name}.`,
        });
        setName('');
      }}
    >
      <input
        className="wt-textin"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={`Take a squire under ${knight.name}…`}
        aria-label={`New squire pledged to ${knight.name}`}
      />
      <button type="submit" className="wt-go" disabled={!name.trim()}>
        Take
      </button>
    </form>
  );
}

function LandSection(props: Props & { tree: CourtTree }) {
  const { tree, census, court, kingdom } = props;
  const [name, setName] = useState('');
  const lordless = tree.fiefs.filter((f) => !f.lord).length;
  return (
    <Section
      numeral="III"
      title="Knights and lords"
      count={`${tree.fiefs.length} ${plural(tree.fiefs.length, 'fief', 'fiefs')}${
        lordless ? ` · ${lordless} lordless` : ''
      }`}
      hint="A fief is a group's book of doors — both a place on the map and an org unit. Only agents rise through the land: a lord leads the group, knights pledge to the fief, and squires pledge to a knight personally and stand in that knight's fief. Knights answer to their liege lord, who answers to the King. This is not a downline — it is a brokerage's groups and their leads."
    >
      {tree.fiefs.map((fief) => (
        <FiefCard key={fief.territory.id} fief={fief} {...props} />
      ))}
      {tree.fiefs.length === 0 && (
        <div className="wt-card ct-empty">
          <p>
            <b>No fief stands.</b> The realm has no groups until the Regent founds them — an
            empty land read honestly as debt is the gauge working, not a gap.
          </p>
        </div>
      )}

      <form
        className="wt-card ct-found"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          census.found({ name: name.trim(), kind: 'fief' });
          setName('');
        }}
      >
        <input
          className="wt-textin"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Found a fief…"
          aria-label="New fief's name"
        />
        <button type="submit" className="wt-go" disabled={!name.trim()}>
          Found
        </button>
      </form>

      {tree.unseated.length > 0 && (
        <div className="wt-card ct-adrift">
          <div className="ct-house-h">
            <b className="ct-house-n">Standing nowhere</b>
            <span className="ct-tag ct-tag-bad">{tree.unseated.length}</span>
          </div>
          <Explain className="wt-fine">
            Enrolled, but in no office and no fief. Not an error — delegation debt in person
            form, and it has to be visible to be fixed.
          </Explain>
          {tree.unseated.map((p) => (
            <Subject
              key={p.id}
              person={p}
              onStrike={{ label: 'strike', act: () => census.strike(p.id) }}
              extra={
                <SeatSomewhere person={p} kingdom={kingdom} court={court} />
              }
            />
          ))}
        </div>
      )}
    </Section>
  );
}

/** Give an adrift subject a place without leaving the row they are adrift in. */
function SeatSomewhere({
  person,
  kingdom,
  court,
}: {
  person: Person;
  kingdom: Kingdom;
  court: CourtActions;
}) {
  const [where, setWhere] = useState('');
  const places = kingdom.territories.filter((t) => t.kind === 'office' || t.kind === 'fief');
  if (places.length === 0) return null;
  return (
    <form
      className="ct-seat"
      onSubmit={(e) => {
        e.preventDefault();
        if (!where) return;
        court.swear(where, person.id);
        setWhere('');
      }}
    >
      <select
        className="wt-select"
        value={where}
        onChange={(e) => setWhere(e.target.value)}
        aria-label={`Seat ${person.name}`}
      >
        <option value="">Seat them…</option>
        {places.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button type="submit" className="wt-go" disabled={!where}>
        Seat
      </button>
    </form>
  );
}

// ── ④ The guilds and their artisans ─────────────────────────────────────────

function GuildsSection({ tree, kingdom, census, court }: Props & { tree: CourtTree }) {
  const [name, setName] = useState('');
  const [trade, setTrade] = useState('');
  const artisanCount = hands(kingdom).length;
  return (
    <Section
      numeral="IV"
      title="The guilds"
      count={`${tree.trades.length} · ${artisanCount} ${artisanCount === 1 ? 'artisan' : 'artisans'}`}
      hint="A guild is a trade OUTSIDE the household — the roofers, the lenders, the lawyers. The Crown does not staff them and does not hold them. Artisans are their hands: they work the land, they can even keep it, they can never hold it. A guild carries no record of its own yet, so these are folded from what each artisan's note names."
    >
      {tree.trades.map((g) => (
        <div className="wt-card ct-house" key={g.id}>
          <div className="ct-house-h">
            <b className="ct-house-n">{g.name}</b>
            <span className="ct-tag">
              {g.artisans.length} {g.artisans.length === 1 ? 'hand' : 'hands'}
            </span>
          </div>
          <div className="ct-branch">
            {g.artisans.map((a) => (
              <Subject
                key={a.id}
                person={a}
                role="Artisan"
                tone="hand"
                onStrike={{ label: 'strike', act: () => census.strike(a.id) }}
                extra={<Station person={a} kingdom={kingdom} court={court} />}
              />
            ))}
          </div>
        </div>
      ))}

      {tree.unaffiliated.length > 0 && (
        <div className="wt-card ct-house">
          <div className="ct-house-h">
            <b className="ct-house-n">Of no named trade</b>
            <span className="ct-tag">{tree.unaffiliated.length}</span>
          </div>
          <Explain className="wt-fine">
            Their note names no guild, so no guild can be read from it. Name the trade in their
            note and they gather with their own.
          </Explain>
          <div className="ct-branch">
            {tree.unaffiliated.map((a) => (
              <Subject
                key={a.id}
                person={a}
                role="Artisan"
                tone="hand"
                onStrike={{ label: 'strike', act: () => census.strike(a.id) }}
                extra={<Station person={a} kingdom={kingdom} court={court} />}
              />
            ))}
          </div>
        </div>
      )}

      {tree.trades.length === 0 && tree.unaffiliated.length === 0 && (
        <p className="ct-none">No outside trade serves the realm.</p>
      )}

      <form
        className="wt-card ct-found"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          census.enroll({
            name: name.trim(),
            pledge: 'sellsword',
            // The trade rides the note, because that is where the fold reads it
            // from. Say it in the kingdom's own words so the guild names itself.
            note: trade.trim() ? `The ${trade.trim().replace(/^the\s+/i, '')} guild.` : undefined,
          });
          setName('');
          setTrade('');
        }}
      >
        <input
          className="wt-textin"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Take on an artisan…"
          aria-label="Artisan's name"
        />
        <input
          className="wt-textin"
          value={trade}
          onChange={(e) => setTrade(e.target.value)}
          placeholder="of the … guild (roofers, lenders)"
          aria-label="Their guild"
        />
        <button type="submit" className="wt-go" disabled={!name.trim()}>
          Take on
        </button>
      </form>
    </Section>
  );
}

/** An artisan works the land; stationing them is a posting, never authority. */
function Station({
  person,
  kingdom,
  court,
}: {
  person: Person;
  kingdom: Kingdom;
  court: CourtActions;
}) {
  const [where, setWhere] = useState('');
  const places = kingdom.territories.filter((t) => t.kind !== 'hamlet');
  if (places.length === 0) return null;
  return (
    <form
      className="ct-seat"
      onSubmit={(e) => {
        e.preventDefault();
        if (!where) return;
        court.post(where, person.id);
        setWhere('');
      }}
    >
      <select
        className="wt-select"
        value={where}
        onChange={(e) => setWhere(e.target.value)}
        aria-label={`Station ${person.name}`}
      >
        <option value="">Station them…</option>
        {places.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button type="submit" className="wt-go" disabled={!where}>
        Station
      </button>
    </form>
  );
}

// ── The one door in ─────────────────────────────────────────────────────────

/** Enrolling somebody the four sections have no obvious home for. Kept last and
 *  plain: the shaped acts above are the ones to reach for, and this is the
 *  catch-all beneath them. */
function EnrollCard({ kingdom, census }: Omit<Props, 'court'>) {
  const [name, setName] = useState('');
  const [pledge, setPledge] = useState<PledgeType>('vassal');
  const [pledgedTo, setPledgedTo] = useState('');
  const [note, setNote] = useState('');
  return (
    <div className="wt-card">
      <h3>Enroll a subject</h3>
      <Explain className="wt-fine">
        The plain door into the census, for anyone the sections above have no seat for yet. They
        will read as standing nowhere until they are seated — which is the point.
      </Explain>
      <Explain className="wt-fine">{PLEDGE_HINT[pledge]}</Explain>
      <form
        className="wt-actline"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          census.enroll({
            name: name.trim(),
            pledge,
            pledgedTo: pledge === 'squire' ? pledgedTo : undefined,
            note: note.trim() || undefined,
          });
          setName('');
          setPledgedTo('');
          setNote('');
        }}
      >
        <input
          className="wt-textin"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          aria-label="Person's name"
        />
        <select
          className="wt-select"
          value={pledge}
          onChange={(e) => setPledge(e.target.value as PledgeType)}
          aria-label="Pledge"
        >
          {PLEDGE_ORDER.map((p) => (
            <option key={p} value={p}>
              {PLEDGE_LABEL[p]}
            </option>
          ))}
        </select>
        {pledge === 'squire' && (
          <select
            className="wt-select"
            value={pledgedTo}
            onChange={(e) => setPledgedTo(e.target.value)}
            aria-label="Pledged to"
          >
            <option value="">Pledged to…</option>
            {kingdom.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <input
          className="wt-textin"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          aria-label="Note"
        />
        <button
          type="submit"
          className="wt-go"
          disabled={!name.trim() || (pledge === 'squire' && !pledgedTo)}
        >
          Enroll
        </button>
      </form>
    </div>
  );
}

// ── The census ──────────────────────────────────────────────────────────────

export default function CensusView(props: Props) {
  const tree = readCourtTree(props.kingdom);
  const headless = tree.offices.filter((o) => !o.chancellor).length;
  const adrift = tree.unseated.length;
  return (
    <div className="ct">
      <div className="wt-stats">
        <Stat n={props.kingdom.people.length} label="Souls" />
        <Stat
          n={tree.offices.length}
          label={plural(tree.offices.length, 'Office', 'Offices')}
          tone={headless ? 'bad' : 'good'}
        />
        <Stat n={tree.fiefs.length} label={plural(tree.fiefs.length, 'Fief', 'Fiefs')} />
        <Stat n={tree.trades.length} label={plural(tree.trades.length, 'Guild', 'Guilds')} />
        <Stat n={adrift} label="Standing nowhere" tone={adrift ? 'warn' : 'good'} />
      </div>

      <CrownSection tree={tree} kingdom={props.kingdom} census={props.census} />
      <OfficesSection tree={tree} {...props} />
      <LandSection tree={tree} {...props} />
      <GuildsSection tree={tree} {...props} />
      <EnrollCard kingdom={props.kingdom} census={props.census} />
    </div>
  );
}

function Stat({
  n,
  label,
  tone,
}: {
  n: number | string;
  label: string;
  tone?: 'good' | 'warn' | 'bad';
}) {
  return (
    <div className="wt-stat">
      <div className={`wt-stat-n wt-num${tone ? ` ${tone}` : ''}`}>{n}</div>
      <div className="wt-lbl">{label}</div>
    </div>
  );
}
