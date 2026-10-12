/**
 * OWNER: ui-screens-a. Styles and small drawn pieces for the title, the new
 * reign charter, the Dynasty Hall, the end of a reign, settings and the
 * primer. Everything is prefixed `lla-`. Tokens come from css/base.ts.
 *
 * The SVG helpers here are drawn in code (no assets): the pen-flourished
 * initial, wax seals (whole or broken), the die, the manicule, the emblems
 * of the two modes, and the hook in the empty hall.
 */

// ───────────── parchment grain (an SVG noise tile, rasterised once by the browser) ─────────────
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .3 0 0 0 0 .2 0 0 0 0 .1 0 0 0 .5 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E")`;
const STAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600'%3E%3Cfilter id='s'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.008' numOctaves='3' seed='4'/%3E%3CfeColorMatrix values='0 0 0 0 .45 0 0 0 0 .3 0 0 0 0 .12 0 0 0 1.2 -.55'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23s)' opacity='.35'/%3E%3C/svg%3E")`;

export const SCREENS_A_CSS = `
.lla-root{position:absolute;inset:0;pointer-events:auto;color:var(--parch);font-family:var(--f-body);
  --lla-parch: radial-gradient(120% 80% at 15% 0%,rgba(255,251,236,.7),transparent 55%),
    radial-gradient(90% 70% at 100% 100%,rgba(150,108,58,.28),transparent 62%),
    radial-gradient(60% 45% at 0% 100%,rgba(140,100,50,.18),transparent 70%),
    ${STAIN}, ${GRAIN},
    linear-gradient(180deg,var(--parch),var(--parch-2));
  --lla-parch-size: auto,auto,auto,600px 600px,240px 240px,auto}
.lla-root[hidden],.lla-root [hidden]{display:none!important}
.lla-root.lla-title{pointer-events:none}
.lla-title>*{pointer-events:auto}
.lla-title>.lla-shade{pointer-events:none}
.lla-root :focus-visible{outline:2px solid var(--gold-2);outline-offset:2px}
.lla-sheet :focus-visible,.lla-sheet:focus-visible{outline-color:var(--rubric)}

/* ── the deckled sheet: parchment drawn behind content, edges roughened by an SVG filter ── */
.lla-sheet{position:relative;isolation:isolate;color:var(--ink)}
.lla-sheet::before{content:'';position:absolute;inset:0;z-index:-1;background:var(--lla-parch);background-size:var(--lla-parch-size);border-radius:2px;
  filter:url(#lla-deckle) drop-shadow(0 16px 26px rgba(0,0,0,.55)) drop-shadow(0 2px 4px rgba(0,0,0,.4))}
.lla-rules{position:absolute;inset:12px;border:1px solid rgba(158,43,37,.4);pointer-events:none;z-index:0}
.lla-rules::after{content:'';position:absolute;inset:3px;border:1px solid rgba(158,43,37,.24)}
.lla-close{position:absolute;top:18px;right:18px;z-index:2}

@keyframes lla-rise{from{opacity:0;transform:translateY(16px) scale(.985)}to{opacity:1;transform:none}}
@keyframes lla-fade{from{opacity:0}to{opacity:1}}
@keyframes lla-slide{from{opacity:0;transform:translateX(-22px)}to{opacity:1;transform:none}}
@keyframes lla-glint{0%,52%{background-position:160% 0,0 0}82%,100%{background-position:-60% 0,0 0}}
@keyframes lla-stamp{0%{transform:scale(1)}35%{transform:scale(1.22) rotate(-6deg);filter:drop-shadow(0 18px 14px rgba(0,0,0,.45))}62%{transform:scale(.9) rotate(2deg);filter:drop-shadow(0 1px 1px rgba(0,0,0,.5))}100%{transform:scale(1) rotate(0)}}
@keyframes lla-thump{0%{opacity:0;transform:scale(1.6) rotate(-14deg)}60%{opacity:1;transform:scale(.94) rotate(2deg)}100%{opacity:1;transform:scale(1) rotate(-4deg)}}
@keyframes lla-shake{0%,100%{transform:none}20%{transform:translateX(-6px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(2px)}}
@keyframes lla-roll{0%{transform:rotate(0) scale(1)}40%{transform:rotate(200deg) scale(1.18)}100%{transform:rotate(360deg) scale(1)}}

/* ── gold leaf: a raised gilded word, burnished, with a slow glint ── */
.lla-gold{color:var(--gold);background-image:linear-gradient(100deg,transparent 38%,rgba(255,252,236,.95) 48%,transparent 58%),
  linear-gradient(172deg,#f7e49a 0%,#e1bd55 18%,#a97f17 40%,#f0d47c 55%,#97700f 73%,#d8b347 90%,#f2db8c 100%);
  background-size:260% 100%,100% 100%;background-repeat:no-repeat;background-position:160% 0,0 0;
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;-webkit-text-stroke:.8px rgba(66,40,6,.92);
  filter:drop-shadow(0 1px 0 rgba(255,250,228,.8)) drop-shadow(0 2px 1.5px rgba(58,36,6,.45));animation:lla-glint 9s ease-in-out 1.4s infinite}

/* ── the pen-flourished initial ── */
.lla-init{--s:104px;position:relative;width:var(--s);height:var(--s);display:grid;place-items:center;flex:none}
.lla-init>svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.lla-init>b{position:relative;font:400 calc(var(--s) * .84)/1 var(--f-black);color:var(--rubric);transform:translate(1%,5%);
  text-shadow:0 1px 0 rgba(255,246,226,.75),0 0 1px rgba(80,12,10,.55)}
.lla-pw{fill:none;stroke:var(--lapis);stroke-width:1.05;stroke-linecap:round;stroke-linejoin:round}
.lla-pw-thin{fill:none;stroke:var(--lapis);stroke-width:.7;stroke-linecap:round;opacity:.85}
.lla-pw-dot{fill:var(--lapis)}
.lla-pw-gold{fill:none;stroke:var(--gold);stroke-width:2.4}
.lla-pw-goldline{fill:none;stroke:var(--gold-ink);stroke-width:.6;opacity:.8}
.lla-pw-ground{fill:rgba(47,74,122,.07)}
.lla-pw-red{fill:none;stroke:var(--rubric);stroke-width:.8;stroke-linecap:round;opacity:.8}

/* ── wax ── */
.lla-wax{display:block;overflow:visible}
.lla-wax .w-body{fill:url(#lla-wax-g)}
.lla-wax .w-rim{fill:none;stroke:rgba(58,6,4,.5);stroke-width:2.6}
.lla-wax .w-rim-hi{fill:none;stroke:rgba(255,190,170,.35);stroke-width:1.2}
.lla-wax .w-dots{fill:rgba(60,6,4,.45)}
.lla-wax .w-sh{fill:rgba(50,4,2,.55)}
.lla-wax .w-hi{fill:rgba(255,205,185,.55)}
.lla-wax .w-em{fill:#8a221c}
.lla-wax .w-crack{fill:none;stroke:rgba(30,2,0,.85);stroke-width:2.2;stroke-linejoin:round}
.lla-wax .w-drip{fill:url(#lla-wax-g)}

/* ── buttons shared ── */
.lla-btnrow{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.lla-root .ll-btn{min-height:36px}
.lla-big{font-size:var(--fs-m);padding:9px 18px}

/* ═════════════════════════ TITLE ═════════════════════════ */
.lla-title{display:flex;align-items:center;padding:24px clamp(20px,4.5vw,64px)}
.lla-shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(9,6,4,.62),rgba(9,6,4,.2) 34%,rgba(9,6,4,0) 56%),linear-gradient(0deg,rgba(9,6,4,.35),transparent 22%)}
.lla-leaf{position:relative;width:404px;max-width:100%;max-height:100%;display:flex;flex-direction:column;padding:34px 34px 20px;animation:lla-slide .7s cubic-bezier(.2,.8,.2,1) both}
.lla-leaf .lla-rules{inset:13px}
.lla-head{position:relative;z-index:1}
.lla-logo{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:10px;margin:0}
.lla-logo .lla-init{grid-row:1 / span 2}
.lla-word{font:400 64px/.95 var(--f-black);letter-spacing:.005em;align-self:end;margin:0 0 2px;white-space:nowrap}
.lla-tagline{font:italic 17px/1.3 var(--f-body);color:var(--ink-2);margin:6px 0 0;align-self:start;max-width:16em}
.lla-tail{position:absolute;left:-24px;top:112px;width:14px;height:162px;overflow:visible;pointer-events:none;opacity:.8}
.lla-orn{display:flex;justify-content:center;margin:16px 0 8px;color:var(--ink-3)}
.lla-orn>*{max-width:100%}
.lla-orn>hr{flex:0 1 72%;margin:0}
.lla-menu{position:relative;z-index:1;display:flex;flex-direction:column;min-height:0}
.lla-items{display:flex;flex-direction:column;overflow:auto;scrollbar-width:thin;scrollbar-color:var(--parch-edge) transparent}
.lla-mi{position:relative;display:grid;grid-template-columns:26px 1fr;align-items:center;column-gap:8px;width:100%;padding:9px 10px 9px 4px;text-align:left;border:0;border-bottom:1px dotted rgba(138,116,90,.65);background:none;color:var(--ink);cursor:pointer;font-family:var(--f-head);font-size:19px;letter-spacing:.05em;line-height:1.15;transition:background .18s,color .18s}
.lla-mi:first-child{border-top:1px dotted rgba(138,116,90,.65)}
.lla-mi-mark{position:relative;display:grid;place-items:center;height:22px}
.lla-pil,.lla-hand{grid-area:1/1;transition:opacity .16s,transform .2s}
.lla-pil{font:20px/1 var(--f-body);color:var(--lapis)}
.lla-mi:nth-child(odd) .lla-pil{color:var(--rubric)}
.lla-hand{width:26px;height:16px;opacity:0;transform:translateX(-7px);color:var(--ink)}
.lla-mi:hover,.lla-mi:focus-visible{background:linear-gradient(90deg,rgba(201,162,39,.22),rgba(201,162,39,0) 88%);color:var(--rubric);outline:none}
.lla-mi:focus-visible{box-shadow:inset 3px 0 0 var(--gold)}
.lla-mi:hover .lla-hand,.lla-mi:focus-visible .lla-hand{opacity:1;transform:none}
.lla-mi:hover .lla-pil,.lla-mi:focus-visible .lla-pil{opacity:0}
.lla-mi-label{display:block}
.lla-mi.is-primary .lla-mi-label{color:var(--rubric);font-size:21px}
.lla-mi-sub{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;font:italic 15px/1.25 var(--f-body);letter-spacing:0;color:var(--ink-2);margin-top:3px}
.lla-mi-sub .ll-tag{font-style:normal}
.lla-foot{position:relative;z-index:1;display:grid;grid-template-columns:64px 1fr 64px;align-items:end;gap:6px;margin-top:14px}
.lla-foot p{margin:0 0 4px;font:italic 13px/1.35 var(--f-body);color:var(--ink-3);text-align:center;text-wrap:balance}
.lla-doodle{display:block;line-height:0;color:var(--ink)}
.lla-doodle svg{display:block;width:100%;height:auto;max-height:72px}
.lla-doodle.flip svg{transform:scaleX(-1)}
.lla-foot-solo{grid-template-columns:1fr}

/* charter + hall frames inside the title */
.lla-pane{position:absolute;inset:0;display:grid;place-items:center;padding:28px 20px;overflow:auto;background:radial-gradient(85% 75% at 50% 45%,rgba(12,8,6,.28),rgba(12,8,6,.74));animation:lla-fade .3s ease both;scrollbar-width:thin;scrollbar-color:var(--parch-edge) transparent}

/* ═════════════════════════ THE CHARTER (new reign) ═════════════════════════ */
.lla-charter{width:min(800px,100%);padding:42px 54px 34px;animation:lla-rise .5s cubic-bezier(.2,.8,.2,1) both}
.lla-charter.is-shake{animation:lla-shake .4s}
.lla-kicker{display:flex;align-items:center;gap:14px;justify-content:center;font:14px/1 var(--f-head);letter-spacing:.26em;color:var(--rubric);text-transform:uppercase;margin:0 0 18px}
.lla-kicker::before,.lla-kicker::after{content:'';flex:1;max-width:140px;height:1px;background:linear-gradient(90deg,transparent,var(--parch-edge))}
.lla-kicker::after{transform:scaleX(-1)}
.lla-grant{position:relative;font:20px/1.85 var(--f-body);color:var(--ink);margin:0;text-wrap:pretty}
.lla-grant .lla-init{--s:86px;float:left;margin:6px 16px 0 0;shape-outside:margin-box}
.lla-lead{font-family:var(--f-head);letter-spacing:.07em;color:var(--ink)}
.lla-blank{font:italic 22px/1.3 var(--f-body);color:var(--lapis);background:transparent;border:0;border-bottom:1.5px dotted var(--ink-3);border-radius:0;padding:0 6px 1px;width:9.5em;max-width:100%;text-align:center;outline:none;vertical-align:baseline;transition:background .15s,border-color .15s}
.lla-blank.lla-wide{width:11em}
.lla-blank:focus{border-bottom:1.5px solid var(--rubric);background:rgba(255,250,235,.55)}
.lla-blank:focus-visible{outline:none}
.lla-realmfield{white-space:nowrap}
.lla-blank::placeholder{color:var(--ink-3);font-style:italic;opacity:.9}
.lla-blank.is-wanting{border-bottom-color:var(--rubric);background:rgba(158,43,37,.08)}
.lla-die{display:inline-grid;place-items:center;width:34px;height:34px;vertical-align:-9px;margin:0 2px 0 4px;padding:0;border:0;background:none;cursor:pointer;color:var(--ink);transition:transform .15s}
.lla-die:hover{transform:rotate(-10deg) scale(1.08)}
.lla-die.is-rolling svg{animation:lla-roll .55s cubic-bezier(.3,.7,.3,1)}
.lla-die svg{width:30px;height:30px;overflow:visible}
.lla-want{min-height:20px;margin:2px 0 0;font:italic 15px/1.3 var(--f-body);color:var(--rubric)}
.lla-terms-h{font:15px/1 var(--f-head);letter-spacing:.14em;color:var(--ink-2);margin:12px 0 12px;text-align:center}
.lla-terms{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:0 6px}
.lla-term{position:relative;display:flex;flex-direction:column;gap:8px;text-align:left;cursor:pointer;padding:18px 18px 16px;border-radius:3px;border:1px solid var(--parch-edge);color:var(--ink);
  background:linear-gradient(180deg,rgba(255,251,238,.62),rgba(222,204,160,.42));box-shadow:inset 0 1px 0 rgba(255,251,238,.7),0 3px 8px rgba(42,29,20,.14);
  transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s,border-color .2s,filter .2s;filter:saturate(.75) brightness(.97)}
.lla-term:nth-child(1){transform:rotate(-.7deg)}
.lla-term:nth-child(2){transform:rotate(.7deg)}
.lla-term:hover{filter:none}
.lla-term[aria-checked="true"]{transform:translateY(-3px);filter:none;border-color:var(--gold-ink);box-shadow:inset 0 0 0 1px rgba(201,162,39,.9),inset 0 0 22px rgba(201,162,39,.18),0 10px 20px rgba(42,29,20,.22)}
.lla-term.is-iron{background:linear-gradient(180deg,rgba(246,242,234,.6),rgba(196,190,178,.42))}
.lla-term-head{display:flex;align-items:center;gap:12px}
.lla-term-head svg{width:44px;height:44px;flex:none}
.lla-term-name{font:23px/1.1 var(--f-head);letter-spacing:.04em;color:var(--rubric)}
.lla-term.is-iron .lla-term-name{color:#3b3a40}
.lla-term-line{font:italic 17px/1.4 var(--f-body);color:var(--ink);margin:0}
.lla-term ul{list-style:none;margin:2px 0 0;padding:0;display:flex;flex-direction:column;gap:3px;font:14px/1.35 var(--f-body);color:var(--ink-2)}
.lla-term li{padding-left:16px;position:relative}
.lla-term li::before{content:'¶';position:absolute;left:0;top:0;color:var(--rubric);font-size:13px}
.lla-term-heir{margin-top:2px;font:italic 14px/1.35 var(--f-body);color:var(--gold-ink)}
.lla-chosen{position:absolute;top:-14px;right:-12px;width:44px;height:44px;opacity:0;pointer-events:none}
.lla-term[aria-checked="true"] .lla-chosen{animation:lla-thump .38s cubic-bezier(.3,1.4,.5,1) both}
.lla-charter-foot{display:grid;grid-template-columns:1fr auto;align-items:end;gap:18px;margin-top:22px}
.lla-witness{font:italic 15px/1.45 var(--f-body);color:var(--ink-2);margin:0}
.lla-replace{display:block;margin-top:4px;color:var(--rubric);font-size:14px}
.lla-sealbtn{display:flex;flex-direction:column;align-items:center;gap:2px;border:0;background:none;padding:0;cursor:pointer;color:var(--rubric);font:15px/1 var(--f-head);letter-spacing:.12em}
.lla-sealbtn .lla-wax{width:86px;height:86px;transition:transform .2s,filter .2s;filter:drop-shadow(0 4px 4px rgba(42,10,5,.35))}
.lla-sealbtn:hover .lla-wax{transform:translateY(-2px) rotate(-4deg);filter:drop-shadow(0 8px 7px rgba(42,10,5,.35))}
.lla-sealbtn.is-sealing .lla-wax{animation:lla-stamp .62s cubic-bezier(.3,.7,.3,1) both}
.lla-sealbtn:focus-visible{outline-offset:6px}
.lla-sealbtn:disabled{cursor:default}
.lla-back{margin-top:16px;display:flex;justify-content:flex-start}

/* ═════════════════════════ THE DYNASTY HALL ═════════════════════════ */
.lla-hall{position:relative;width:min(1040px,100%);max-height:100%;display:flex;flex-direction:column;border-radius:4px;padding:30px 34px 26px;color:var(--parch);animation:lla-rise .5s cubic-bezier(.2,.8,.2,1) both;
  background:radial-gradient(70% 55% at 50% 0%,rgba(255,196,110,.16),transparent 70%),
    repeating-linear-gradient(90deg,rgba(0,0,0,.18) 0 2px,transparent 2px 148px),
    repeating-linear-gradient(90deg,rgba(255,220,170,.035) 0 1px,transparent 1px 7px,rgba(0,0,0,.05) 7px 9px,transparent 9px 23px),
    linear-gradient(180deg,#3d2819,#2a1b11 60%,#22160e);
  box-shadow:inset 0 0 0 1px rgba(255,220,170,.08),inset 0 0 60px rgba(0,0,0,.55),0 20px 40px rgba(0,0,0,.6)}
.lla-hall::before{content:'';position:absolute;left:0;right:0;top:0;height:14px;border-radius:4px 4px 0 0;background:linear-gradient(180deg,#5a3c25,#3a2618);box-shadow:0 2px 3px rgba(0,0,0,.5)}
.lla-hall-head{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;margin:6px 0 20px;padding-right:36px}
.lla-hall-title{font:400 46px/1 var(--f-black);margin:0}
.lla-hall-sub{font:italic 16px/1.35 var(--f-body);color:rgba(239,227,196,.78);margin:0 0 5px}
.lla-hall .lla-close{top:24px;right:22px}
.lla-wall{display:flex;flex-wrap:wrap;justify-content:center;align-content:flex-start;gap:22px 20px;overflow:auto;padding:6px 6px 10px;min-height:0;scrollbar-width:thin;scrollbar-color:rgba(201,162,39,.5) transparent}
.lla-plaque{position:relative;flex:0 1 300px;min-width:0;padding:20px 18px 16px;text-align:center;color:#2f2008;border-radius:3px;outline-offset:3px;
  background:radial-gradient(120% 70% at 30% 0%,rgba(255,248,215,.55),transparent 60%),linear-gradient(160deg,#e9cf7e,#c9a446 38%,#e2c26a 58%,#b48d33 100%);
  box-shadow:inset 0 0 0 1px rgba(255,244,200,.55),inset 0 0 0 5px rgba(120,86,20,.22),inset 0 0 0 6px rgba(255,240,190,.35),0 1px 0 rgba(255,220,150,.2),0 6px 12px rgba(0,0,0,.55)}
.lla-plaque.is-iron{color:#1f1f24;background:radial-gradient(120% 70% at 30% 0%,rgba(255,255,255,.4),transparent 60%),linear-gradient(160deg,#c9c8c4,#9d9b97 40%,#bdbbb5 60%,#86847f 100%);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.5),inset 0 0 0 5px rgba(40,40,46,.2),inset 0 0 0 6px rgba(255,255,255,.3),0 6px 12px rgba(0,0,0,.6)}
.lla-plaque *{text-shadow:0 1px 0 rgba(255,246,214,.45)}
.lla-plaque.is-iron *{text-shadow:0 1px 0 rgba(255,255,255,.4)}
.lla-screw{position:absolute;top:8px;width:8px;height:8px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#f5e3a8,#7a5a1a 70%);box-shadow:0 1px 1px rgba(0,0,0,.4)}
.lla-screw::after{content:'';position:absolute;left:1px;right:1px;top:3.5px;height:1px;background:rgba(60,40,8,.7);transform:rotate(35deg)}
.is-iron .lla-screw{background:radial-gradient(circle at 35% 30%,#fff,#5d5c60 70%)}
.lla-screw-l{left:8px}.lla-screw-r{right:8px}
.lla-plaque-top{display:flex;justify-content:space-between;gap:8px;font:12px/1 var(--f-head);letter-spacing:.14em;opacity:.85;margin:0 10px 8px}
.lla-plaque-crest{display:flex;justify-content:center;margin:2px 0 4px;line-height:0}
.lla-plaque-crest svg{width:40px;height:auto;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))}
.lla-plaque-name{font:400 30px/1.05 var(--f-black);margin:2px 0 2px}
.lla-plaque-realm{font:15px/1.2 var(--f-head);letter-spacing:.06em;margin:0 0 10px}
.lla-plaque-stats{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid rgba(60,40,8,.35);border-bottom:1px solid rgba(60,40,8,.35);padding:7px 0 6px;margin:0 0 10px}
.is-iron .lla-plaque-stats{border-color:rgba(30,30,36,.35)}
.lla-plaque-stats div{display:flex;flex-direction:column;gap:1px}
.lla-plaque-stats div+div{border-left:1px dotted rgba(60,40,8,.4)}
.lla-plaque-stats b{font:400 21px/1.05 var(--f-body);font-variant-numeric:lining-nums tabular-nums}
.lla-plaque-stats span{font:12px/1.2 var(--f-head);letter-spacing:.08em;opacity:.85}
.lla-plaque-epitaph{font:italic 16px/1.35 var(--f-body);margin:0 4px 8px;text-wrap:balance}
.lla-plaque-heir{display:flex;gap:6px;justify-content:center;align-items:baseline;font:italic 14px/1.3 var(--f-body);margin:0}
.lla-plaque-heir b{font:12px/1 var(--f-head);font-style:normal;letter-spacing:.1em}
.lla-plaque-end{font:12px/1.2 var(--f-head);letter-spacing:.08em;opacity:.7;margin:8px 0 0}
.lla-empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:46px 20px 52px;text-align:center}
.lla-empty svg{width:70px;height:96px}
.lla-empty p{font:italic 19px/1.45 var(--f-body);color:rgba(239,227,196,.86);margin:0;max-width:26em;text-wrap:balance}
.lla-hall-foot{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:16px;flex-wrap:wrap}
.lla-hall-foot .ll-btn-quiet{color:rgba(239,227,196,.8)}
.lla-hall-foot .ll-btn-quiet:hover{color:var(--gold-2)}
.lla-hall-count{font:14px/1 var(--f-head);letter-spacing:.12em;color:rgba(227,192,90,.85)}

/* ═════════════════════════ END OF REIGN ═════════════════════════ */
.lla-end-veil{display:grid;place-items:center;padding:56px 18px 24px;overflow:auto;background:radial-gradient(80% 70% at 50% 42%,rgba(10,6,4,.5),rgba(6,4,3,.9));animation:lla-fade .6s ease both;scrollbar-width:thin;scrollbar-color:var(--parch-edge) transparent}
@supports (backdrop-filter:saturate(.5)){.lla-end-veil.is-end{backdrop-filter:saturate(.35) sepia(.25)}}
.lla-end{width:min(720px,100%);padding:56px 56px 30px;text-align:center;animation:lla-rise .7s .15s cubic-bezier(.2,.8,.2,1) both}
.lla-end-seal{position:absolute;left:50%;top:-46px;width:100px;height:100px;margin-left:-50px;z-index:2;animation:lla-thump .5s .55s cubic-bezier(.3,1.4,.5,1) both}
.lla-end-seal .lla-wax{width:100%;height:100%;filter:drop-shadow(0 6px 6px rgba(0,0,0,.45))}
.lla-end-kicker{font:14px/1 var(--f-head);letter-spacing:.28em;color:var(--ink-2);text-transform:uppercase;margin:0 0 12px}
.lla-end-name{font:400 58px/1 var(--f-black);color:var(--ink);margin:0 0 6px;text-wrap:balance}
.lla-end-name::first-letter{color:var(--rubric)}
.lla-end-realm{font:20px/1.2 var(--f-head);letter-spacing:.06em;color:var(--rubric);margin:0 0 12px}
.lla-end-crest{display:flex;justify-content:center;margin:-4px 0 8px;line-height:0}
.lla-end-crest svg{width:42px;height:auto;filter:drop-shadow(0 1px 1px rgba(42,29,20,.3))}
.lla-end-why{font:italic 17px/1.45 var(--f-body);color:var(--ink-2);margin:0 auto 14px;max-width:30em;text-wrap:balance}
.lla-epitaph{position:relative;display:table;font:italic 25px/1.4 var(--f-body);color:var(--ink);margin:4px auto 8px;max-width:24em;padding:0 34px;text-wrap:balance}
.lla-epitaph::before,.lla-epitaph::after{position:absolute;font:56px/1 var(--f-body);color:var(--rubric);opacity:.85}
.lla-epitaph::before{content:'\\201C';left:0;top:-10px}
.lla-epitaph::after{content:'\\201D';right:0;bottom:-28px}
.lla-tallies{display:flex;flex-wrap:wrap;justify-content:center;margin:12px -6px 4px}
.lla-tally{flex:0 0 33.333%;display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 6px 10px;position:relative}
.lla-tally b{font:400 32px/1 var(--f-body);font-variant-numeric:lining-nums tabular-nums;color:var(--ink)}
.lla-tally b.is-bad{color:var(--rubric)}
.lla-tally span{font:13px/1.2 var(--f-head);letter-spacing:.09em;color:var(--ink-2)}
.lla-tally:not(:nth-child(3n+1))::before{content:'';position:absolute;left:0;top:14px;bottom:16px;border-left:1px dotted rgba(138,116,90,.7)}
.lla-tally:nth-child(n+4){border-top:1px dotted rgba(138,116,90,.7)}
.lla-end-when{font:15px/1.3 var(--f-head);letter-spacing:.06em;color:var(--ink-2);margin:-6px 0 14px}
.lla-heir{display:flex;align-items:center;gap:14px;text-align:left;margin:12px auto 4px;max-width:30em;padding:12px 18px;border:1px solid var(--gold-ink);border-radius:3px;
  background:linear-gradient(180deg,rgba(201,162,39,.16),rgba(201,162,39,.06));box-shadow:inset 0 0 0 3px rgba(255,248,225,.5),inset 0 0 0 4px rgba(122,94,18,.35);animation:lla-fade .6s ease both}
.lla-heir .ll-icon{width:34px;height:34px;color:var(--gold-ink);flex:none}
.lla-heir-k{display:block;font:13px/1 var(--f-head);letter-spacing:.14em;color:var(--gold-ink);margin-bottom:5px}
.lla-heir-v{display:block;font:italic 20px/1.3 var(--f-body);color:var(--ink)}
.lla-end-body{font:18px/1.55 var(--f-body);color:var(--ink);max-width:30em;margin:0 auto 6px;text-wrap:pretty}
.lla-end-sub{font:16px/1.2 var(--f-head);letter-spacing:.1em;color:var(--ink-2);margin:18px 0 0}
.lla-end .lla-btnrow{justify-content:center;margin-top:20px}

/* ═════════════════════════ SETTINGS ═════════════════════════ */
.lla-modal{display:grid;place-items:center;padding:20px 16px;overflow:auto;background:radial-gradient(80% 70% at 50% 45%,rgba(14,10,8,.35),rgba(14,10,8,.8));animation:lla-fade .25s ease both;scrollbar-width:thin;scrollbar-color:var(--parch-edge) transparent}
.lla-set{width:min(580px,100%);animation:lla-rise .4s cubic-bezier(.2,.8,.2,1) both}
.lla-set .ll-panel-head{padding:16px 20px 10px}
.lla-set .ll-panel-body{padding:6px 22px 20px;gap:0}
.lla-ptitle{display:flex;align-items:baseline;gap:10px;flex:1;min-width:0;flex-wrap:wrap}
.lla-ptitle .ll-title{flex:none;font-size:24px}
.lla-ptitle .ll-sub{font-style:italic;font-family:var(--f-body);letter-spacing:0;font-size:15px}
.lla-sec{padding:14px 0 12px;border-bottom:1px dotted rgba(138,116,90,.6);display:flex;flex-direction:column;gap:12px}
.lla-sec:last-of-type{border-bottom:0}
.lla-sec-h{display:flex;align-items:center;gap:10px;font:14px/1 var(--f-head);letter-spacing:.16em;color:var(--rubric);text-transform:uppercase;margin:0}
.lla-sec-h::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,var(--parch-edge),transparent)}
.lla-row{display:grid;grid-template-columns:150px 1fr auto;align-items:center;gap:6px 14px}
.lla-row-k{font:16px/1.2 var(--f-head);letter-spacing:.05em;color:var(--ink)}
.lla-row-v{font:15px/1 var(--f-body);font-variant-numeric:lining-nums tabular-nums;color:var(--ink-2);min-width:2.2em;text-align:right}
.lla-row-note{grid-column:2 / -1;font:italic 14px/1.35 var(--f-body);color:var(--ink-2);margin:-2px 0 0}
.lla-seg{display:inline-flex;border:1px solid var(--ink-3);border-radius:3px;overflow:hidden;background:rgba(255,250,235,.35);justify-self:start}
.lla-seg button{display:inline-flex;align-items:center;gap:7px;border:0;background:none;padding:7px 14px;font:15px/1 var(--f-head);letter-spacing:.06em;color:var(--ink-2);cursor:pointer;transition:background .15s,color .15s;min-height:34px}
.lla-seg button+button{border-left:1px solid var(--ink-3)}
.lla-seg button::before{content:'';width:9px;height:9px;border-radius:50%;border:1px solid var(--ink-3);flex:none;transition:background .15s}
.lla-seg button[aria-checked="true"]{background:linear-gradient(180deg,rgba(201,162,39,.32),rgba(201,162,39,.16));color:var(--ink);box-shadow:inset 0 1px 2px rgba(122,94,18,.35)}
.lla-seg button[aria-checked="true"]::before{border-color:#5e1512;background:radial-gradient(circle at 35% 30%,#c5473d,var(--rubric) 55%,#5e1512)}
.lla-seg button:hover:not([aria-checked="true"]){background:rgba(201,162,39,.12);color:var(--ink)}
.lla-range{-webkit-appearance:none;appearance:none;width:100%;height:22px;background:none;cursor:pointer;--v:50%}
.lla-range::-webkit-slider-runnable-track{height:5px;border-radius:3px;background:linear-gradient(90deg,var(--rubric) var(--v),rgba(42,29,20,.18) var(--v));box-shadow:inset 0 1px 1px rgba(42,29,20,.35)}
.lla-range::-moz-range-track{height:5px;border-radius:3px;background:rgba(42,29,20,.18)}
.lla-range::-moz-range-progress{height:5px;border-radius:3px;background:var(--rubric)}
.lla-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:20px;height:20px;margin-top:-7.5px;border-radius:50%;border:0;background:radial-gradient(circle at 35% 30%,#d4574c,var(--rubric) 55%,#5e1512);box-shadow:0 1px 3px rgba(0,0,0,.45),inset 0 -2px 3px rgba(0,0,0,.25)}
.lla-range::-moz-range-thumb{width:20px;height:20px;border-radius:50%;border:0;background:radial-gradient(circle at 35% 30%,#d4574c,var(--rubric) 55%,#5e1512);box-shadow:0 1px 3px rgba(0,0,0,.45)}
.lla-range:focus-visible{outline-offset:4px}
.lla-switch{display:inline-flex;align-items:center;gap:10px;border:0;background:none;padding:2px 0;cursor:pointer;font:15px/1 var(--f-head);letter-spacing:.06em;color:var(--ink-2);justify-self:start}
.lla-switch i{position:relative;width:46px;height:24px;border-radius:12px;background:rgba(42,29,20,.18);box-shadow:inset 0 1px 2px rgba(42,29,20,.4);transition:background .2s}
.lla-switch i::after{content:'';position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fffaf0,#cdbb93 70%);box-shadow:0 1px 2px rgba(0,0,0,.4);transition:transform .2s,background .2s}
.lla-switch[aria-checked="true"] i{background:rgba(158,43,37,.75)}
.lla-switch[aria-checked="true"] i::after{transform:translateX(22px);background:radial-gradient(circle at 35% 30%,var(--gold-2),var(--gold) 55%,var(--gold-ink))}
.lla-switch[aria-checked="true"]{color:var(--ink)}
.lla-keyfield{display:flex;gap:6px;align-items:center;min-width:0}
.lla-keyfield .ll-input{font-family:var(--f-body);letter-spacing:.04em}
.lla-eye{flex:none}
.lla-set-foot{display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center;padding-top:14px;border-top:1px solid var(--parch-edge);margin-top:4px}
.lla-set-foot .lla-note{font:italic 14px/1.3 var(--f-body);color:var(--ink-2)}

/* ═════════════════════════ HELP ═════════════════════════ */
.lla-help{width:min(900px,100%);height:min(760px,calc(100vh - 40px));animation:lla-rise .4s cubic-bezier(.2,.8,.2,1) both}
.lla-help .ll-panel-head{padding:16px 22px 12px}
.lla-help .ll-panel-body{padding:0;flex:1;min-height:0;display:grid;grid-template-columns:200px 1fr;gap:0;overflow:hidden}
.lla-toc{padding:16px 10px 16px 18px;border-right:1px solid var(--parch-edge);display:flex;flex-direction:column;gap:2px;overflow:auto;background:linear-gradient(90deg,rgba(158,43,37,.04),transparent)}
.lla-toc button{display:grid;grid-template-columns:28px 1fr;align-items:baseline;text-align:left;border:0;background:none;padding:7px 8px;border-radius:3px;cursor:pointer;font:15px/1.2 var(--f-head);letter-spacing:.04em;color:var(--ink-2);transition:background .15s,color .15s}
.lla-toc button i{font:italic 14px/1 var(--f-body);color:var(--rubric)}
.lla-toc button:hover,.lla-toc button.is-on{background:rgba(201,162,39,.18);color:var(--ink)}
.lla-toc-doodle{margin-top:auto;padding-top:14px;opacity:.9}
.lla-article{overflow:auto;padding:8px 30px 30px;scroll-behavior:smooth;scrollbar-width:thin;scrollbar-color:var(--parch-edge) transparent}
.lla-hsec{padding:18px 0 16px;border-bottom:1px dotted rgba(138,116,90,.55);display:flow-root}
.lla-hsec:last-child{border-bottom:0}
.lla-hsec h3{display:flex;align-items:baseline;gap:10px;font:22px/1.15 var(--f-head);letter-spacing:.04em;color:var(--rubric);margin:0 0 8px}
.lla-hsec h3 i{font:italic 17px/1 var(--f-body);color:var(--ink-3)}
.lla-hsec p{font:17px/1.55 var(--f-body);color:var(--ink);margin:0 0 8px;text-wrap:pretty}
.lla-hsec p.ll-dropcap::first-letter{font-size:3.3em;line-height:.78;padding:.08em .08em 0 0}
.lla-hsec .lla-doodle{float:right;width:96px;margin:0 0 6px 18px;shape-outside:margin-box}
.lla-hsec .lla-doodle svg{max-height:96px}
.lla-sayings{display:flex;flex-direction:column;gap:6px;margin:10px 0 4px;padding:0;list-style:none}
.lla-saying{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:1px solid rgba(138,116,90,.55);border-left:3px solid var(--lapis);border-radius:2px 3px 3px 2px;background:rgba(255,250,235,.45);padding:8px 12px;cursor:pointer;font:italic 17px/1.35 var(--f-body);color:var(--lapis);transition:background .15s,border-color .15s,transform .12s}
.lla-sayings li:nth-child(even) .lla-saying{border-left-color:var(--rubric)}
.lla-saying span{flex:1;min-width:0}
.lla-saying em{font:12px/1 var(--f-head);font-style:normal;letter-spacing:.1em;color:var(--ink-3);white-space:nowrap;transition:color .15s}
.lla-saying:hover,.lla-saying:focus-visible{background:rgba(201,162,39,.16);border-color:var(--gold-ink)}
.lla-saying:hover em,.lla-saying:focus-visible em{color:var(--rubric)}
.lla-saying:active{transform:translateY(1px)}
.lla-saying .ll-icon{color:var(--ink-3)}
.lla-keys{display:grid;grid-template-columns:auto 1fr;gap:7px 16px;align-items:baseline;margin:6px 0 0}
.lla-keys dt{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}
.lla-keys dd{margin:0;font:16px/1.4 var(--f-body);color:var(--ink)}
.lla-root kbd{display:inline-block;min-width:26px;padding:3px 7px 2px;text-align:center;font:14px/1.1 var(--f-head);letter-spacing:.04em;color:var(--ink);background:linear-gradient(180deg,#fbf4e0,#e2d1a6);border:1px solid var(--ink-3);border-radius:4px;box-shadow:0 2px 0 var(--ink-3),inset 0 1px 0 rgba(255,255,255,.7)}

/* ═════════════════════════ narrow screens ═════════════════════════ */
@media (max-width:699px){
  .lla-title{align-items:stretch;padding:max(14px,env(safe-area-inset-top)) 16px max(14px,env(safe-area-inset-bottom))}
  .lla-shade{background:linear-gradient(180deg,rgba(9,6,4,.5),transparent 30%,transparent 55%,rgba(9,6,4,.6))}
  .lla-leaf{width:100%;max-height:none;padding:0;justify-content:space-between;gap:14px}
  .lla-leaf.lla-sheet::before,.lla-leaf>.lla-rules{display:none}
  .lla-head,.lla-menu{position:relative;isolation:isolate;padding:16px 18px 14px}
  .lla-head::before,.lla-menu::before{content:'';position:absolute;inset:0;z-index:-1;background:var(--lla-parch);background-size:var(--lla-parch-size);border-radius:2px;
    filter:url(#lla-deckle) drop-shadow(0 10px 16px rgba(0,0,0,.55)) drop-shadow(0 2px 3px rgba(0,0,0,.4))}
  .lla-head{padding:16px 18px 12px}
  .lla-logo .lla-init{--s:70px}
  .lla-logo .lla-init>svg{overflow:hidden}
  .lla-word{font-size:44px}
  .lla-tagline{font-size:15px;margin-top:4px}
  .lla-tail{display:none}
  .lla-orn{display:none}
  .lla-mi{font-size:18px;padding:10px 8px 10px 2px;min-height:46px}
  .lla-mi.is-primary .lla-mi-label{font-size:19px}
  .lla-mi-sub{font-size:14px}
  .lla-foot{grid-template-columns:1fr 54px;margin-top:10px}
  .lla-foot>.lla-doodle:first-child{display:none}
  .lla-foot p{text-align:left;font-size:12px}
  .lla-pane{padding:16px;place-items:start center}
  .lla-charter{padding:30px 22px 24px}
  .lla-kicker{font-size:12px;letter-spacing:.18em;margin-bottom:12px}
  .lla-grant{font-size:17px;line-height:1.85}
  .lla-grant .lla-init{--s:60px;margin:4px 10px 0 0}
  .lla-blank{font-size:19px;width:100%;display:block;margin:2px 0 4px;text-align:left}
  .lla-blank.lla-wide{width:calc(100% - 42px);display:inline-block}
  .lla-terms{grid-template-columns:1fr;gap:14px;margin:0}
  .lla-term:nth-child(n){transform:none}
  .lla-term[aria-checked="true"]{transform:translateY(-2px)}
  .lla-term-name{font-size:21px}
  .lla-charter-foot{grid-template-columns:1fr;justify-items:center;text-align:center}
  .lla-close{top:14px;right:14px}
  .lla-hall{padding:24px 16px 18px}
  .lla-hall-title{font-size:36px}
  .lla-hall .lla-close{top:18px;right:14px}
  .lla-wall{grid-template-columns:1fr}
  .lla-end-veil{padding:52px 14px 18px;place-items:start center}
  .lla-end{padding:56px 20px 26px}
  .lla-end-name{font-size:44px}
  .lla-epitaph{font-size:21px;padding:0 22px}
  .lla-epitaph::before,.lla-epitaph::after{font-size:44px}
  .lla-tally{flex-basis:50%}
  .lla-tally b{font-size:27px}
  .lla-tally:nth-child(n)::before{display:none}
  .lla-tally:nth-child(even)::before{content:'';display:block;position:absolute;left:0;top:14px;bottom:16px;border-left:1px dotted rgba(138,116,90,.7)}
  .lla-tally:nth-child(n+3){border-top:1px dotted rgba(138,116,90,.7)}
  .lla-modal{padding:14px 12px;place-items:start center}
  .lla-set .ll-panel-body{padding:4px 16px 16px}
  .lla-row{grid-template-columns:1fr auto}
  .lla-row>.lla-row-k{grid-row:1;grid-column:1}
  .lla-row>.lla-row-v{grid-row:1;grid-column:2}
  .lla-row>.lla-range,.lla-row>.lla-seg,.lla-row>.lla-keyfield,.lla-row>.lla-switch{grid-row:2;grid-column:1 / -1}
  .lla-row>.lla-row-note{grid-row:3}
  .lla-row-note{grid-column:1 / -1}
  .lla-help{height:calc(100vh - 28px)}
  .lla-help .ll-panel-body{grid-template-columns:1fr}
  .lla-toc{display:none}
  .lla-article{padding:4px 18px 24px}
  .lla-hsec .lla-doodle{width:70px;margin-left:12px}
  .lla-hsec p{font-size:16px}
  .lla-keys dd{font-size:15px}
}
@media (max-height:640px) and (min-width:700px){
  .lla-leaf{padding:24px 30px 14px}
  .lla-logo .lla-init{--s:84px}
  .lla-word{font-size:52px}
  .lla-orn{margin:8px 0 4px}
  .lla-mi{padding:6px 10px 6px 4px}
  .lla-foot .lla-doodle svg{max-height:48px}
}
`;

