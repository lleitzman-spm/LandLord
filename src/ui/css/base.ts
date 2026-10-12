/**
 * Manuscript design system — tokens and the kit's classes. Owned by the
 * integrator; the ui-shell agent may refine values. Every UI module styles
 * through these tokens. Single committed look (a candle-lit room), so there
 * is one theme.
 *
 * Type: UnifrakturMaguntia (blackletter: the logo, drop caps, rank titles —
 * sparingly), IM Fell English SC (headings, labels), IM Fell English (body).
 */
export const BASE_CSS = `
:root{
  color-scheme: dark;
  --room:#0e0a08;
  --parch:#efe3c4; --parch-2:#e6d6ae; --parch-3:#d9c79c; --parch-edge:#b89f6c; --parch-shadow:rgba(42,29,20,.28);
  --ink:#2a1d14; --ink-2:#5a4633; --ink-3:#8a745a;
  --rubric:#9e2b25; --rubric-2:#7c1f1b;
  --gold:#c9a227; --gold-2:#e3c05a; --gold-ink:#7a5e12;
  --lapis:#2f4a7a; --verdigris:#4f7a5a;
  --good:#4f7a3a; --warn:#b5761f; --bad:#a3331f;
  --f-black:'UnifrakturMaguntia','UnifrakturCook','Old English Text MT',serif;
  --f-head:'IM Fell English SC','IM Fell English','Hoefler Text',Georgia,serif;
  --f-body:'IM Fell English','Hoefler Text','Iowan Old Style',Georgia,serif;
  --s-1:4px; --s-2:8px; --s-3:12px; --s-4:16px; --s-5:24px; --s-6:36px;
  --fs-xs:12px; --fs-s:14px; --fs-m:16px; --fs-l:19px; --fs-xl:24px; --fs-2xl:34px; --fs-3xl:54px;
  --rad:3px;
  --lift:0 1px 0 rgba(255,250,235,.5) inset, 0 10px 28px rgba(0,0,0,.45), 0 2px 6px rgba(0,0,0,.35);
}
html,body{height:100%;margin:0;background:var(--room);color:var(--parch);font-family:var(--f-body);font-size:var(--fs-m);line-height:1.35;overflow:hidden;-webkit-font-smoothing:antialiased;overscroll-behavior:none}
#app{position:fixed;inset:0;overflow:hidden;user-select:none;-webkit-user-select:none}
#app canvas#c{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none}
#ui{position:absolute;inset:0;pointer-events:none}
#ui>*{pointer-events:auto}
#ui .ll-pass{pointer-events:none}
*{box-sizing:border-box}
button{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--gold-2);outline-offset:2px}
::selection{background:var(--rubric);color:var(--parch)}

/* parchment surface */
.ll-parch,.ll-panel{color:var(--ink);background:
  radial-gradient(120% 90% at 20% 0%,rgba(255,250,230,.55),transparent 60%),
  radial-gradient(90% 80% at 100% 100%,rgba(150,110,60,.22),transparent 65%),
  linear-gradient(180deg,var(--parch),var(--parch-2));
  border:1px solid var(--parch-edge);border-radius:var(--rad);box-shadow:var(--lift)}
.ll-panel{display:flex;flex-direction:column;min-width:0;max-width:100%}
.ll-panel-head{display:flex;align-items:center;gap:var(--s-3);padding:var(--s-3) var(--s-4) var(--s-2);border-bottom:1px solid var(--parch-edge);background:linear-gradient(180deg,rgba(158,43,37,.06),transparent)}
.ll-panel-body{padding:var(--s-3) var(--s-4) var(--s-4);display:flex;flex-direction:column;gap:var(--s-3);min-width:0;overflow:auto}
.ll-title{font-family:var(--f-head);font-weight:400;font-size:var(--fs-l);letter-spacing:.04em;color:var(--rubric);margin:0;flex:1;min-width:0;text-wrap:balance}
.ll-sub{font-family:var(--f-head);font-size:var(--fs-s);letter-spacing:.08em;color:var(--ink-2);margin:0}
.ll-black{font-family:var(--f-black);font-weight:400;letter-spacing:.01em}
.ll-body{font-size:var(--fs-m);color:var(--ink)}
.ll-note{font-size:var(--fs-s);color:var(--ink-2);font-style:italic}
.ll-dropcap::first-letter{font-family:var(--f-black);font-size:2.9em;line-height:.8;float:left;padding:.06em .1em 0 0;color:var(--rubric)}
.ll-rule{border:0;height:1px;background:linear-gradient(90deg,transparent,var(--parch-edge) 12%,var(--parch-edge) 88%,transparent);margin:var(--s-1) 0}
.ll-row{display:flex;align-items:center;gap:var(--s-2);min-width:0;flex-wrap:wrap}
.ll-col{display:flex;flex-direction:column;gap:var(--s-2);min-width:0}
.ll-grow{flex:1;min-width:0}
.ll-num{font-variant-numeric:tabular-nums lining-nums}

/* buttons: plain = inked label on parchment; primary = rubric; quiet = text only; seal = round wax */
.ll-btn{font-family:var(--f-head);font-size:var(--fs-s);letter-spacing:.06em;padding:6px 12px;border-radius:var(--rad);cursor:pointer;border:1px solid var(--ink-3);background:linear-gradient(180deg,rgba(255,250,235,.7),rgba(217,199,156,.7));color:var(--ink);transition:transform .08s,box-shadow .12s,background .12s;white-space:nowrap}
.ll-btn:hover:not(:disabled){box-shadow:0 2px 0 var(--parch-shadow);transform:translateY(-1px)}
.ll-btn:active:not(:disabled){transform:translateY(1px);box-shadow:none}
.ll-btn:disabled{opacity:.45;cursor:not-allowed}
.ll-btn-primary{background:linear-gradient(180deg,#b3382f,var(--rubric-2));border-color:#5e1512;color:#fbf0d8;text-shadow:0 1px 0 rgba(0,0,0,.35)}
.ll-btn-danger{border-color:var(--bad);color:var(--bad)}
.ll-btn-quiet{border-color:transparent;background:none;color:var(--ink-2)}
.ll-btn-quiet:hover:not(:disabled){color:var(--rubric);box-shadow:none;transform:none;text-decoration:underline}
.ll-seal{width:30px;height:30px;border-radius:50%;display:inline-grid;place-items:center;cursor:pointer;border:0;color:#fbf0d8;font-size:13px;background:radial-gradient(circle at 35% 30%,#c5473d,var(--rubric) 55%,#5e1512);box-shadow:0 1px 2px rgba(0,0,0,.5),inset 0 -2px 3px rgba(0,0,0,.25),inset 0 1px 1px rgba(255,220,200,.4);flex:none}
.ll-seal:hover{filter:brightness(1.12)}
.ll-seal.is-on{background:radial-gradient(circle at 35% 30%,var(--gold-2),var(--gold) 55%,var(--gold-ink));color:var(--ink)}

/* stats, meters, tags, tables */
.ll-stat{display:flex;align-items:baseline;justify-content:space-between;gap:var(--s-3);min-width:0}
.ll-stat-k{font-family:var(--f-head);font-size:var(--fs-s);letter-spacing:.06em;color:var(--ink-2)}
.ll-stat-v{font-variant-numeric:tabular-nums lining-nums;text-align:right;min-width:0}
.ll-meter{height:8px;border-radius:4px;background:rgba(42,29,20,.16);box-shadow:inset 0 1px 2px rgba(42,29,20,.3);overflow:hidden;min-width:48px}
.ll-meter>i{display:block;height:100%;border-radius:4px;transition:width .4s}
.ll-meter-good>i{background:var(--good)} .ll-meter-warn>i{background:var(--warn)} .ll-meter-bad>i{background:var(--bad)} .ll-meter-gold>i{background:linear-gradient(90deg,var(--gold),var(--gold-2))} .ll-meter-ink>i{background:var(--ink-2)}
.ll-tag{display:inline-block;font-family:var(--f-head);font-size:var(--fs-xs);letter-spacing:.07em;padding:1px 7px;border-radius:9px;border:1px solid var(--ink-3);color:var(--ink-2);white-space:nowrap}
.ll-tag-good{border-color:var(--good);color:var(--good)} .ll-tag-bad{border-color:var(--bad);color:var(--bad)} .ll-tag-gold{border-color:var(--gold-ink);color:var(--gold-ink);background:rgba(201,162,39,.14)} .ll-tag-lapis{border-color:var(--lapis);color:var(--lapis)}
.ll-table{width:100%;border-collapse:collapse;font-size:var(--fs-s)}
.ll-table th{font-family:var(--f-head);font-weight:400;letter-spacing:.07em;text-align:left;color:var(--ink-2);border-bottom:1px solid var(--parch-edge);padding:4px 8px}
.ll-table td{padding:5px 8px;border-bottom:1px dotted rgba(138,116,90,.5);vertical-align:top}
.ll-table td.ll-num,.ll-table th.ll-num{text-align:right}
.ll-table tr.is-link{cursor:pointer} .ll-table tr.is-link:hover td{background:rgba(201,162,39,.12)}
.ll-good{color:var(--good)} .ll-bad{color:var(--bad)} .ll-warn{color:var(--warn)} .ll-gold{color:var(--gold-ink)} .ll-rubric{color:var(--rubric)}

/* inputs */
.ll-input{font:inherit;color:var(--ink);background:rgba(255,250,235,.6);border:1px solid var(--ink-3);border-radius:var(--rad);padding:7px 10px;min-width:0;width:100%}
.ll-input::placeholder{color:var(--ink-3);font-style:italic}
.ll-range{accent-color:var(--rubric);width:100%}

/* full-screen surfaces */
.ll-veil{position:absolute;inset:0;background:radial-gradient(80% 70% at 50% 45%,rgba(14,10,8,.35),rgba(14,10,8,.82));display:grid;place-items:center;padding:var(--s-4);overflow:auto}
.ll-scrollbox{overflow:auto;scrollbar-width:thin;scrollbar-color:var(--parch-edge) transparent}
.ll-icon{width:1.15em;height:1.15em;display:inline-block;vertical-align:-.2em;flex:none}
.ll-tooltip{position:absolute;z-index:90;max-width:280px;padding:6px 10px;font-size:var(--fs-s);color:var(--ink);background:var(--parch);border:1px solid var(--parch-edge);border-radius:var(--rad);box-shadow:0 6px 18px rgba(0,0,0,.45);pointer-events:none}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation-duration:.001ms!important}}
`;
