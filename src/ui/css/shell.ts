/**
 * OWNER: ui-shell agent. Styles for the frame of the interface and the parts
 * the shell owns: the slots, the HUD plaque, the heralds, map pins, speech
 * bubbles, toasts and tooltips. Built from the tokens in css/base.ts.
 *
 * Layout: five absolutely placed slots inside `.ll-frame`. Slots never take
 * pointer events themselves (the table stays clickable between panels); what
 * a part mounts inside one does. No slot is ever transformed or filtered, so
 * a part may use `position: fixed` for a bottom sheet.
 *
 *   desktop                                  under 700px
 *   ┌hud────────┐            ┌heralds┐       ┌hud bar──────────┐(bell)
 *   └───────────┘            │ strips│       │rail                    │
 *   ┌l┐┌inspector─┐          └───────┘       │   (table)              │
 *   │e││          │                          ┌inspector sheet─────────┐
 *   │f││          │ ┌word─────────┐          ┌word────────────────────┐
 *   └t┘└──────────┘ └─────────────┘          └────────────────────────┘
 */
export const SHELL_CSS = `
#ui{
  --ll-gut:16px; --ll-rail-w:62px; --ll-insp-w:336px; --ll-right-w:304px;
  --ll-top-h:220px; --ll-word-h:0px;
  --ll-gt:calc(var(--ll-gut) + env(safe-area-inset-top,0px));
  --ll-gr:calc(var(--ll-gut) + env(safe-area-inset-right,0px));
  --ll-gb:calc(var(--ll-gut) + env(safe-area-inset-bottom,0px));
  --ll-gl:calc(var(--ll-gut) + env(safe-area-inset-left,0px));
  font-family:var(--f-body);color:var(--ink);-webkit-tap-highlight-color:transparent;
}
/* base.ts gives .ll-veil a display, which would beat the hidden attribute */
#ui [hidden]{display:none!important}

.ll-world,.ll-frame,.ll-screens{position:absolute;inset:0}
.ll-world{overflow:hidden;z-index:1;transition:opacity .22s}
.ll-frame{z-index:2;transition:opacity .22s}
.ll-screens{z-index:3}
:where(.ll-screens)>*{pointer-events:auto}
#ui.is-veiled .ll-world,#ui.is-veiled .ll-frame{opacity:0;visibility:hidden;transition:opacity .18s,visibility 0s .18s}
#ui.is-tooling .ll-pins{opacity:.4}
#ui.is-tooling .ll-pin{pointer-events:none}

.ll-slot{position:absolute;display:flex;min-width:0;min-height:0;pointer-events:none}
:where(.ll-slot)>*{pointer-events:auto}
.ll-slot-hud{left:var(--ll-gl);top:var(--ll-gt);z-index:5}
.ll-slot-left{left:var(--ll-gl);top:calc(var(--ll-gt) + var(--ll-top-h) + 10px);bottom:var(--ll-gb);width:var(--ll-rail-w);align-items:flex-start;z-index:4}
:where(.ll-slot-left)>*{flex:none;max-height:100%}
.ll-slot-inspector{left:calc(var(--ll-gl) + var(--ll-rail-w) + 10px);top:calc(var(--ll-gt) + var(--ll-top-h) + 10px);bottom:var(--ll-gb);width:var(--ll-insp-w);flex-direction:column;justify-content:flex-end;z-index:3}
:where(.ll-slot-inspector)>*{display:flex;flex-direction:column;min-height:0;max-height:100%;max-width:100%}
.ll-slot-heralds{right:var(--ll-gr);top:var(--ll-gt);width:var(--ll-right-w);justify-content:flex-end;align-items:flex-start;z-index:3}
.ll-slot.is-raised{z-index:8}
.ll-slot-word{--ll-wl:max(calc(50% - 280px),calc(var(--ll-gl) + var(--ll-rail-w) + var(--ll-insp-w) + 26px));left:var(--ll-wl);bottom:var(--ll-gb);width:min(560px,calc(100% - var(--ll-wl) - var(--ll-gr)));flex-direction:column;justify-content:flex-end;z-index:3}
:where(.ll-slot-word)>*{max-width:100%}

/* a short window: the rail takes the whole left edge and the plaque moves in beside it */
@media (min-width:700px) and (max-height:779px){
  .ll-slot-left{top:var(--ll-gt)}
  .ll-slot-hud{left:calc(var(--ll-gl) + var(--ll-rail-w) + 10px)}
}
/* a narrow window: the word bar runs from the rail to the far gutter and the inspector stands on it.
   There is no room beside the plaque for its ribbon tags (the heralds are there), so they hang beneath it
   and the inspector starts below them (--ll-tags-h is published by the HUD). */
@media (min-width:700px) and (max-width:979px){
  .ll-slot-word{left:calc(var(--ll-gl) + var(--ll-rail-w) + 10px);right:var(--ll-gr);width:auto;align-items:center}
  .ll-slot-inspector{top:calc(var(--ll-gt) + var(--ll-top-h) + 10px + var(--ll-tags-h,0px));bottom:calc(var(--ll-gb) + var(--ll-word-h) + 10px)}
}
/* a phone: one row across the top, the word bar docked along the bottom, sheets above it */
@media (max-width:699px){
  #ui{--ll-rail-w:48px;--ll-top-h:44px}
  .ll-slot-hud{right:calc(var(--ll-gr) + 50px)}
  .ll-slot-heralds{width:auto}
  .ll-slot-left{top:calc(var(--ll-gt) + var(--ll-top-h) + 8px);bottom:calc(var(--ll-word-h) + 8px);width:auto}
  .ll-slot-inspector{left:var(--ll-gl);right:var(--ll-gr);width:auto;top:max(calc(var(--ll-gt) + var(--ll-top-h) + 8px),38%);bottom:calc(var(--ll-word-h) + 8px)}
  :where(.ll-slot-inspector)>*{width:100%}
  .ll-slot-word{left:0;right:0;bottom:0;width:auto}
  :where(.ll-slot-word)>*{width:100%}
}

/* ───────── toasts ───────── */
/* they stand in the clear band along the top, between the plaque (and its ribbon tags) and the heralds;
   where that band is too thin they move to just above the word bar */
#ui .ll-toasts{position:absolute;left:calc(var(--ll-gl) + 352px);right:calc(var(--ll-gr) + var(--ll-right-w) + 12px);top:calc(var(--ll-gt) + var(--ll-tags-h,0px));z-index:80;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;transition:top .2s}
.ll-toast{display:flex;align-items:flex-start;gap:8px;max-width:min(430px,100%);padding:7px 14px 8px 10px;font-size:var(--fs-s);line-height:1.3;color:var(--ink);
  background:linear-gradient(180deg,#f6ecd0,var(--parch-2));border:1px solid var(--parch-edge);border-left:4px solid var(--ink-2);border-radius:var(--rad);
  box-shadow:0 8px 22px rgba(0,0,0,.5),0 1px 0 rgba(255,250,235,.5) inset;animation:ll-toast-in .22s ease-out backwards;transition:opacity .3s,transform .3s}
.ll-toast .ll-icon{margin-top:1px;color:var(--ink-2)}
.ll-toast.is-good{border-left-color:var(--verdigris)} .ll-toast.is-good .ll-icon{color:var(--verdigris)}
.ll-toast.is-bad{border-left-color:var(--rubric)} .ll-toast.is-bad .ll-icon{color:var(--rubric)}
.ll-toast.is-out{opacity:0;transform:translateY(-6px)}
.ll-toast.is-again{animation:ll-toast-nudge .3s ease-out}
@keyframes ll-toast-in{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}
@keyframes ll-toast-nudge{30%{transform:translateX(-4px)}65%{transform:translateX(3px)}}
@media (min-width:980px) and (max-height:779px){
  #ui .ll-toasts{left:calc(var(--ll-gl) + var(--ll-rail-w) + 362px)}
}
@media (max-width:979px),(max-width:1099px) and (max-height:779px){
  #ui .ll-toasts{left:var(--ll-gl);right:var(--ll-gr);top:auto;bottom:calc(var(--ll-gb) + var(--ll-word-h) + 12px)}
}
@media (max-width:699px){
  #ui .ll-toasts{bottom:calc(var(--ll-word-h) + 12px)}
}

/* ───────── tooltips ───────── */
#ui .ll-tip{left:0;top:0;z-index:95;opacity:0;visibility:hidden;transition:opacity .12s,visibility 0s .12s;pointer-events:none;white-space:pre-line;line-height:1.32;max-width:270px;padding:7px 11px 8px;
  background:linear-gradient(180deg,#f6ecd0,var(--parch-2));will-change:transform}
#ui .ll-tip.is-on{opacity:1;visibility:visible;transition:opacity .12s}
.ll-tip-h{display:block;font-family:var(--f-head);font-size:var(--fs-s);letter-spacing:.06em;color:var(--rubric);margin-bottom:1px}
.ll-tip-b{display:block;font-size:var(--fs-s);color:var(--ink)}
.ll-tip-b:empty{display:none}

/* ───────── HUD plaque ───────── */
.ll-hud{position:relative;display:flex}
.ll-plaque{position:relative;width:340px;max-width:calc(100vw - 2*var(--ll-gut));padding:11px 14px 9px;display:flex;flex-direction:column;gap:7px}
.ll-plaque::before{content:"";position:absolute;inset:3px;border:1px solid rgba(138,116,90,.42);border-radius:2px;pointer-events:none}
.ll-plaque .ll-rule{margin:0;width:100%}
.ll-hud-head{display:flex;align-items:center;gap:10px;min-width:0}
.ll-hud-crest{width:42px;height:50px;flex:none;display:grid;place-items:center;filter:drop-shadow(0 1px 1px rgba(42,29,20,.4))}
.ll-hud-crest svg{width:100%;height:100%;display:block}
.ll-hud-names{flex:1;min-width:0;display:flex;flex-direction:column}
.ll-hud-realm{font-family:var(--f-head);font-size:var(--fs-s);letter-spacing:.07em;color:var(--rubric);line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ll-hud-ruler{font-family:var(--f-black);font-size:25px;line-height:1.08;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px}
.ll-hud-ruler .ll-icon{font-size:15px;color:var(--ink-2);flex:none}
.ll-hud-date{font-size:var(--fs-s);line-height:1.25;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;display:flex;align-items:center;gap:5px}
.ll-hud-date .ll-icon{font-size:13px;color:var(--ink-2)}
.ll-hud-rent{font-size:12.5px;line-height:1.25;font-style:italic;color:var(--ink-2);white-space:nowrap}
.ll-hud-rent.is-today{font-style:normal;font-family:var(--f-head);letter-spacing:.05em;color:var(--rubric)}
.ll-dial{width:58px;height:58px;flex:none;display:block;border-radius:50%;filter:drop-shadow(0 1px 2px rgba(42,29,20,.45))}
.ll-dial svg{width:100%;height:100%;display:block}

.ll-hud-figs{display:grid;grid-template-columns:1.14fr .92fr 1.1fr;gap:8px}
.ll-fig{display:flex;flex-direction:column;gap:1px;min-width:0;white-space:nowrap;cursor:default}
.ll-fig-top{display:flex;align-items:center;gap:5px;min-width:0}
.ll-fig .ll-icon{font-size:17px;color:var(--ink-2);margin-top:-1px}
.ll-fig-n{font-size:21px;line-height:1.05;font-variant-numeric:tabular-nums lining-nums;color:var(--ink)}
.ll-fig-s{font-size:12.5px;line-height:1.2;font-style:italic;color:var(--ink-2);overflow:hidden;text-overflow:ellipsis}
.ll-fig-s.ll-good{color:var(--good)} .ll-fig-s.ll-bad{color:var(--bad)}
.ll-fig.is-debt .ll-fig-n,.ll-fig.is-debt .ll-fig-top>.ll-icon,.ll-fig.is-debt>.ll-icon{color:var(--bad)}
.ll-fig-owed{font-size:14px;color:var(--bad);display:none;line-height:0}
.ll-fig.has-loan .ll-fig-owed{display:inline-block}
.ll-fig .ll-fig-owed .ll-icon{font-size:14px;color:var(--bad);margin:0}

.ll-hud-meters{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.ll-hud-meter{display:flex;align-items:center;gap:6px;min-width:0;cursor:default}
.ll-hud-meter-k{font-family:var(--f-head);font-size:12.5px;letter-spacing:.06em;color:var(--ink-2)}
.ll-hud-meter .ll-meter{flex:1;min-width:28px;height:7px}
.ll-hud-meter-v{font-size:var(--fs-s);font-variant-numeric:tabular-nums lining-nums;min-width:1.5em;text-align:right}

.ll-hud-band{display:flex;align-items:center;gap:8px;min-height:28px}
.ll-hud-speeds{display:flex;gap:4px}
.ll-hud-speeds .ll-seal{width:27px;height:27px;font-size:13px}
.ll-hud-speeds .ll-seal .ll-icon{vertical-align:0}
.ll-hud-state{font-size:12.5px;font-style:italic;color:var(--rubric);min-width:44px;white-space:nowrap}
.ll-hud-charter{margin-left:auto;display:flex;align-items:center;gap:4px;padding:4px 5px;background:none;border:0;border-radius:var(--rad);cursor:pointer;color:var(--ink-2)}
.ll-hud-charter:hover{background:rgba(201,162,39,.16);color:var(--rubric)}
.ll-hud-charter .ll-icon{font-size:15px;margin-right:2px}
.ll-pip{--p:0;width:12px;height:12px;border-radius:50%;flex:none;background:conic-gradient(var(--gold) calc(var(--p)*1%),rgba(42,29,20,.13) 0);box-shadow:inset 0 0 0 1px rgba(122,94,18,.75)}
.ll-pip.is-done{background:radial-gradient(circle at 35% 30%,var(--gold-2),var(--gold) 55%,var(--gold-ink));box-shadow:inset 0 0 0 1px var(--gold-ink),0 0 5px rgba(227,192,90,.7)}
.ll-hud-gear{width:26px;height:26px;flex:none;display:grid;place-items:center;padding:0;border:0;border-radius:50%;background:none;color:var(--ink-3);cursor:pointer;font-size:16px}
.ll-hud-gear:hover{color:var(--rubric);background:rgba(42,29,20,.07)}

/* ribbon tags that hang off the plaque: collect the purses, the Crown's herald */
.ll-hud-tags{position:absolute;left:calc(100% + 8px);top:8px;display:flex;flex-direction:column;align-items:flex-start;gap:7px;width:max-content;max-width:240px}
.ll-hud-tag{display:flex;align-items:center;gap:8px;padding:3px 13px 3px 3px;border-radius:17px 4px 4px 17px;cursor:pointer;font-family:var(--f-head);font-size:var(--fs-s);letter-spacing:.05em;line-height:1.15;text-align:left;
  color:var(--ink);background:linear-gradient(180deg,#f6ecd0,var(--parch-2));border:1px solid var(--parch-edge);box-shadow:0 5px 14px rgba(0,0,0,.45),0 1px 0 rgba(255,250,235,.5) inset;transition:transform .1s}
.ll-hud-tag:hover{transform:translateX(2px)}
.ll-hud-tag:active{transform:translateX(0) scale(.98)}
.ll-hud-tag .ll-seal{width:28px;height:28px;font-size:14px;pointer-events:none}
.ll-hud-tag small{display:block;font-family:var(--f-body);font-size:12.5px;letter-spacing:0;font-style:italic;color:var(--ink-2)}
.ll-hud-tag.is-crown{border-color:var(--gold-ink);animation:ll-gold-pulse 1.9s ease-out infinite}
@keyframes ll-gold-pulse{0%{box-shadow:0 5px 14px rgba(0,0,0,.45),0 0 0 0 rgba(227,192,90,.85)}70%,100%{box-shadow:0 5px 14px rgba(0,0,0,.45),0 0 0 11px rgba(227,192,90,0)}}

@media (min-width:700px) and (max-width:979px){
  .ll-hud-tags{left:calc(var(--ll-rail-w) + 10px);top:calc(100% + 8px);max-width:calc(340px - var(--ll-rail-w) - 10px)}
  .ll-hud-tag:hover{transform:translateY(1px)}
}
@media (min-width:700px) and (max-width:979px) and (max-height:779px){
  .ll-hud-tags{left:0;max-width:340px}
}

/* the condensed row (phones) */
.ll-hud-bar{display:none}
@media (max-width:699px){
  .ll-hud{width:100%}
  .ll-hud-bar{display:flex;align-items:center;gap:7px;width:100%;height:44px;padding:0 5px 0 6px;cursor:pointer;min-width:0}
  .ll-hud-bar .ll-dial{width:32px;height:32px}
  .ll-hud-bar-date{flex:1 1 auto;min-width:0;font-size:var(--fs-s);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ll-hud-bar .ll-fig{flex:none;flex-direction:row;align-items:center;gap:5px}
  .ll-hud-bar .ll-fig-n{font-size:17px}
  .ll-hud-bar .ll-fig .ll-icon{font-size:15px}
  .ll-hud-bar .ll-seal{width:34px;height:34px;font-size:14px}
  .ll-plaque{display:none;position:absolute;left:0;top:calc(100% + 6px);width:calc(100vw - var(--ll-gl) - var(--ll-gr));z-index:6}
  .ll-hud.is-open .ll-plaque{display:flex}
  .ll-hud-speeds .ll-seal{width:34px;height:34px;font-size:15px}
  .ll-hud-gear{width:34px;height:34px}
  .ll-hud-tags{left:calc(var(--ll-rail-w) + 8px);top:calc(100% + 8px + var(--ll-her-h,0px));max-width:calc(100vw - var(--ll-gl) - var(--ll-gr) - var(--ll-rail-w) - 8px)}
  .ll-hud.is-open .ll-hud-tags{display:none}
}
@media (max-width:379px){ .ll-hud-bar .ll-fig-house{display:none} }

/* ───────── heralds ───────── */
.ll-her{position:relative;display:flex;align-items:flex-start;justify-content:flex-end;gap:8px;width:100%;pointer-events:none}
.ll-her>*{pointer-events:auto}
.ll-her-more{position:relative;width:32px;height:32px;font-size:15px;order:2}
.ll-her-more .i-bell{display:none}
.ll-her-badge{position:absolute;right:-5px;top:-5px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;display:none;place-items:center;font-family:var(--f-body);font-size:12px;line-height:1;color:var(--ink);background:var(--parch);border:1px solid var(--ink-2);box-shadow:0 1px 2px rgba(0,0,0,.4)}
#ui .ll-her-strips{flex:1;min-width:0;display:flex;flex-direction:column;pointer-events:none;order:1}
.ll-her-item{display:grid;grid-template-rows:1fr;transition:grid-template-rows .3s ease,opacity .3s ease,transform .3s ease;animation:ll-her-in .34s ease-out backwards}
.ll-her-item.is-out{grid-template-rows:0fr;opacity:0;transform:translateX(22px)}
@keyframes ll-her-in{from{grid-template-rows:0fr;opacity:0;transform:translateX(22px)}to{grid-template-rows:1fr;opacity:1;transform:none}}
.ll-her-clip{overflow:hidden;min-height:0;padding:1px 6px 0 10px;margin:-1px -6px 0 -10px}
.ll-her-strip{pointer-events:auto;display:flex;align-items:flex-start;gap:8px;width:100%;margin:0 0 7px;padding:6px 10px 7px 8px;text-align:left;font:inherit;font-size:var(--fs-s);line-height:1.3;color:var(--ink);cursor:default;
  background:linear-gradient(180deg,#f6ecd0,var(--parch-2));border:1px solid var(--parch-edge);border-left:4px solid var(--ink-2);border-radius:2px var(--rad) var(--rad) 2px;box-shadow:0 3px 8px rgba(0,0,0,.42),0 1px 0 rgba(255,250,235,.5) inset}
button.ll-her-strip{cursor:pointer}
button.ll-her-strip:hover{background:linear-gradient(180deg,#fbf3dc,#eadbb4)}
.ll-her-strip>.ll-icon{font-size:16px;margin-top:1px;color:var(--ink-2)}
.ll-her-text{flex:1;min-width:0;overflow-wrap:anywhere}
.ll-her-item.is-old .ll-her-text{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.ll-her-item.is-old .ll-her-strip:hover .ll-her-text,.ll-her-item.is-old .ll-her-strip:focus-visible .ll-her-text{-webkit-line-clamp:9}
.ll-her-cue{display:block;margin-top:2px;font-family:var(--f-head);font-size:12.5px;letter-spacing:.06em;color:var(--rubric)}
.ll-her-item.is-old .ll-her-cue{display:none}
.k-urgent.ll-her-strip,.k-bad.ll-her-strip{border-left-color:var(--rubric)} .k-urgent>.ll-icon,.k-bad>.ll-icon{color:var(--rubric)}
.k-urgent.ll-her-strip{background:linear-gradient(90deg,rgba(158,43,37,.13),transparent 46%),linear-gradient(180deg,#f6ecd0,var(--parch-2))}
.k-good.ll-her-strip{border-left-color:var(--verdigris)} .k-good>.ll-icon{color:var(--verdigris)}
.k-crown.ll-her-strip{border-left-color:var(--gold);background:linear-gradient(90deg,rgba(201,162,39,.2),transparent 50%),linear-gradient(180deg,#f6ecd0,var(--parch-2))} .k-crown>.ll-icon{color:var(--gold-ink)}
.k-rival.ll-her-strip{border-left-color:var(--lapis)} .k-rival>.ll-icon{color:var(--lapis)}

.ll-her-log{position:absolute;top:0;right:0;z-index:7;width:min(390px,calc(100vw - 2*var(--ll-gut)));max-height:min(74vh,660px);animation:ll-drop-in .18s ease-out both}
@keyframes ll-drop-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
.ll-her-log .ll-panel-body{padding:4px 14px 14px;gap:0;display:block}
.ll-her-day{font-family:var(--f-head);font-size:12.5px;letter-spacing:.08em;color:var(--rubric);margin:12px 0 2px;clear:both}
.ll-her-entry{display:flex;align-items:flex-start;gap:8px;width:100%;padding:5px 4px 6px 0;margin:0;border:0;border-bottom:1px dotted rgba(138,116,90,.55);background:none;text-align:left;font:inherit;font-size:14.5px;line-height:1.32;color:var(--ink);cursor:default}
button.ll-her-entry{cursor:pointer}
button.ll-her-entry:hover{background:rgba(201,162,39,.13)}
.ll-her-entry>.ll-icon{font-size:15px;margin-top:2px;color:var(--ink-2)}
.ll-her-entry.k-urgent>.ll-icon,.ll-her-entry.k-bad>.ll-icon{color:var(--rubric)}
.ll-her-entry.k-good>.ll-icon{color:var(--verdigris)} .ll-her-entry.k-crown>.ll-icon{color:var(--gold-ink)} .ll-her-entry.k-rival>.ll-icon{color:var(--lapis)}
.ll-her-doodle{float:right;margin:6px 0 2px 10px;opacity:.9;line-height:0}
.ll-her-empty{padding:18px 4px 6px}

@media (max-width:699px){
  .ll-her{width:auto}
  .ll-her-more{width:42px;height:42px;font-size:19px}
  .ll-her-more .i-bell{display:inline-block} .ll-her-more .i-scroll{display:none}
  .ll-her-badge.is-on{display:grid}
  #ui .ll-her-strips{position:fixed;left:calc(var(--ll-gl) + var(--ll-rail-w) + 8px);right:var(--ll-gr);top:calc(var(--ll-gt) + var(--ll-top-h) + 8px);flex:none}
  .ll-her-item:not(:first-child){display:none}
  .ll-her-log{position:fixed;left:var(--ll-gl);right:var(--ll-gr);top:calc(var(--ll-gt) + var(--ll-top-h) + 8px);width:auto;max-height:calc(100% - var(--ll-gt) - var(--ll-gb) - var(--ll-top-h) - var(--ll-word-h) - 24px)}
}

/* ───────── map pins ───────── */
.ll-pins,.ll-bubs{position:absolute;inset:0;pointer-events:none;overflow:hidden;transition:opacity .2s}
.ll-wax{--w1:#c5473d;--w2:#9e2b25;--w3:#5e1512;--wi:#fbf0d8;--ring:#f6ecd0}
.ll-wax.c-ochre{--w1:#dfa448;--w2:#b5761f;--w3:#6a430e}
.ll-wax.c-lapis{--w1:#5c7bb2;--w2:#2f4a7a;--w3:#1a2b4b}
.ll-wax.c-green{--w1:#74a383;--w2:#4f7a5a;--w3:#2a4733;--ring:#bfe0c6}
.ll-wax.c-gold{--w1:#f3d985;--w2:#c9a227;--w3:#7a5e12;--wi:#3a2a10}
.ll-wax.c-parch{--w1:#fdf6e2;--w2:#e9dab3;--w3:#a88f5e;--wi:#9e2b25}
.ll-wax.c-work{--w1:#fdf6e2;--w2:#e9dab3;--w3:#a88f5e;--wi:#3a2a1c;--ring:#9fd0ab}
.ll-pin{position:absolute;left:-22px;top:-60px;width:44px;height:60px;padding:0;margin:0;border:0;background:none;color:inherit;font:inherit;cursor:pointer;pointer-events:auto;
  transform-origin:22px 60px;will-change:transform;contain:layout style;border-radius:22px 22px 6px 6px}
.ll-pin.is-off{visibility:hidden;pointer-events:none}
.ll-pin-in{position:absolute;left:2px;top:1px;width:40px;height:40px;display:grid;place-items:center;animation:ll-pin-pop .36s cubic-bezier(.3,1.55,.5,1) backwards;transition:transform .12s}
.ll-pin:hover .ll-pin-in,.ll-pin:focus-visible .ll-pin-in{transform:scale(1.1)}
.ll-pin:active .ll-pin-in{transform:scale(.96)}
.ll-pin-stem{position:absolute;left:21px;top:40px;width:2px;height:16px;border-radius:1px;background:linear-gradient(rgba(20,13,9,.9),rgba(20,13,9,.35))}
.ll-pin-stem::after{content:"";position:absolute;left:-3px;bottom:-5px;width:8px;height:5px;border-radius:50%;background:rgba(0,0,0,.5)}
.ll-pin-face{grid-area:1/1;width:32px;height:32px;display:grid;place-items:center;font-size:18px;color:var(--wi);border-radius:52% 48% 50% 50%/49% 53% 47% 51%;
  background:radial-gradient(circle at 36% 30%,var(--w1),var(--w2) 58%,var(--w3));box-shadow:0 2px 5px rgba(0,0,0,.6),inset 0 -2px 3px rgba(0,0,0,.28),inset 0 1px 1px rgba(255,236,214,.5)}
.ll-pin.v1 .ll-pin-face{border-radius:49% 51% 53% 47%/52% 48% 51% 49%}
.ll-pin.v2 .ll-pin-face{border-radius:51% 49% 47% 53%/47% 52% 49% 53%}
.ll-pin-face .ll-icon{vertical-align:0;filter:drop-shadow(0 1px 0 rgba(0,0,0,.28))}
.c-gold .ll-pin-face .ll-icon,.c-parch .ll-pin-face .ll-icon,.c-work .ll-pin-face .ll-icon,.ll-pin-face.c-gold .ll-icon,.ll-pin-face.c-parch .ll-icon{filter:none}
.ll-pin-face.is-art{background:none;box-shadow:none;border-radius:0;width:34px;height:34px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.6))}
.ll-pin-face.is-art>svg{width:100%;height:100%;display:block}
.ll-pin-ring{grid-area:1/1;width:40px;height:40px;transform:rotate(-90deg);pointer-events:none}
.ll-pin-ring circle{fill:none;stroke-width:2.6}
.ll-pin-ring .t{stroke:rgba(14,10,8,.62)}
.ll-pin-ring .v{stroke:var(--ring);stroke-linecap:round;transition:stroke .3s}
.ll-pin.is-hot{--ring:#ff8a66}
.ll-pin.is-hot .ll-pin-in::before{content:"";position:absolute;inset:1px;border-radius:50%;border:2px solid #ff8a66;animation:ll-pin-halo 1.5s ease-out infinite;pointer-events:none}
.ll-pin.is-pending{cursor:default}
.ll-pin.is-gone{pointer-events:none}
.ll-pin.is-gone .ll-pin-in{transition:transform .16s ease-in,opacity .16s;transform:scale(.2);opacity:0}
.ll-pin.is-pending .ll-pin-face{filter:saturate(.35) brightness(.92);opacity:.78}
.ll-pin--purse .ll-pin-in{animation:ll-pin-pop .36s cubic-bezier(.3,1.55,.5,1) backwards,ll-pin-bob 1.7s ease-in-out .4s infinite}
.ll-pin--purse.is-pending .ll-pin-in{animation:none}
.ll-pin--speech .ll-pin-face{border-radius:50% 50% 50% 14%}
.ll-pin-badge{position:absolute;right:-3px;top:-3px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;display:none;place-items:center;font-size:12px;line-height:1;color:var(--ink);background:var(--parch);border:1px solid var(--ink-2);box-shadow:0 1px 2px rgba(0,0,0,.45)}
.ll-pin.has-more .ll-pin-badge{display:grid}
.ll-pin--work{left:-15px;top:-44px;width:30px;height:44px;transform-origin:15px 44px;pointer-events:none;cursor:default}
.ll-pin--work .ll-pin-in{left:1px;top:1px;width:28px;height:28px}
.ll-pin--work .ll-pin-ring{width:28px;height:28px}
.ll-pin--work .ll-pin-face{width:21px;height:21px;font-size:12.5px;border-radius:50%}
.ll-pin--work .ll-pin-stem{left:14px;top:28px;height:12px}
@keyframes ll-pin-pop{from{opacity:0;transform:scale(.3) translateY(10px)}to{opacity:1;transform:none}}
@keyframes ll-pin-bob{0%,100%{translate:0 0}50%{translate:0 -4px}}
@keyframes ll-pin-halo{from{opacity:.9;transform:scale(.92)}to{opacity:0;transform:scale(1.5)}}

/* the small parchment that opens on a pin */
#ui>.ll-pop{position:absolute;left:0;top:0;z-index:6;width:min(312px,calc(100vw - 2*var(--ll-gut)));pointer-events:auto;will-change:transform}
.ll-pop-in{animation:ll-pop-in .16s ease-out backwards;max-height:min(70vh,440px)}
@keyframes ll-pop-in{from{opacity:0;scale:.96}to{opacity:1;scale:1}}
.ll-pop .ll-panel-head{padding:9px 10px 7px 13px;gap:8px}
.ll-pop .ll-title{font-size:17px}
.ll-pop .ll-close{width:26px;height:26px;font-size:12px}
.ll-pop .ll-panel-body{padding:9px 13px 13px;gap:8px}
.ll-pop-where{font-size:12.5px;font-style:italic;color:var(--ink-2);margin:0}
.ll-pop-where.is-hot{color:var(--rubric)}
.ll-pop-text{font-size:14.5px;line-height:1.34;margin:0}
.ll-pop-opts{display:flex;flex-direction:column;gap:6px}
.ll-pop-opt{display:block;width:100%;text-align:left;white-space:normal;padding:6px 11px 7px;line-height:1.25}
.ll-pop-opt b{display:block;font-weight:400;font-size:14.5px}
.ll-pop-opt span{display:block;font-family:var(--f-body);font-size:12.5px;letter-spacing:0;opacity:.86}
.ll-pop-opt span.is-short{color:var(--bad);opacity:1}
.ll-pop-opt.ll-btn-primary span.is-short{color:#ffd9c9}
.ll-pop-row{display:flex;align-items:center;gap:9px;width:100%;padding:5px 6px;border:0;border-bottom:1px dotted rgba(138,116,90,.55);background:none;text-align:left;font:inherit;color:var(--ink);cursor:pointer;border-radius:var(--rad)}
.ll-pop-row:hover{background:rgba(201,162,39,.15)}
.ll-pop-row .ll-pin-face{flex:none;width:26px;height:26px;font-size:14px;box-shadow:0 1px 2px rgba(0,0,0,.45),inset 0 -1px 2px rgba(0,0,0,.25)}
.ll-pop-row b{display:block;font-weight:400;font-family:var(--f-head);font-size:var(--fs-s);letter-spacing:.05em}
.ll-pop-row span{display:block;font-size:12.5px;color:var(--ink-2)}
.ll-pop-all{align-self:flex-start;margin-top:2px}

/* ───────── speech bubbles ───────── */
.ll-bubs{z-index:2}
.ll-bub{position:absolute;left:0;top:0;width:0;height:0;will-change:transform}
.ll-bub.is-off{visibility:hidden}
.ll-bub-in{position:absolute;left:0;bottom:11px;width:max-content;max-width:214px;transform:translateX(-50%)}
.ll-bub-box{position:relative;padding:5px 10px 7px;font-size:var(--fs-s);line-height:1.26;color:var(--ink);background:linear-gradient(180deg,#fbf3dc,#eadbb4);border:1px solid var(--parch-edge);border-radius:11px;
  box-shadow:0 4px 12px rgba(0,0,0,.45),0 1px 0 rgba(255,250,235,.6) inset;transform-origin:50% 100%;animation:ll-bub-in .2s cubic-bezier(.3,1.4,.5,1) backwards;transition:opacity .3s}
.ll-bub-box::after{content:"";position:absolute;left:calc(50% - 6px);bottom:-6px;width:11px;height:11px;background:#eadbb4;border-right:1px solid var(--parch-edge);border-bottom:1px solid var(--parch-edge);transform:rotate(45deg);border-radius:0 0 3px 0}
.ll-bub.is-out .ll-bub-box{opacity:0}
.ll-bub-who{display:block;font-family:var(--f-head);font-size:12px;letter-spacing:.07em;color:var(--rubric);line-height:1.2}
.ll-bub-rest{visibility:hidden}
@keyframes ll-bub-in{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}

@media (prefers-reduced-motion:reduce){
  .ll-pin-in,.ll-pin-in::before,.ll-hud-tag.is-crown,.ll-bub-box,.ll-toast{animation:none!important}
}
`;