// ───────────── shared SVG defs (filter for the deckled edge, wax gradient) ─────────────

export function ensureDefs(): void {
  if (typeof document === 'undefined' || document.getElementById('lla-defs')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `<svg id="lla-defs" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false">
  <defs>
    <filter id="lla-deckle" x="-3%" y="-3%" width="106%" height="106%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="11" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="9" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <radialGradient id="lla-wax-g" cx="38%" cy="32%" r="75%">
      <stop offset="0" stop-color="#d0574a"/><stop offset=".45" stop-color="#a8302a"/><stop offset=".85" stop-color="#6e1714"/><stop offset="1" stop-color="#4e0f0c"/>
    </radialGradient>
  </defs></svg>`;
  document.body.appendChild(wrap.firstElementChild!);
}

// ───────────── small seeded noise for the drawings ─────────────
function rng(seed: number): () => number {
  let t = (seed | 0) + 0x9e3779b9;
  return () => { t = (t + 0x6d2b79f5) | 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
const f = (n: number) => (Math.round(n * 10) / 10).toString();
export function hashStr(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

function spiral(cx: number, cy: number, r: number, turns: number, start: number, dir: 1 | -1): string {
  const steps = Math.round(turns * 18); let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, a = start + dir * t * turns * Math.PI * 2, rr = r * (1 - t * .86);
    d += (i ? 'L' : 'M') + f(cx + Math.cos(a) * rr) + ',' + f(cy + Math.sin(a) * rr);
  }
  return d;
}
function wave(x0: number, y0: number, x1: number, y1: number, amp: number, n: number): string {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len; let d = '';
  const steps = n * 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, s = Math.sin(t * n * Math.PI * 2) * amp;
    d += (i ? 'L' : 'M') + f(x0 + dx * t + nx * s) + ',' + f(y0 + dy * t + ny * s);
  }
  return d;
}

/**
 * A pen-flourished initial: the letter in rubric on a gilt-framed square of
 * lapis penwork (corner spirals, frogspawn, waves), with sprays leaving the box.
 * Returns HTML; size via the CSS variable --s on .lla-init.
 */
export function penInitial(letter: string, seed = 7, opts: { sprays?: boolean } = {}): string {
  const r = rng(seed); let pw = '', thin = '', dots = '', red = '';
  // corner spirals
  const C: [number, number, number][] = [[16, 16, 0], [84, 16, Math.PI / 2], [84, 84, Math.PI], [16, 84, -Math.PI / 2]];
  C.forEach(([x, y, a], i) => { pw += spiral(x, y, 8.5, 1.6, a + Math.PI, i % 2 ? 1 : -1); });
  // waves along the inner edges between the spirals
  thin += wave(27, 9.5, 73, 9.5, 1.6, 4) + wave(27, 90.5, 73, 90.5, 1.6, 4) + wave(9.5, 27, 9.5, 73, 1.6, 4) + wave(90.5, 27, 90.5, 73, 1.6, 4);
  // frogspawn: little circles with a dot, scattered near the edges where the letter is thin
  const spots: [number, number][] = [[30, 20], [44, 17], [58, 19], [70, 24], [22, 32], [24, 48], [21, 62], [30, 74], [44, 81], [58, 80], [72, 76], [79, 62], [80, 46], [76, 32]];
  for (const [x0, y0] of spots) {
    const x = x0 + (r() - .5) * 3, y = y0 + (r() - .5) * 3, rad = 2 + r() * 1.1;
    thin += `M${f(x + rad)},${f(y)}a${f(rad)},${f(rad)} 0 1,0 ${f(-rad * 2)},0a${f(rad)},${f(rad)} 0 1,0 ${f(rad * 2)},0`;
    dots += `<circle class="lla-pw-dot" cx="${f(x)}" cy="${f(y)}" r=".7"/>`;
  }
  // tiny trefoils in the middle band
  for (let i = 0; i < 6; i++) {
    const x = 32 + r() * 36, y = 32 + r() * 36;
    dots += `<circle class="lla-pw-dot" cx="${f(x)}" cy="${f(y)}" r=".55"/><circle class="lla-pw-dot" cx="${f(x + 1.6)}" cy="${f(y + .9)}" r=".55"/><circle class="lla-pw-dot" cx="${f(x + .2)}" cy="${f(y + 1.8)}" r=".55"/>`;
  }
  // sprays: hairlines that leave the box to the left and below, ending in curls
  if (opts.sprays !== false) {
    const sp: [number, number, number, number][] = [[2, 30, -16, 24], [2, 60, -20, 62], [2, 86, -14, 104], [30, 98, 22, 118], [62, 98, 70, 116]];
    for (const [x, y, ex, ey] of sp) {
      const mx = (x + ex) / 2 + (r() - .5) * 10, my = (y + ey) / 2 + (r() - .5) * 10;
      red += `M${x},${y}Q${f(mx)},${f(my)} ${f(ex)},${f(ey)}`;
      pw += spiral(ex, ey, 3.2, 1.2, r() * 6, r() > .5 ? 1 : -1);
      dots += `<circle class="lla-pw-dot" cx="${f(mx)}" cy="${f(my)}" r=".9"/>`;
    }
  }
  const svg = `<svg viewBox="0 0 100 100" aria-hidden="true">
<rect class="lla-pw-ground" x="4" y="4" width="92" height="92"/>
<path class="lla-pw-thin" d="${thin}"/><path class="lla-pw" d="${pw}"/><path class="lla-pw-red" d="${red}"/>${dots}
<rect class="lla-pw-gold" x="2" y="2" width="96" height="96"/><rect class="lla-pw-goldline" x=".6" y=".6" width="98.8" height="98.8"/><rect class="lla-pw-goldline" x="3.4" y="3.4" width="93.2" height="93.2"/>
</svg>`;
  return `<span class="lla-init" aria-hidden="true">${svg}<b>${letter}</b></span>`;
}

/** A descending penwork tail for the margin beneath an initial: a wavering hairline with beads, ending in a curl. */
export function penTail(seed = 3, height = 150): string {
  const r = rng(seed); let d = 'M7,0'; let beads = '';
  for (let y = 0; y < height; y += 14) {
    const s = (y / 14) % 2 ? 1 : -1;
    d += `Q${7 + s * 5},${y + 7} 7,${y + 14}`;
    beads += `<circle class="lla-pw-dot" cx="${f(7 - s * 3.2 + (r() - .5) * .6)}" cy="${y + 7}" r=".95"/>`;
  }
  return `<svg class="lla-tail" viewBox="0 0 14 ${height + 12}" aria-hidden="true"><path class="lla-pw" d="${d}"/>${beads}<path class="lla-pw" d="${spiral(7, height + 5, 4.5, 1.5, -Math.PI / 2, 1)}"/></svg>`;
}

// ───────────── wax seals ─────────────
const CROWN = 'M-15,9 L-15,-6 L-8,0 L0,-12 L8,0 L15,-6 L15,9 Z M-15,11 L15,11 L15,15 L-15,15 Z';
const CROWN_BALLS: [number, number][] = [[-15, -8.4], [0, -14.6], [15, -8.4]];
const CHECK = 'M-14,0 L-5,10 L15,-12 L18,-8 L-5,16 L-18,3 Z';
let sealN = 0;

/**
 * A wax seal: an irregular spill of wax with a stamped disc and an embossed
 * emblem. `broken` splits it with a crack, the halves a little apart.
 */
export function waxSeal(opts: { seed?: number; emblem?: 'crown' | 'check'; broken?: boolean; title?: string } = {}): string {
  const r = rng(opts.seed ?? 5); const id = 'lla-s' + (++sealN);
  // wax spill outline: a wobbly circle smoothed with quadratic curves
  const pts: [number, number][] = [];
  const N = 22;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, rad = 42 + (r() - .5) * 6 + (i % 5 === 0 ? r() * 4 : 0);
    pts.push([50 + Math.cos(a) * rad, 50 + Math.sin(a) * rad]);
  }
  let d = '';
  for (let i = 0; i < N; i++) {
    const p = pts[i]!, q = pts[(i + 1) % N]!; const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    d += (i ? '' : `M${f((pts[N - 1]![0] + p[0]) / 2)},${f((pts[N - 1]![1] + p[1]) / 2)}`) + `Q${f(p[0])},${f(p[1])} ${f(mx)},${f(my)}`;
  }
  d += 'Z';
  let ring = '';
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; ring += `<circle class="w-dots" cx="${f(50 + Math.cos(a) * 34.5)}" cy="${f(50 + Math.sin(a) * 34.5)}" r=".9"/>`; }
  const em = opts.emblem === 'check' ? CHECK : CROWN;
  const balls = (dx: number, dy: number, cls: string) => opts.emblem === 'check' ? '' : CROWN_BALLS.map(([x, y]) => `<circle class="${cls}" cx="${f(x + dx)}" cy="${f(y + dy)}" r="3"/>`).join('');
  const emblem = `<g transform="translate(50 51) scale(1.12)">
    <path class="w-sh" d="${em}" transform="translate(1.3 1.4)"/>${balls(1.3, 1.4, 'w-sh')}
    <path class="w-hi" d="${em}" transform="translate(-.9 -.9)"/>${balls(-.9, -.9, 'w-hi')}
    <path class="w-em" d="${em}"/>${balls(0, 0, 'w-em')}</g>`;
  const body = `<path class="w-body" d="${d}"/>
    <circle class="w-rim" cx="50" cy="50" r="31"/><circle class="w-rim-hi" cx="49.2" cy="49.2" r="32.6"/>${ring}${emblem}`;
  const title = opts.title ? `<title>${opts.title}</title>` : '';
  if (!opts.broken) return `<svg class="lla-wax" viewBox="0 0 100 100" ${opts.title ? 'role="img"' : 'aria-hidden="true"'}>${title}${body}</svg>`;
  // the crack: a jagged line top to bottom; the right half shifts and turns
  let crack = 'M53,2'; let y = 2, x = 53;
  while (y < 98) { y += 7 + r() * 7; x += (r() - .5) * 14; x = Math.max(38, Math.min(62, x)); crack += `L${f(x)},${f(Math.min(98, y))}`; }
  const left = crack + 'L-10,110 L-10,-10 Z', right = crack + 'L110,110 L110,-10 Z';
  return `<svg class="lla-wax" viewBox="0 0 100 100" ${opts.title ? 'role="img"' : 'aria-hidden="true"'}>${title}
  <defs><clipPath id="${id}l"><path d="${left}"/></clipPath><clipPath id="${id}r"><path d="${right}"/></clipPath></defs>
  <g clip-path="url(#${id}l)" transform="rotate(-5 50 50) translate(-3.5 1)">${body}</g>
  <g clip-path="url(#${id}r)" transform="rotate(8 50 50) translate(5 3)">${body}<path class="w-crack" d="${crack}"/></g></svg>`;
}

