/**
 * THE MAP — the realm drawn as an illustrated table, and wired to the records.
 *
 * This replaces the live three.js scene (`src/realm/RealmView.tsx`). Edwin's
 * call, 2026-07-28: *"I would love illustrated 2.5D we don't need 3d at all."*
 * The browser composites flat art; it runs no 3D scene. What it draws was
 * proven first as a baked artifact (`docs/frames/flat-proving-frame.html`) —
 * that frame was a handsome picture whose buttons were demonstrations, because
 * nothing in it could read the chronicle. This is the same drawing, computed in
 * the app, over the doors the chronicle actually holds.
 *
 * The firewall holds exactly as before: this view is a pure function of
 * `RealmScene` and the handlers it is given. It computes no kingdom state,
 * imports nothing from `src/domain`, and stores nothing.
 *
 * A/E/P, walked:
 *   A — every piece is a button: pointer, keyboard, an aria-label naming the
 *       door and its standing, and only the BUILDING takes the hit (the shadow
 *       ellipse and the focus rings are `pointer-events:none`, which is what
 *       made aiming at a house select its neighbour). The block's ground and
 *       the knight's banner are doors to the fief; the Crown's seat is a door
 *       to the Throne.
 *   E — one click from seeing a holding to opening it; the acts stand in the
 *       inspector beside the record, never a surface away.
 *   P — the inspector shows the standing AND the acts on that standing, so no
 *       control is ever offered that would do nothing.
 *
 * The command bar the old map carried is GONE (Edwin, 2026-07-29: "the council
 * button is redundant to the council panel"). Every one of its four buttons —
 * The Muster, The Chronicle, The Coffers, The Council — is already a door in
 * the app's own header and rail, standing on screen at the same moment. Two
 * controls for one act is worse than one, and "Council" now means exactly one
 * thing again: the heralds under the ⚑, not the bench of Chancellors.
 */

import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import type { RealmHandlers, RealmScene } from '../realm/scene';
import { AdvisorRail, CoffersCartouche, WarHornCall } from '../realm/Chrome';
import '../realm/realm.css';
import { fantasyRelief } from './fantasyRelief';
import { copseOf, fitTransform, terrainOf, MAP } from './flatMap';
import type { TerrainGeometry } from './flatMap';
import { CONDITION, STANDING, layoutTable, onOpenGround } from './tableScene';
import type { TableBlock, TablePiece } from './tableScene';
import './flatmap.css';

const W = 1600;
const H = 1000;

/** The realm's own ground. One seed, one land, forever — and computed ONCE for
 *  the life of the module, not once per mount: it costs ~100ms and it can never
 *  change, since the land is not a thing the chronicle holds. */
let TERRAIN: TerrainGeometry | null = null;
function terrain(): TerrainGeometry {
  if (!TERRAIN) {
    const relief = fantasyRelief({ seed: 'the-realm', side: 150 });
    TERRAIN = terrainOf({
      grid: Array.from({ length: relief.w * relief.h }, (_, i) =>
        relief.cell(i % relief.w, Math.floor(i / relief.w)),
      ),
      side: relief.w,
      seaLevel: relief.seaLevel,
      rivers: relief.rivers,
    });
  }
  return TERRAIN;
}

export type FlatMapViewProps = { scene: RealmScene } & RealmHandlers;