// ───────────── the die, the manicule, emblems, the hook ─────────────
const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};
/** A bone die showing `face`, drawn in ink, tilted. */
export function dieSvg(face: number): string {
  const p = (PIPS[Math.max(1, Math.min(6, Math.round(face)))] ?? PIPS[5]!).map(([x, y]) => `<circle cx="${12 + x * 4.6}" cy="${12 + y * 4.6}" r="1.75" fill="var(--rubric)"/>`).join('');
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(-12 12 12)">
  <rect x="3.2" y="4.2" width="18" height="18" rx="4" fill="rgba(42,29,20,.25)"/>
  <rect x="2.5" y="2.5" width="19" height="19" rx="4" fill="#f8f0dc" stroke="var(--ink)" stroke-width="1.3"/>
  <path d="M5 4.6 Q12 3.6 19 4.6" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="1"/>${p}</g></svg>`;
}

/** The manicule: an inked pointing hand from the margins. */
export const MANICULE = `<svg class="lla-hand" viewBox="0 0 26 16" aria-hidden="true"><g fill="#fbf3dd" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round">
<path d="M1.2 4.2h4.2v8.6H1.2z"/><path d="M5.4 4.6c1.6-.9 3.2-1.5 4.6-1.4h13.4c1.7 0 1.7 2.6 0 2.6h-8.6c1 .1 1.6.7 1.6 1.4 0 .8-.6 1.3-1.4 1.3.8.2 1.2.8 1 1.4-.2.6-.8.9-1.4.9.5.3.6.9.3 1.4-.3.5-.9.6-1.4.6H10c-1.8 0-3.1-.5-4.6-1.2z"/>
<path d="M15.2 8.5h-3.4M14.4 10.6h-3.1" fill="none"/></g><path d="M2.4 6v5.4M4.2 6v5.4" stroke="currentColor" stroke-width=".6" opacity=".6"/></svg>`;

/** Steward's Peace: a pair of scales, evenly hung. */
export const EMBLEM_PEACE = `<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="var(--ink)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
<path d="M24 7v33M16 41h16M24 9.5c-5 2.4-10 2.4-15 1.6M24 9.5c5 2.4 10 2.4 15 1.6"/>
<path d="M9 11.5 4 24M9 11.5 14 24M39 11.5 34 24M39 11.5 44 24"/>
<path d="M3.2 24h11.6c-.6 3.6-3 5.6-5.8 5.6S3.8 27.6 3.2 24zM33.2 24h11.6c-.6 3.6-3 5.6-5.8 5.6s-5.2-2-5.8-5.6z" fill="rgba(201,162,39,.45)"/>
</g><circle cx="24" cy="6.4" r="2.2" fill="var(--gold)" stroke="var(--ink)" stroke-width="1.2"/>
<path d="M20 34l4 3 4-3" fill="none" stroke="var(--verdigris)" stroke-width="1.4" stroke-linecap="round"/></svg>`;

/** Iron Crown: a plain iron circlet, riveted, with one notch. */
export const EMBLEM_IRON = `<svg viewBox="0 0 48 48" aria-hidden="true">
<path d="M7 34V17l7 7 10-12 10 12 7-7v17z" fill="#55545a" stroke="#1f1f24" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M7 34h34v6H7z" fill="#3e3d43" stroke="#1f1f24" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M10 22.5l4 4 10-11.5 10 11.5 4-4" fill="none" stroke="#9a99a0" stroke-width="1" opacity=".8"/>
<g fill="#b9b8bd" stroke="#1f1f24" stroke-width=".8"><circle cx="12" cy="37" r="1.4"/><circle cx="20" cy="37" r="1.4"/><circle cx="28" cy="37" r="1.4"/><circle cx="36" cy="37" r="1.4"/></g>
<path d="M31 34l1.5 6" stroke="#1f1f24" stroke-width="1.2"/><circle cx="24" cy="11" r="2.2" fill="#6d6c72" stroke="#1f1f24" stroke-width="1.2"/></svg>`;

/** A single brass hook on the bare wall of the hall. */
export const HOOK_SVG = `<svg viewBox="0 0 70 96" aria-hidden="true">
<circle cx="35" cy="14" r="8" fill="#b18a34" stroke="#3a2610" stroke-width="1.4"/><circle cx="33" cy="12" r="2.6" fill="#f1d88a"/>
<path d="M35 22v30c0 10-14 10-14 2" fill="none" stroke="#c49b3f" stroke-width="5" stroke-linecap="round"/>
<path d="M35 22v30c0 10-14 10-14 2" fill="none" stroke="#3a2610" stroke-width="1.2" stroke-linecap="round" opacity=".6"/>
<path d="M33.8 24v26" stroke="#f3dc95" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>
<path d="M18 88h34" stroke="rgba(0,0,0,.35)" stroke-width="5" stroke-linecap="round" opacity=".5"/></svg>`;