export function FlatMapView({
  scene,
  onSelectFief,
  onSelectBuilding,
  onSelectGuild,
  onSelectCapital,
  onSelectUnheld,
  onDeployMuster,
}: FlatMapViewProps) {
  const ground = terrain();
  const layout = useMemo(() => layoutTable(scene), [scene]);
  const [selected, setSelected] = useState<string | null>(null);

  const fit = useMemo(
    () =>
      fitTransform(
        layout.pieces.length
          ? [...layout.pieces, layout.capital, ...layout.banners]
          : [
              { x: 0, y: 0 },
              { x: MAP, y: MAP },
            ],
        { w: W, h: H },
      ),
    [layout],
  );

  // The doors' real y extent, so the depth gradient is spent where the pieces
  // actually are. Spread across the whole 0..1000 map it was spent mostly on
  // empty ground and moved a piece by less than a pixel.
  const [dy0, dys] = useMemo(() => {
    if (!layout.pieces.length) return [0, 1];
    const ys = layout.pieces.map((p) => p.y);
    const lo = Math.min(...ys);
    return [lo, Math.max(1, Math.max(...ys) - lo)];
  }, [layout]);

  const copses = useMemo(
    () => ground.copseSites.filter((s) => onOpenGround(s, layout.blocks, layout.capital)).slice(0, 46),
    [ground, layout],
  );

  const piece = selected ? layout.pieces.find((p) => p.doorId === selected) ?? null : null;
  const pieceBlock = piece ? layout.blocks[piece.block] : null;

  // ── The survey glass: pan and zoom ──────────────────────────────────────
  // Not decoration. At 390px a piece is four pixels across, and a map you
  // cannot read is a map you cannot act on.
  const [view, setView] = useState({ z: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const clamp = (v: { z: number; x: number; y: number }) => {
    const span = ((v.z - 1) / v.z) * 0.5;
    return {
      z: v.z,
      x: Math.max(-span * W, Math.min(span * W, v.x)),
      y: Math.max(-span * H, Math.min(span * H, v.y)),
    };
  };
  const zoomBy = (k: number) =>
    setView((v) => clamp({ ...v, z: Math.max(1, Math.min(6, v.z * k)) }));
  const onKeyDownBoard = (e: { key: string }) => {
    if (e.key === 'Escape') setSelected(null);
  };
  const onWheel = (e: ReactWheelEvent<SVGSVGElement>) => {
    if (!scene.revealed) return;
    zoomBy(e.deltaY < 0 ? 1.16 : 1 / 1.16);
  };
  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (view.z <= 1) return;
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const kx = W / Math.max(1, rect.width);
    const ky = H / Math.max(1, rect.height);
    setView((v) => clamp({ ...v, x: d.vx + (e.clientX - d.x) * kx, y: d.vy + (e.clientY - d.y) * ky }));
  };
  const endDrag = () => {
    drag.current = null;
  };
  const viewBox = `${-view.x / view.z + (W * (view.z - 1)) / (2 * view.z)} ${
    -view.y / view.z + (H * (view.z - 1)) / (2 * view.z)
  } ${W / view.z} ${H / view.z}`;

  // Clicking a piece SELECTS it and nothing else. It used to select AND open
  // the door's work in one motion, which meant the board left the screen in
  // the same frame the inspector appeared — so the record and its acts were
  // never actually seen, and choosing between them was impossible. Found by
  // driving it: fourteen aimed clicks, fourteen inspectors nobody could read.
  // The act is the act; the click is the look.
  const open = (p: TablePiece) => setSelected(p.doorId);

  return (
    <div className={`fm-root${piece ? " fm-root--inspecting" : ""}`}>
      <svg
        className="fm-frame"
        viewBox={viewBox}
        role="group"
        aria-label={
          scene.revealed
            ? `The map of ${scene.realmName}: ${layout.pieces.length} doors across ${layout.blocks.length} fiefs.`
            : `The map of ${scene.realmName}, unrevealed — no muster stands.`
        }
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onKeyDown={onKeyDownBoard}
        style={{ cursor: view.z > 1 ? 'grab' : 'default' }}
      >
        <Defs />

        {/* ── the table the board is set down on ── */}
        <rect width={W} height={H} fill="url(#fm-wood)" />
        <rect width={W} height={H} filter="url(#fm-woodDark)" opacity="0.62" />
        <rect width={W} height={H} filter="url(#fm-woodLight)" opacity="0.34" />
        <rect width={W} height={H} fill="url(#fm-sheen)" />

        <g transform={fit.transform}>
          {/* the shadow the board casts on the table, then its brass trim */}
          <rect
            x={-8}
            y={-8}
            width={MAP + 16}
            height={MAP + 16}
            rx={5}
            transform="translate(10 14)"
            fill="#120B06"
            opacity="0.6"
            filter="url(#fm-soft)"
          />
          <rect x={-13} y={-13} width={MAP + 26} height={MAP + 26} rx={7} fill="#1E1108" />
          <rect
            x={-11.5}
            y={-11.5}
            width={MAP + 23}
            height={MAP + 23}
            rx={6}
            fill="none"
            stroke="url(#fm-brass)"
            strokeWidth={3}
          />

          <g clipPath="url(#fm-boardClip)">
            <rect x={-8} y={-8} width={MAP + 16} height={MAP + 16} fill={ground.baseFill} />
            <g filter="url(#fm-rough)">
              {ground.bands.map((b, i) => (
                <path key={`band${i}`} d={b.d} fill={b.fill} fillRule="evenodd" />
              ))}
              <path d={ground.contours} fill="none" stroke="#1D311D" strokeOpacity={0.45} strokeWidth={1.25} />
              <path
                d={ground.hachures}
                fill="none"
                stroke="#1B2E1B"
                strokeOpacity={0.3}
                strokeWidth={1.2}
                strokeLinecap="round"
              />
              {ground.rivers.map((r, i) => (
                <path key={`rs${i}`} d={r.body} transform="translate(1.6 2)" fill="#17251A" fillOpacity={0.55} />
              ))}
              {ground.rivers.map((r, i) => (
                <path key={`rb${i}`} d={r.body} fill="#22304A" />
              ))}
              {ground.rivers.map((r, i) => (
                <path
                  key={`rc${i}`}
                  d={r.core}
                  fill="none"
                  stroke="#41567C"
                  strokeOpacity={0.55}
                  strokeWidth={1.6}
                  transform="translate(-0.7 -0.8)"
                />
              ))}

              {/* the surveyed ground — only HELD land is subdivided; the rest
                  stays open country, which is true rather than decorative */}
              {scene.revealed &&
                layout.blocks.map((b) => (
                  <Survey
                    key={b.fiefId}
                    block={b}
                    onOpen={() => onSelectFief(b.fiefId)}
                    dim={!!piece && piece.fiefId !== b.fiefId}
                  />
                ))}

              {scene.revealed &&
                copses.map((s, i) => {
                  const { blobs, spread } = copseOf(s.seed);
                  return (
                    <g key={`copse${i}`} transform={`translate(${s.x.toFixed(0)} ${s.y.toFixed(0)})`}>
                      <ellipse
                        cx={2.6}
                        cy={2}
                        rx={spread + 1}
                        ry={(spread + 1) * 0.34}
                        fill="#17251A"
                        opacity={0.26}
                      />
                      {blobs.map((b, j) => (
                        <g key={j}>
                          <circle cx={b.x} cy={b.y} r={b.r} fill="#2A4128" stroke="#1B2E1B" strokeOpacity={0.5} strokeWidth={0.6} />
                          <circle cx={b.x - b.r * 0.32} cy={b.y - b.r * 0.36} r={b.r * 0.52} fill="#44603A" opacity={0.85} />
                        </g>
                      ))}
                    </g>
                  );
                })}
            </g>
            <rect x={-8} y={-8} width={MAP + 16} height={MAP + 16} filter="url(#fm-grainDark)" opacity={0.5} />
            <rect x={-8} y={-8} width={MAP + 16} height={MAP + 16} filter="url(#fm-grainLight)" opacity={0.22} />
            <rect
              x={-4}
              y={-4}
              width={MAP + 8}
              height={MAP + 8}
              rx={4}
              fill="none"
              stroke="#17251A"
              strokeOpacity={0.5}
              strokeWidth={14}
            />
          </g>

          {scene.revealed && (
            <>
              {/* The Crown's own seat, north of the shire it surveys. */}
              <g
                className="fm-piece fm-capital"
                tabIndex={0}
                role="button"
                aria-label={`${layout.capital.name}'s seat — the Throne`}
                transform={`translate(${layout.capital.x.toFixed(1)} ${layout.capital.y.toFixed(1)})`}
                onClick={onSelectCapital}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectCapital();
                  }
                }}
              >
                <title>{`${layout.capital.name}'s seat — the Throne`}</title>
                <ellipse className="fm-ring2" cy={-22} rx={40} ry={34} fill="none" stroke="#141A24" strokeWidth={5} />
                <ellipse className="fm-ring" cy={-22} rx={40} ry={34} fill="none" stroke="#F3EDDC" strokeWidth={2.4} />
                <use href="#fm-keep" />
                <text className="fm-capname" y={16} textAnchor="middle">
                  {layout.capital.name}
                </text>
              </g>

              {/* THE PLOTS — each piece's parcel, as its hit target.
                  Aiming at a house and selecting its neighbour is a fault this
                  board has now shipped twice, and pitch-tuning only ever moved
                  it around: pieces in a dense town OVERLAP, which is what makes
                  it read as a town, and whichever is drawn in front takes the
                  click on the shared pixels. The parcels do not overlap — they
                  tile, exactly, by construction — so every holding owns one
                  rectangle of ground that is unambiguously its own, and a
                  finger on a phone has a target it can actually hit. The glyphs
                  still draw on top, so pointing at a roof you can SEE still
                  picks that roof.

                  Measured on a 60-door muster: every piece reachable by its own
                  glyph (60/60) and every piece owning a whole parcel besides.
                  Two of sixty are occluded at their exact geometric centre by a
                  neighbour standing in front — and clicking there correctly
                  selects the neighbour, because the neighbour is what is drawn
                  at that pixel. That is the town reading as a town, not a
                  fault; the fault would be a piece with nowhere to click. */}
              <g className="fm-plots">
                {layout.pieces.map((p) => {
                  const b = layout.blocks[p.block];
                  return (
                    <rect
                      key={p.doorId}
                      x={b.x + p.col * b.pitchX}
                      y={b.y + p.row * b.pitchY}
                      width={b.pitchX}
                      height={b.pitchY}
                      fill="none"
                      pointerEvents="all"
                      onClick={() => open(p)}
                    />
                  );
                })}
              </g>

              {/* The pieces. North (small y) is the far edge, so a piece draws
                  later — and therefore wins the hit test — as it comes forward. */}
              <g>
                {[...layout.pieces]
                  .sort((a, b) => a.y - b.y)
                  .map((p) => (
                    <Piece
                      key={p.doorId}
                      piece={p}
                      depth={0.78 + 0.44 * ((p.y - dy0) / dys)}
                      selected={p.doorId === selected}
                      onOpen={() => open(p)}
                      onShow={() => setSelected(p.doorId)}
                    />
                  ))}
              </g>

              {/* The banners — a knight over their own fellowship's ground. */}
              <g>
                {layout.banners.map((b) => {
                  const block = layout.blocks.find((x) => x.fiefId === b.fiefId)!;
                  const label = `${b.name}${b.seatLabel ? ` — ${b.seatLabel}` : ''}: ${block.doors} doors, ${CONDITION[b.health]}${
                    block.crises ? `, ${block.crises} in crisis` : ''
                  }`;
                  return (
                    <g
                      key={b.fiefId}
                      className={`fm-piece fm-banner fm-h-${b.health}`}
                      tabIndex={0}
                      role="button"
                      aria-label={label}
                      transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) rotate(${(b.lean * 120).toFixed(1)})`}
                      onClick={() => onSelectFief(b.fiefId)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectFief(b.fiefId);
                        }
                      }}
                    >
                      <title>{label}</title>
                      <circle className="fm-ring2" cy={-30} r={26} fill="none" stroke="#171D2C" strokeWidth={4} />
                      <circle className="fm-ring" cy={-30} r={26} fill="none" stroke="#F0D68C" strokeWidth={2.2} />
                      <use href="#fm-banner" />
                    </g>
                  );
                })}
              </g>
            </>
          )}
        </g>

        <rect width={W} height={H} fill="url(#fm-vig)" pointerEvents="none" />
      </svg>

      {/* ── The chrome over the board ── */}
      {scene.revealed ? (
        <>
          <AdvisorRail guilds={scene.guilds} onSelectGuild={onSelectGuild} />
          <CoffersCartouche coffers={scene.coffers} />
          {/* What the board CANNOT show. A fief is a knight's book of doors, so
              a door in nobody's care has no town to stand in and is simply not
              drawn — on a fresh muster that is most of the operation. A map
              that looks complete while showing a third of the realm is a lying
              instrument, and a lying instrument is worse than none. So it says
              the number, and the number is a door to the act that fixes it. */}
          {scene.unheld.doors > 0 && (
            <button type="button" className="fm-unheld" onClick={onSelectUnheld}>
              <span className="fm-unheld__full">
                <b>{scene.unheld.doors}</b> door{scene.unheld.doors === 1 ? '' : 's'} stand
                {scene.unheld.doors === 1 ? 's' : ''} in no knight&rsquo;s care — not drawn here.
                <span className="fm-unheld__go">
                  Place {scene.unheld.owners === 1 ? 'the owner' : 'the owners'} →
                </span>
              </span>
              {/* On a phone the same truth in four words: any wider band across
                  a 390px board covers the very pieces it is talking about, and
                  measurement said so plainly — fourteen of fourteen aimed
                  clicks hit the note instead of the town. */}
              <span className="fm-unheld__brief">
                <b>{scene.unheld.doors}</b> doors adrift →
              </span>
            </button>
          )}
          <div className="fm-glass" role="group" aria-label="The survey glass">
            <button type="button" onClick={() => zoomBy(1.4)} aria-label="Look closer" title="Look closer">
              +
            </button>
            <button type="button" onClick={() => zoomBy(1 / 1.4)} aria-label="Draw back" title="Draw back">
              −
            </button>
            {view.z > 1 && (
              <button
                type="button"
                className="fm-glass__reset"
                onClick={() => setView({ z: 1, x: 0, y: 0 })}
                title="The whole survey"
              >
                whole
              </button>
            )}
          </div>
          {piece && pieceBlock && (
            <Inspector
              piece={piece}
              block={pieceBlock}
              onClose={() => setSelected(null)}
              onOpenDoor={() => onSelectBuilding(piece.fiefId, piece.doorId)}
              onOpenFief={() => onSelectFief(piece.fiefId)}
            />
          )}
        </>
      ) : (
        <WarHornCall onDeployMuster={onDeployMuster} />
      )}
    </div>
  );
}

// ── A holding's surveyed ground ────────────────────────────────────────────

/** A fellowship's block: the cleared land it occupies, drawn as the parcels it
 *  actually holds. The ground is a door to the fief — a row that NAMES a thing
 *  is a door to that thing, and the block names the knight's whole country. */
function Survey({ block, onOpen, dim }: { block: TableBlock; onOpen: () => void; dim: boolean }) {
  const lines = [];
  for (let c = 1; c < block.cols; c++) {
    const x = block.x + c * block.pitchX;
    lines.push(<path key={`c${c}`} d={`M${x.toFixed(1)} ${block.y.toFixed(1)}V${(block.y + block.h).toFixed(1)}`} />);
  }
  for (let r = 1; r < block.rows; r++) {
    const y = block.y + r * block.pitchY;
    lines.push(<path key={`r${r}`} d={`M${block.x.toFixed(1)} ${y.toFixed(1)}H${(block.x + block.w).toFixed(1)}`} />);
  }
  return (
    <g className={`fm-survey${dim ? ' fm-survey--dim' : ''}`} onClick={onOpen}>
      <title>{`${block.name}'s fellowship — ${block.doors} doors`}</title>
      <rect
        x={block.x - 2.5}
        y={block.y - 2.5}
        width={block.w + 5}
        height={block.h + 5}
        rx={2}
        fill="#4C5F3A"
        fillOpacity={0.85}
        stroke="#1B2E1B"
        strokeOpacity={0.8}
        strokeWidth={1.6}
      />
      <g stroke="#1B2E1B" strokeOpacity={0.75} strokeWidth={0.9} fill="none">
        {lines}
      </g>
    </g>
  );
}

// ── One piece ──────────────────────────────────────────────────────────────

const GLYPH: Record<TablePiece['kind'], { href: string; r: number }> = {
  cottage: { href: '#fm-cottage', r: 13 },
  house: { href: '#fm-house', r: 14 },
  wide: { href: '#fm-wide', r: 18 },
  chapel: { href: '#fm-chapel', r: 14 },
};

function Piece({
  piece,
  depth,
  selected,
  onOpen,
  onShow,
}: {
  piece: TablePiece;
  depth: number;
  selected: boolean;
  onOpen: () => void;
  onShow: () => void;
}) {
  const g = GLYPH[piece.kind];
  const label = `${piece.label} — ${STANDING[piece.state]}`;
  // The ring sits on the PIECE, not on the ground under it: the glyph is drawn
  // upward from its base, so a ring centred on the origin left the roof outside
  // it and its lower third over bare grass.
  const cy = -g.r * 0.52;
  return (
    <g
      className={`fm-piece fm-door fm-st-${piece.state}${selected ? ' fm-sel' : ''}`}
      tabIndex={0}
      role="button"
      aria-label={label}
      transform={`translate(${piece.x.toFixed(1)} ${piece.y.toFixed(1)}) rotate(${(piece.lean * 140).toFixed(1)}) scale(${(
        (0.74 + piece.tone * 0.12) *
        depth
      ).toFixed(3)})`}
      onClick={onOpen}
      onFocus={onShow}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <title>{label}</title>
      <ellipse className="fm-ring2" cy={cy} rx={g.r + 2} ry={(g.r + 2) * 0.82} fill="none" stroke="#141A24" strokeWidth={4.5} />
      <ellipse className="fm-ring" cy={cy} rx={g.r + 2} ry={(g.r + 2) * 0.82} fill="none" stroke="#F3EDDC" strokeWidth={2.2} />
      <use href={g.href} />
    </g>
  );
}

// ── The inspector ──────────────────────────────────────────────────────────

/**
 * Design law 6, drawn: the act stands beside the record it changes. Selecting a
 * holding shows its record AND what can be done about it, on one surface — a
 * surface that reports a state and makes you navigate elsewhere to change it
 * has failed.
 *
 * Every act here is a REAL road. The proving frame's inspector offered "Begin
 * the make-ready turn" and "Raise the fallen holding" and answered both with
 * "proposed, awaiting the Regent" — a demonstration, and precisely the dead
 * button the A/E/P check exists to catch. The app has no such acts on a door,
 * so they are not offered. What it has is roads, and those are given.
 */
function Inspector({
  piece,
  block,
  onClose,
  onOpenDoor,
  onOpenFief,
}: {
  piece: TablePiece;
  block: TableBlock;
  onClose: () => void;
  onOpenDoor: () => void;
  onOpenFief: () => void;
}) {
  // The one road off the map that leads to the WORK, and it is offered only
  // when there is work to reach. The proving frame offered "Begin the
  // make-ready turn" on every empty door and answered it with a sentence — a
  // demonstration, and exactly the dead button the A/E/P check exists to catch.
  const work = piece.openCase
    ? piece.state === 'crisis'
      ? 'Answer what presses →'
      : 'Open its standing work →'
    : null;
  return (
    <aside className="fm-inspector" role="region" aria-live="polite" aria-label="The selected holding">
      <button className="fm-inspector__close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <h2>{piece.label}</h2>
      <div className="fm-inspector__kind">{piece.kind === 'wide' ? 'wide holding' : piece.kind}</div>
      <dl>
        <dt>Standing</dt>
        <dd>{STANDING[piece.state]}</dd>
        <dt>Fellowship</dt>
        <dd>{block.name}</dd>
        <dt>Parcel</dt>
        <dd>{`col ${piece.col + 1} · row ${piece.row + 1}`}</dd>
        <dt>The fief</dt>
        <dd>{`${block.held}/${block.doors} held · ${CONDITION[block.health]}`}</dd>
      </dl>
      <div className="fm-inspector__acts">
        {work ? (
          <button className={piece.state === 'crisis' ? 'fm-alarm' : ''} onClick={onOpenDoor}>
            {work}
          </button>
        ) : (
          <p className="fm-inspector__none">Nothing stands open on this door.</p>
        )}
        <button onClick={onOpenFief}>{`${block.name}'s fief →`}</button>
      </div>
    </aside>
  );
}

// ── The defs: the kit, the light, the wood ─────────────────────────────────
//
// One sun, upper left; every shadow falls south-east and none is longer than
// the thing casting it. Red is spent ONLY on distress (the hue law,
// src/table/palette.ts) — a pennant flies on a door in crisis and nowhere else.

function Defs() {
  return (
    <defs>
      <linearGradient id="fm-wood" x1="0" y1="0" x2="0.25" y2="1">
        <stop offset="0" stopColor="#4A2E1C" />
        <stop offset="0.45" stopColor="#3A2413" />
        <stop offset="1" stopColor="#2A180B" />
      </linearGradient>
      <radialGradient id="fm-sheen" cx="0.3" cy="0.22" r="0.75">
        <stop offset="0" stopColor="#F3EDDC" stopOpacity="0.12" />
        <stop offset="0.55" stopColor="#F3EDDC" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="fm-vig" cx="0.47" cy="0.44" r="0.75">
        <stop offset="0.5" stopColor="#0D111C" stopOpacity="0" />
        <stop offset="0.8" stopColor="#0D111C" stopOpacity="0.3" />
        <stop offset="1" stopColor="#0D111C" stopOpacity="0.66" />
      </radialGradient>
      <radialGradient id="fm-pieceShadow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#171D2C" stopOpacity="0.5" />
        <stop offset="0.6" stopColor="#171D2C" stopOpacity="0.3" />
        <stop offset="1" stopColor="#171D2C" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="fm-brass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#E5C069" />
        <stop offset="0.45" stopColor="#C9973B" />
        <stop offset="1" stopColor="#6B4C18" />
      </linearGradient>
      <linearGradient id="fm-flagBrass" x1="0" y1="0" x2="1" y2="0.3">
        <stop offset="0" stopColor="#E5C069" />
        <stop offset="0.6" stopColor="#C9973B" />
        <stop offset="1" stopColor="#8A6323" />
      </linearGradient>
      <radialGradient id="fm-bezel" cx="0.38" cy="0.34" r="0.75">
        <stop offset="0" stopColor="#F0D68C" />
        <stop offset="0.45" stopColor="#C9973B" />
        <stop offset="0.85" stopColor="#8A6323" />
        <stop offset="1" stopColor="#5E4415" />
      </radialGradient>

      <filter id="fm-woodDark" x="-2%" y="-2%" width="104%" height="104%">
        <feTurbulence type="fractalNoise" baseFrequency="0.0042 0.105" numOctaves="4" seed="11" result="t" />
        <feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3.4 0 0 0 -1.5" result="a" />
        <feFlood floodColor="#1E1108" result="fc" />
        <feComposite in="fc" in2="a" operator="in" />
      </filter>
      <filter id="fm-woodLight" x="-2%" y="-2%" width="104%" height="104%">
        <feTurbulence type="fractalNoise" baseFrequency="0.0037 0.09" numOctaves="4" seed="27" result="t" />
        <feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3 0 0 0 -1.8" result="a" />
        <feFlood floodColor="#7A5233" result="fc" />
        <feComposite in="fc" in2="a" operator="in" />
      </filter>
      <filter id="fm-grainDark" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="4" result="t" />
        <feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.4 1.4 0 0 -1.5" result="a" />
        <feFlood floodColor="#17251A" result="fc" />
        <feComposite in="fc" in2="a" operator="in" />
      </filter>
      <filter id="fm-grainLight" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" seed="14" result="t" />
        <feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.3 1.3 0 0 -1.55" result="a" />
        <feFlood floodColor="#D8CDB4" result="fc" />
        <feComposite in="fc" in2="a" operator="in" />
      </filter>
      <filter id="fm-rough" x="-4%" y="-4%" width="108%" height="108%">
        <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="3" seed="9" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <filter id="fm-soft" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="11" />
      </filter>

      <clipPath id="fm-boardClip">
        <rect x={-8} y={-8} width={MAP + 16} height={MAP + 16} rx={5} />
      </clipPath>

      {/* ── the kit ── */}
      <g id="fm-cottage">
        <ellipse cx="5.5" cy="1.3" rx="12" ry="3.9" fill="url(#fm-pieceShadow)" pointerEvents="none" />
        <rect x="-6.5" y="-8.5" width="13" height="8.5" style={{ fill: 'var(--w1)' }} stroke="#1E1108" strokeOpacity="0.28" strokeWidth="0.5" />
        <rect x="1.2" y="-8.5" width="5.3" height="8.5" style={{ fill: 'var(--w2)' }} />
        <path d="M-8 -8.2 L0 -15.5 L0 -8.2 Z" style={{ fill: 'var(--r1)' }} stroke="#1E1108" strokeOpacity="0.3" strokeWidth="0.5" />
        <path d="M0 -15.5 L8 -8.2 L0 -8.2 Z" style={{ fill: 'var(--r2)' }} stroke="#1E1108" strokeOpacity="0.3" strokeWidth="0.5" />
        <rect x="-1.6" y="-4.6" width="3.2" height="4.6" style={{ fill: 'var(--dk)' }} />
        <g style={{ opacity: 'var(--shut, 0)' }}>
          <rect x="-5.6" y="-7.2" width="11.2" height="1.7" fill="#1F2A3E" transform="rotate(-4)" />
          <rect x="-5.6" y="-3.9" width="11.2" height="1.7" fill="#1F2A3E" transform="rotate(3)" />
        </g>
        <g style={{ opacity: 'var(--flag, 0)' }}>
          <rect x="-0.5" y="-26.5" width="1" height="11.5" fill="#1E1108" />
          <path d="M0.4 -26.4 C4.5 -25.7 8 -25.5 12.5 -23.6 L0.4 -20 Z" fill="#7A2E22" stroke="#5A2118" strokeWidth="0.5" />
        </g>
      </g>
      <g id="fm-house">
        <ellipse cx="7" cy="1.6" rx="14.5" ry="4.4" fill="url(#fm-pieceShadow)" pointerEvents="none" />
        <rect x="-6.5" y="-11.5" width="13" height="11.5" style={{ fill: 'var(--w1)' }} stroke="#1E1108" strokeOpacity="0.28" strokeWidth="0.5" />
        <rect x="1.2" y="-11.5" width="5.3" height="11.5" style={{ fill: 'var(--w2)' }} />
        <path d="M-8 -11.2 L0 -19 L0 -11.2 Z" style={{ fill: 'var(--r1)' }} stroke="#1E1108" strokeOpacity="0.3" strokeWidth="0.5" />
        <path d="M0 -19 L8 -11.2 L0 -11.2 Z" style={{ fill: 'var(--r2)' }} stroke="#1E1108" strokeOpacity="0.3" strokeWidth="0.5" />
        <rect x="-4.4" y="-9.6" width="2.7" height="2.7" style={{ fill: 'var(--dk)' }} />
        <rect x="1.8" y="-9.6" width="2.7" height="2.7" style={{ fill: 'var(--dk)' }} />
        <rect x="-1.6" y="-4.9" width="3.2" height="4.9" style={{ fill: 'var(--dk)' }} />
        <g style={{ opacity: 'var(--shut, 0)' }}>
          <rect x="-5.6" y="-9.6" width="11.2" height="1.7" fill="#1F2A3E" transform="rotate(-4)" />
          <rect x="-5.6" y="-5.4" width="11.2" height="1.7" fill="#1F2A3E" transform="rotate(3)" />
        </g>
        <g style={{ opacity: 'var(--flag, 0)' }}>
          <rect x="-0.5" y="-30" width="1" height="11.5" fill="#1E1108" />
          <path d="M0.4 -29.9 C4.5 -29.2 8 -29 12.5 -27.1 L0.4 -23.5 Z" fill="#7A2E22" stroke="#5A2118" strokeWidth="0.5" />
        </g>
      </g>
      <g id="fm-wide">
        <ellipse cx="4.8" cy="1.2" rx="17" ry="4.2" fill="url(#fm-pieceShadow)" pointerEvents="none" />
        <rect x="-12" y="-8.5" width="24" height="8.5" style={{ fill: 'var(--w1)' }} stroke="#1E1108" strokeOpacity="0.28" strokeWidth="0.5" />
        <rect x="3" y="-8.5" width="9" height="8.5" style={{ fill: 'var(--w2)' }} />
        <path d="M-13.5 -8.2 L-5 -13.5 L0 -13.5 L0 -8.2 Z" style={{ fill: 'var(--r1)' }} stroke="#1E1108" strokeOpacity="0.3" strokeWidth="0.5" />
        <path d="M0 -13.5 L5 -13.5 L13.5 -8.2 L0 -8.2 Z" style={{ fill: 'var(--r2)' }} stroke="#1E1108" strokeOpacity="0.3" strokeWidth="0.5" />
        <rect x="-8.6" y="-6.4" width="2.7" height="2.7" style={{ fill: 'var(--dk)' }} />
        <rect x="6" y="-6.4" width="2.7" height="2.7" style={{ fill: 'var(--dk)' }} />
        <rect x="-1.6" y="-4.9" width="3.2" height="4.9" style={{ fill: 'var(--dk)' }} />
        <g style={{ opacity: 'var(--shut, 0)' }}>
          <rect x="-10.6" y="-6.8" width="21.2" height="1.7" fill="#1F2A3E" transform="rotate(-2.5)" />
          <rect x="-10.6" y="-3.6" width="21.2" height="1.7" fill="#1F2A3E" transform="rotate(2)" />
        </g>
        <g style={{ opacity: 'var(--flag, 0)' }}>
          <rect x="-0.5" y="-24.5" width="1" height="11.5" fill="#1E1108" />
          <path d="M0.4 -24.4 C4.5 -23.7 8 -23.5 12.5 -21.6 L0.4 -18 Z" fill="#7A2E22" stroke="#5A2118" strokeWidth="0.5" />
        </g>
      </g>
      <g id="fm-chapel">
        <ellipse cx="6" cy="1.4" rx="12.5" ry="4" fill="url(#fm-pieceShadow)" pointerEvents="none" />
        <rect x="-5.5" y="-10" width="11" height="10" style={{ fill: 'var(--w1)' }} stroke="#1E1108" strokeOpacity="0.28" strokeWidth="0.5" />
        <rect x="1" y="-10" width="4.5" height="10" style={{ fill: 'var(--w2)' }} />
        <path d="M-7 -9.8 L0 -16.5 L0 -9.8 Z" style={{ fill: 'var(--r1)' }} stroke="#1E1108" strokeOpacity="0.3" strokeWidth="0.5" />
        <path d="M0 -16.5 L7 -9.8 L0 -9.8 Z" style={{ fill: 'var(--r2)' }} stroke="#1E1108" strokeOpacity="0.3" strokeWidth="0.5" />
        <path d="M-2.6 -16.5 L0 -25 L2.6 -16.5 Z" style={{ fill: 'var(--r1)' }} stroke="#1E1108" strokeOpacity="0.3" strokeWidth="0.5" />
        <rect x="-0.45" y="-29" width="0.9" height="4.2" fill="#3A2A10" />
        <rect x="-1.8" y="-27.6" width="3.6" height="0.9" fill="#3A2A10" />
        <rect x="-1.4" y="-5.2" width="2.8" height="5.2" style={{ fill: 'var(--dk)' }} />
        <g style={{ opacity: 'var(--shut, 0)' }}>
          <rect x="-4.8" y="-8" width="9.6" height="1.6" fill="#1F2A3E" transform="rotate(-4)" />
        </g>
        <g style={{ opacity: 'var(--flag, 0)' }}>
          <rect x="-0.5" y="-34" width="1" height="9" fill="#1E1108" />
          <path d="M0.4 -33.9 C4.5 -33.2 8 -33 12.5 -31.1 L0.4 -27.5 Z" fill="#7A2E22" stroke="#5A2118" strokeWidth="0.5" />
        </g>
      </g>
      {/* the knight's banner */}
      <g id="fm-banner">
        <ellipse cx="4" cy="1" rx="12" ry="4" fill="url(#fm-pieceShadow)" pointerEvents="none" />
        <ellipse cx="0" cy="-0.4" rx="4.2" ry="1.9" fill="#1E1108" />
        <ellipse cx="-0.6" cy="-0.8" rx="3" ry="1.2" fill="#3A2A10" />
        <rect x="-0.8" y="-40" width="1.6" height="40" fill="#1E1108" />
        <rect x="-0.8" y="-40" width="0.6" height="40" fill="#6B4C18" />
        <path
          d="M0.8 -39.5 C7 -38.8 13 -39.6 20.5 -37.8 L14.5 -33.6 L20.5 -29.8 C13 -30.6 7 -30 0.8 -30.8 Z"
          style={{ fill: 'var(--cloth)' }}
          stroke="#5E4415"
          strokeWidth="0.7"
        />
        <path d="M0.8 -39.5 C7 -38.8 13 -39.6 20.5 -37.8" fill="none" stroke="#F0D68C" strokeWidth="0.8" strokeOpacity="0.8" />
        <circle cx="0" cy="-41.6" r="2.4" fill="url(#fm-bezel)" stroke="#5E4415" strokeWidth="0.6" />
      </g>
      {/* the Crown's seat — a walled keep, the one piece that is not a door */}
      <g id="fm-keep">
        <ellipse cx="9" cy="2.5" rx="30" ry="8" fill="url(#fm-pieceShadow)" pointerEvents="none" />
        <rect x="-26" y="-14" width="52" height="14" fill="#6E6656" stroke="#1E1108" strokeOpacity="0.4" strokeWidth="0.7" />
        <rect x="10" y="-14" width="16" height="14" fill="#575043" />
        <path
          d="M-26 -14 h5 v-4 h5 v4 h5 v-4 h5 v4 h5 v-4 h5 v4 h5 v-4 h5 v4 h5 v-4 h5 v4 h1 v-1"
          fill="#7C7466"
          stroke="#1E1108"
          strokeOpacity="0.35"
          strokeWidth="0.6"
        />
        <rect x="-9" y="-38" width="18" height="24" fill="#8A8272" stroke="#1E1108" strokeOpacity="0.4" strokeWidth="0.7" />
        <rect x="2" y="-38" width="7" height="24" fill="#6E6656" />
        <path d="M-9 -38 h4 v-4 h4 v4 h3 v-4 h4 v4 h4" fill="#9A9182" stroke="#1E1108" strokeOpacity="0.35" strokeWidth="0.6" />
        <rect x="-2.6" y="-8" width="5.2" height="8" fill="#33200F" />
        <rect x="-2.2" y="-31" width="4.4" height="6" fill="#33200F" />
        <rect x="-0.5" y="-56" width="1" height="14" fill="#1E1108" />
        <path d="M0.4 -55.6 C5 -55 9 -55.6 14 -54 L0.4 -49.5 Z" fill="url(#fm-flagBrass)" stroke="#5E4415" strokeWidth="0.6" />
      </g>
    </defs>
  );
}

export default FlatMapView;
