/**
 * Styles for the three tool parts: the build book (ll-bm-*), the inspector
 * (ll-in-*) and the Word bar (ll-wb-*). Everything is built from the tokens
 * in css/base.ts. Each part calls addStyle('tools', TOOLS_CSS) when it mounts.
 *
 * Sized to the frame's slots (css/shell.ts): the rail is --ll-rail-w wide, the
 * inspector fills the --ll-insp-w column, the Word bar fills its slot. The book
 * is kept narrow enough to clear the Word bar's column. Under 700px the book and
 * the tool strip become a sheet beside the rail, standing on the Word bar.
 */

const BUILD_CSS = `
/* ───────── the build book ───────── */
.ll-part-buildmenu{display:flex;flex:none;align-items:flex-start;gap:10px;pointer-events:none;color:var(--ink);font-family:var(--f-body);font-size:var(--fs-s);line-height:1.3}
.ll-part-buildmenu[hidden]{display:none}
.ll-part-buildmenu>*{pointer-events:auto}
.ll-pic{display:block;width:100%;height:100%;color:var(--ink);overflow:visible}
.ll-fp{display:block;color:var(--ink)}

/* the rail: a tally strip of parchment with seals pressed down it */
.ll-bm-rail{flex:none;filter:drop-shadow(0 8px 10px rgba(0,0,0,.5)) drop-shadow(0 1px 2px rgba(0,0,0,.4))}
.ll-bm-rail-edge{padding:1px;background:linear-gradient(180deg,#cdb787,#a58a55);clip-path:polygon(0 0,100% 0,100% 100%,50% calc(100% - 13px),0 100%);border-radius:3px 3px 0 0}
.ll-bm-rail-in{width:calc(var(--ll-rail-w,48px) - 2px);padding:8px 1px 22px;display:flex;flex-direction:column;align-items:center;gap:4px;
  clip-path:polygon(0 0,100% 0,100% 100%,50% calc(100% - 13px),0 100%);border-radius:2px 2px 0 0;
  background:radial-gradient(140% 50% at 20% 0%,rgba(255,250,230,.6),transparent 60%),linear-gradient(180deg,var(--parch),var(--parch-2) 70%,var(--parch-3))}
.ll-bm-tool{appearance:none;-webkit-appearance:none;background:none;border:0;margin:0;padding:2px 0 0;width:100%;display:flex;flex-direction:column;align-items:center;gap:1px;cursor:pointer;
  color:var(--ink-2);font-family:var(--f-head);font-size:12px;letter-spacing:.01em;line-height:1.15;border-radius:6px;-webkit-tap-highlight-color:transparent}
.ll-bm-wax{position:relative;width:34px;height:34px;display:grid;place-items:center;color:#fbf0d8;border-radius:48% 52% 51% 49%/52% 47% 53% 48%;
  background:radial-gradient(circle at 34% 28%,#cf5348,var(--rubric) 52%,#5a1411);
  box-shadow:0 2px 3px rgba(42,29,20,.45),inset 0 -3px 4px rgba(0,0,0,.28),inset 0 2px 2px rgba(255,214,196,.42);transition:transform .14s ease,filter .14s}
.ll-bm-wax::after{content:"";position:absolute;inset:4px;border-radius:50%;border:1px solid rgba(255,226,208,.28);box-shadow:0 0 0 1px rgba(60,12,10,.2)}
.ll-bm-wax .ll-icon{width:18px;height:18px;filter:drop-shadow(0 1px 0 rgba(0,0,0,.35))}
.ll-bm-tool:nth-of-type(odd) .ll-bm-wax{transform:rotate(-5deg)}
.ll-bm-tool:nth-of-type(even) .ll-bm-wax{transform:rotate(4deg);border-radius:52% 48% 47% 53%/49% 53% 47% 51%}
.ll-bm-tool:hover .ll-bm-wax{transform:translateY(-1px) scale(1.06);filter:brightness(1.12)}
.ll-bm-tool:active .ll-bm-wax{transform:scale(.93)}
.ll-bm-tool:hover .ll-bm-lbl{color:var(--rubric)}
.ll-bm-tool-screen .ll-bm-wax{background:radial-gradient(circle at 34% 28%,#6385bd,var(--lapis) 55%,#1b2b4a)}
.ll-bm-tool.is-on .ll-bm-wax{background:radial-gradient(circle at 34% 28%,#f3db8a,var(--gold) 55%,var(--gold-ink));color:var(--ink)}
.ll-bm-tool.is-on .ll-bm-wax .ll-icon{filter:drop-shadow(0 1px 0 rgba(255,245,210,.5))}
.ll-bm-tool.is-on .ll-bm-lbl{color:var(--rubric)}
.ll-bm-knot{position:relative;width:26px;height:9px;margin:3px 0 2px;background:linear-gradient(var(--ink-3),var(--ink-3)) center/100% 1px no-repeat}
.ll-bm-knot::after{content:"";position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;transform:rotate(45deg);background:var(--rubric)}

.ll-bm-side{display:flex;flex-direction:column;gap:8px;min-width:0;pointer-events:none}
.ll-bm-side>*{pointer-events:auto}

/* what is in hand */
.ll-bm-strip{display:flex;align-items:center;gap:9px;padding:7px 8px 7px 8px;width:326px;max-width:calc(100vw - 84px)}
.ll-bm-strip[hidden]{display:none}
.ll-bm-spic{flex:none;width:42px;height:42px}
.ll-bm-sico{flex:none;width:36px;height:36px;display:grid;place-items:center;color:var(--rubric)}
.ll-bm-sico .ll-icon{width:24px;height:24px}
.ll-bm-stext{flex:1;min-width:0}
.ll-bm-sname{font-family:var(--f-head);letter-spacing:.04em;font-size:15px;color:var(--rubric);display:flex;align-items:center;gap:8px;flex-wrap:wrap;line-height:1.2}
.ll-bm-sfp{line-height:0;color:var(--ink)}
.ll-bm-shint{font-size:13px;color:var(--ink-2);font-style:italic;line-height:1.25}
.ll-bm-sacts{display:flex;flex-direction:column;gap:2px;align-items:stretch;flex:none}
.ll-bm-sbtn{padding:3px 9px;font-size:13px}

/* the book */
.ll-bm-book{width:326px;max-width:calc(100vw - 84px);display:flex;flex-direction:column;min-height:0;overflow:hidden}
.ll-bm-book[hidden]{display:none}
.ll-bm-head{display:flex;align-items:center;gap:10px;padding:10px 10px 5px 14px;flex:none}
.ll-bm-head .ll-seal{width:26px;height:26px;font-size:12px}
.ll-bm-head .ll-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ll-bm-landbtn{appearance:none;-webkit-appearance:none;flex:none;display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 9px 0 7px;border:1px solid var(--ink-3);border-radius:13px;
  background:rgba(255,250,235,.55);color:var(--ink-2);font-family:var(--f-head);font-size:13px;letter-spacing:.04em;line-height:1;cursor:pointer;white-space:nowrap}
.ll-bm-landbtn .ll-icon{width:14px;height:14px}
.ll-bm-landbtn:hover{color:var(--rubric);border-color:var(--rubric)}
.ll-bm-landbtn.is-on{background:linear-gradient(180deg,#f3db8a,var(--gold));border-color:var(--gold-ink);color:var(--ink)}
.ll-bm-tabs{display:flex;gap:1px;padding:0 10px;border-bottom:1px solid var(--parch-edge);flex:none}
.ll-bm-tab{appearance:none;-webkit-appearance:none;border:1px solid transparent;border-bottom:0;background:none;padding:5px 7px 4px;font-family:var(--f-head);font-size:14px;letter-spacing:.04em;color:var(--ink-2);cursor:pointer;border-radius:4px 4px 0 0;margin-bottom:-1px;flex:1 1 auto;white-space:nowrap}
.ll-bm-tab:hover{color:var(--rubric)}
.ll-bm-tab.is-on{color:var(--rubric);background:linear-gradient(180deg,rgba(255,250,235,.9),var(--parch));border-color:var(--parch-edge);box-shadow:inset 0 2px 0 var(--gold)}
.ll-bm-note{margin:7px 14px 1px;font-size:13px;line-height:1.25;flex:none}
.ll-bm-list{flex:1;min-height:0;overflow-y:auto;padding:6px 10px 8px;display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:max-content;gap:6px;align-content:start}
.ll-bm-list.is-land{display:flex;flex-direction:column;gap:0}
.ll-bm-card{appearance:none;-webkit-appearance:none;text-align:left;display:flex;flex-direction:column;justify-content:space-between;gap:2px;padding:5px 6px 5px 5px;min-height:68px;min-width:0;
  border:1px solid rgba(138,116,90,.45);border-radius:3px;background:rgba(255,250,235,.36);color:var(--ink);cursor:pointer;font:inherit;line-height:1.2;transition:background .12s,border-color .12s}
.ll-bm-card:hover,.ll-bm-card:focus-visible{background:rgba(255,250,235,.85);border-color:var(--ink-3)}
.ll-bm-card.is-armed{border-color:var(--gold-ink);background:rgba(227,192,90,.28);box-shadow:inset 0 0 0 1px var(--gold)}
.ll-bm-card.is-looked{border-color:var(--rubric);background:rgba(255,250,235,.85)}
.ll-bm-take{display:block;margin:7px 0 0 auto}
.ll-bm-card.is-locked,.ll-bm-card.is-taken{cursor:default;background:rgba(217,199,156,.25)}
.ll-bm-card.is-locked .ll-bm-plate,.ll-bm-card.is-taken .ll-bm-plate{filter:grayscale(1);opacity:.4}
.ll-bm-card.is-locked .ll-bm-cname,.ll-bm-card.is-locked .ll-bm-facts{opacity:.5}
.ll-bm-ctop{display:flex;align-items:center;gap:6px;min-width:0}
.ll-bm-plate{flex:none;width:42px;height:42px}
.ll-bm-ctext{display:flex;flex-direction:column;min-width:0;flex:1;gap:1px}
.ll-bm-cname{font-family:var(--f-head);font-size:14px;letter-spacing:.02em;line-height:1.1}
.ll-bm-cost{display:inline-flex;align-items:center;gap:3px;color:var(--gold-ink);font-size:14px;font-family:var(--f-body);letter-spacing:0}
.ll-bm-cost .ll-icon{width:14px;height:14px}
.ll-bm-cost.is-short{color:var(--bad)}
.ll-bm-lock{font-family:var(--f-head);font-size:12px;letter-spacing:.06em;color:var(--ink-2)}
.ll-bm-facts{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--ink-2);line-height:1.15;min-height:16px;white-space:nowrap}
.ll-bm-fact b{font-weight:400;color:var(--ink)}
.ll-bm-fact.is-up b{color:var(--good)}
.ll-bm-fact.is-down b{color:var(--bad)}
.ll-bm-cfp{margin-left:auto;line-height:0;flex:none}
.ll-bm-foot{flex:none;border-top:1px solid var(--parch-edge);padding:8px 14px 10px;min-height:92px;background:linear-gradient(180deg,rgba(158,43,37,.05),transparent)}
.ll-bm-blurb{margin:0;font-style:italic;font-size:14px;line-height:1.3}
.ll-bm-blurb.is-idle{color:var(--ink-2)}
.ll-bm-bname{font-family:var(--f-head);font-style:normal;color:var(--rubric);letter-spacing:.04em}
.ll-bm-factline{margin:4px 0 0;font-size:13px;line-height:1.3;color:var(--ink-2)}
/* land */
.ll-bm-landsum{margin:2px 4px 6px;font-size:14px}
.ll-bm-parcel{display:flex;align-items:center;gap:8px;padding:5px 4px;border-bottom:1px dotted rgba(138,116,90,.5);min-height:40px}
.ll-bm-parcel:hover{background:rgba(201,162,39,.14)}
.ll-bm-pname{appearance:none;-webkit-appearance:none;border:0;background:none;font:inherit;font-family:var(--f-head);font-size:15px;letter-spacing:.03em;color:var(--ink);cursor:pointer;display:flex;align-items:center;gap:6px;flex:1;min-width:0;text-align:left;padding:2px 0}
.ll-bm-pname .ll-icon{width:15px;height:15px;color:var(--ink-3);flex:none}
.ll-bm-pname:hover{color:var(--rubric)}
.ll-bm-parcel.is-locked .ll-bm-pname{color:var(--ink-3)}
.ll-bm-parcel .ll-bm-lock{text-align:right}
.ll-bm-buy{padding:3px 12px}

@media (max-height:700px) and (min-width:700px){
  .ll-bm-lbl{display:none}
  .ll-bm-rail-in{gap:6px}
}
/* a short window: the frame runs the rail up the whole left edge and moves the plaque in beside it. The book hangs below the plaque. */
@media (min-width:700px) and (max-height:779px){
  .ll-bm-side{margin-top:calc(var(--ll-top-h,204px) + 10px)}
}
@media (max-width:699px){
  /* a phone: the rail keeps the left edge; the strip and the book become a sheet standing on the Word bar
     (and on whatever the Word bar is holding up: --ll-word-above is published by wordbar.ts) */
  .ll-part-buildmenu{align-self:stretch;min-height:0;gap:0}
  .ll-bm-rail-in{padding:7px 1px 20px;gap:6px}
  .ll-bm-lbl{display:none}
  .ll-bm-knot{margin:1px 0}
  .ll-part-buildmenu.has-sel .ll-bm-tool-screen,.ll-part-buildmenu.has-sel .ll-bm-knot{display:none}
  .ll-bm-side{position:fixed;left:calc(var(--ll-gl,16px) + var(--ll-rail-w,48px) + 8px);right:var(--ll-gr,16px);bottom:calc(var(--ll-word-h,0px) + var(--ll-word-above,0px) + 8px);justify-content:flex-end}
  .ll-bm-book,.ll-bm-strip{width:auto;max-width:none}
  .ll-bm-head{gap:7px;padding-left:12px}
  .ll-bm-head .ll-title{font-size:17px;letter-spacing:.02em}
  .ll-bm-landbtn{padding:0 8px 0 6px}
  .ll-bm-foot{min-height:76px;padding:7px 12px 9px}
  .ll-bm-blurb{font-size:13px}
}
`;

const INSPECTOR_CSS = `
/* ───────── the inspector ───────── */
.ll-part-inspector{display:flex;flex-direction:column;justify-content:flex-end;min-height:0;pointer-events:none;color:var(--ink);font-family:var(--f-body);font-size:var(--fs-s);line-height:1.32}
.ll-part-inspector[hidden]{display:none}
.ll-in-sheet{pointer-events:auto;flex:0 1 auto;min-height:0;width:100%;max-height:min(66vh,600px);display:flex;flex-direction:column;overflow:hidden}
.ll-in-head{display:flex;align-items:flex-start;gap:10px;padding:10px 9px 8px 12px;border-bottom:1px solid var(--parch-edge);background:linear-gradient(180deg,rgba(158,43,37,.07),transparent)}
.ll-in-vig{flex:none;width:52px;height:52px}
.ll-in-face{flex:none;display:block;line-height:0}
.ll-in-face>*{max-width:100%;max-height:100%}
.ll-in-titles{flex:1;min-width:0;padding-top:1px}
.ll-in-name{display:flex;align-items:baseline;gap:6px;cursor:text;line-height:1.15;font-size:var(--fs-l);overflow-wrap:anywhere}
.ll-in-name .ll-icon{width:13px;height:13px;color:var(--ink-3);opacity:0;transition:opacity .15s;flex:none}
.ll-in-name:hover .ll-icon,.ll-in-name:focus-visible .ll-icon{opacity:1}
.ll-in-name:not(.is-plain):hover span{text-decoration:underline dotted var(--ink-3);text-underline-offset:3px}
.ll-in-name.is-plain{cursor:default}
.ll-in-rename{font-family:var(--f-head);font-size:17px;color:var(--rubric);padding:2px 6px;letter-spacing:.04em}
.ll-in-sub{margin:2px 0 0;font-size:13px;letter-spacing:.05em;line-height:1.25}
.ll-in-headbtns{display:flex;flex-direction:column;align-items:center;gap:5px;flex:none}
.ll-in-headbtns .ll-seal{width:26px;height:26px;font-size:12px}
.ll-in-find{appearance:none;-webkit-appearance:none;border:0;background:none;color:var(--ink-2);cursor:pointer;padding:3px;line-height:0;border-radius:50%}
.ll-in-find .ll-icon{width:18px;height:18px}
.ll-in-find:hover{color:var(--rubric)}
.ll-in-body{overflow-y:auto;padding:1px 12px 10px;min-height:0;flex:1}
.ll-in-sec{padding:8px 0 9px;display:flex;flex-direction:column;gap:5px;border-bottom:1px solid;border-image:linear-gradient(90deg,transparent,var(--parch-edge) 12%,var(--parch-edge) 88%,transparent) 1}
.ll-in-body>:last-child{border-bottom:0;padding-bottom:2px}
.ll-in-h{font-size:13px;color:var(--rubric);letter-spacing:.09em;margin:0 0 1px;font-weight:400}
.ll-part-inspector .ll-note{margin:0;font-size:13px;line-height:1.3}
.ll-in-small{font-size:13px}
.ll-in-plain{margin:0;font-size:14px}
.ll-in-plain .ll-icon,.ll-in-warn .ll-icon,.ll-in-job .ll-icon{width:15px;height:15px;vertical-align:-.18em}
.ll-in-plain b{font-weight:400;color:var(--rubric);font-size:16px}
.ll-in-ok{color:var(--good)}
.ll-in-warn{margin:0;color:var(--bad);font-size:14px}
.ll-in-link{appearance:none;-webkit-appearance:none;border:0;background:none;padding:0;font:inherit;color:var(--lapis);cursor:pointer;text-decoration:underline;text-decoration-color:rgba(47,74,122,.4);text-underline-offset:2px;text-align:left}
.ll-in-link:hover{color:var(--rubric)}
.ll-in-tags{display:flex;flex-wrap:wrap;gap:4px}

/* label, word, bar */
.ll-in-gauge{display:grid;grid-template-columns:auto 1fr 92px;align-items:center;gap:8px;min-height:22px}
.ll-in-gauge.has-face{grid-template-columns:auto auto 1fr 92px}
.ll-in-word{font-size:14px;text-align:right;min-width:0}
.ll-in-facebox{display:inline-block;width:20px;height:20px;line-height:0;flex:none;color:var(--ink)}
.ll-face{width:100%;height:100%;display:block}
.ll-in-line{font-size:14px;align-items:center}
.ll-in-line b{font-weight:400;color:var(--rubric);font-size:16px}

/* rows of people */
.ll-in-row{display:flex;align-items:center;gap:8px;padding:3px 4px;border-radius:3px;min-height:46px}
.ll-in-row.is-link{cursor:pointer}
.ll-in-row.is-link:hover,.ll-in-row.is-link:focus-visible{background:rgba(201,162,39,.16)}
.ll-in-row.is-vacant{min-height:38px}
.ll-in-rowtext{flex:1;min-width:0}
.ll-in-rowname{font-family:var(--f-head);font-size:15px;letter-spacing:.02em;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ll-in-rowsub{font-size:13px;color:var(--ink-2);display:flex;flex-wrap:wrap;gap:2px 6px;align-items:center;line-height:1.25}
.ll-in-shingle{position:relative;flex:none;width:40px;height:24px;display:grid;place-items:center;font-family:var(--f-head);font-size:12px;letter-spacing:.03em;border:1px solid var(--ink-3);border-radius:2px;color:var(--ink-3);background:rgba(255,250,235,.55);transform:rotate(-4deg);transform-origin:50% -6px}
.ll-in-shingle::before{content:"";position:absolute;top:-6px;left:8px;right:8px;height:5px;border:solid var(--ink-3);border-width:0 1px}
.ll-in-shingle.is-out{color:var(--rubric);border-color:var(--rubric)}
.ll-in-purse{appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;gap:3px;border:1px solid var(--gold-ink);background:rgba(201,162,39,.22);color:var(--gold-ink);border-radius:11px;padding:1px 8px 1px 5px;font:inherit;font-size:13px;cursor:pointer;flex:none;animation:ll-in-bob 1.8s ease-in-out infinite}
.ll-in-purse .ll-icon{width:14px;height:14px}
.ll-in-purse:hover{background:rgba(201,162,39,.45)}
@keyframes ll-in-bob{50%{transform:translateY(-2px)}}

/* matters */
.ll-in-inc{border-left:3px solid var(--warn);padding:3px 0 4px 8px;display:flex;flex-direction:column;gap:5px}
.ll-in-inc.is-urgent{border-left-color:var(--rubric)}
.ll-in-inctop{display:flex;align-items:center;gap:6px}
.ll-in-incico{flex:none;width:22px;height:22px;display:grid;place-items:center;color:var(--rubric)}
.ll-in-incico .ll-icon{width:18px;height:18px}
.ll-in-inctitle{flex:1;min-width:0;font-family:var(--f-head);font-size:15px;letter-spacing:.02em;line-height:1.15}
.ll-in-timer{font-size:13px;color:var(--ink-2);white-space:nowrap;flex:none}
.ll-in-timer.is-soon{color:var(--bad)}

/* things to do */
.ll-in-acts{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.ll-in-act{padding:4px 10px;font-size:14px;display:inline-flex;align-items:center;gap:5px;white-space:normal;text-align:left;line-height:1.15}
.ll-in-act .ll-icon{width:15px;height:15px}
.ll-in-foot .ll-in-grave{margin-left:auto}
.ll-in-cost{color:var(--gold-ink);letter-spacing:0}
.ll-in-cost.is-short{color:var(--bad)}
.ll-btn-primary .ll-in-cost{color:#f6dfa4}
.ll-in-act.is-asking{background:linear-gradient(180deg,#b3382f,var(--rubric-2));color:#fbf0d8;border-color:#5e1512}
.ll-in-foot{flex:none;padding:8px 12px 10px;border-top:1px solid var(--parch-edge);background:linear-gradient(180deg,rgba(158,43,37,.06),rgba(158,43,37,.02))}
.ll-in-foot:empty{display:none}
.ll-in-gift{flex-basis:100%;display:flex;align-items:center;gap:6px}

/* the asking rent */
.ll-in-rentrow{display:flex;justify-content:space-between;align-items:baseline}
.ll-in-rentval{font-size:14px}
.ll-in-rentval b{font-weight:400;font-size:20px;color:var(--rubric)}
.ll-in-slider{position:relative;padding-bottom:16px}
.ll-in-range{-webkit-appearance:none;appearance:none;display:block;width:100%;height:22px;margin:0;background:transparent;cursor:pointer}
.ll-in-range::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:linear-gradient(90deg,var(--rubric) 0,var(--rubric) var(--fill,50%),rgba(42,29,20,.26) var(--fill,50%))}
.ll-in-range::-moz-range-track{height:4px;border-radius:2px;background:linear-gradient(90deg,var(--rubric) 0,var(--rubric) var(--fill,50%),rgba(42,29,20,.26) var(--fill,50%))}
.ll-in-range::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;margin-top:-7px;border-radius:50%;border:0;background:radial-gradient(circle at 35% 30%,#cf5348,var(--rubric) 55%,#5a1411);box-shadow:0 1px 2px rgba(0,0,0,.5),inset 0 1px 1px rgba(255,220,200,.45)}
.ll-in-range::-moz-range-thumb{width:18px;height:18px;border-radius:50%;border:0;background:radial-gradient(circle at 35% 30%,#cf5348,var(--rubric) 55%,#5a1411);box-shadow:0 1px 2px rgba(0,0,0,.5),inset 0 1px 1px rgba(255,220,200,.45)}
.ll-in-range:focus-visible{outline:none}
.ll-in-range:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 3px var(--gold-2),0 1px 2px rgba(0,0,0,.5)}
.ll-in-tick{position:absolute;top:3px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;pointer-events:none}
.ll-in-tick i{display:block;width:2px;height:16px;border-radius:1px;background:var(--gold-ink)}
.ll-in-tick em{font-style:normal;font-family:var(--f-head);font-size:12px;letter-spacing:.04em;color:var(--gold-ink);white-space:nowrap;margin-top:1px;pointer-events:auto}
.ll-in-read{margin:0;font-style:italic;font-size:15px}
.ll-in-listrow{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:2px}

/* a household */
.ll-in-why{list-style:none;margin:1px 0 0;padding:0;display:flex;flex-direction:column;gap:1px;font-size:14px}
.ll-in-why li{padding-left:16px;position:relative}
.ll-in-why li::before{position:absolute;left:2px;top:0;font-family:var(--f-head)}
.ll-in-why li.is-good::before{content:"+";color:var(--good)}
.ll-in-why li.is-bad::before{content:"\\2212";color:var(--bad)}
.ll-in-trait{font-size:14px}
.ll-in-trait b{font-family:var(--f-head);font-weight:400;letter-spacing:.03em;font-size:15px}
.ll-in-trait.is-good b{color:var(--good)}
.ll-in-trait.is-bad b{color:var(--rubric)}
.ll-in-trait span{color:var(--ink-2)}
.ll-in-hidden{display:flex;align-items:center;gap:8px}
.ll-in-qseals{display:inline-flex;gap:3px;flex:none}
.ll-in-qseal{width:20px;height:20px;border-radius:48% 52% 50% 50%/52% 48% 52% 48%;display:inline-grid;place-items:center;font-family:var(--f-head);font-size:13px;line-height:1;color:#f4e8cc;
  background:radial-gradient(circle at 35% 30%,#93876f,#5a4633 60%,#33271c);box-shadow:0 1px 1px rgba(0,0,0,.4),inset 0 1px 1px rgba(255,240,220,.3)}
.ll-in-qseal:nth-child(even){transform:rotate(9deg)}
.ll-in-mem{display:flex;gap:7px;align-items:flex-start;font-size:14px}
.ll-in-marks{display:inline-flex;gap:1px;flex:none;padding-top:3px;min-width:27px;justify-content:flex-end}
.ll-in-mark{width:13px;height:13px;display:block}
.ll-in-oath{display:flex;gap:7px;align-items:flex-start}
.ll-in-oathico{color:var(--gold-ink);line-height:0;padding-top:2px;flex:none}
.ll-in-oathico .ll-icon{width:17px;height:17px}
.ll-in-oath.is-broken .ll-in-oathico{color:var(--bad)}
.ll-in-oath.is-kept .ll-in-oathico{color:var(--good)}
.ll-in-quote{font-style:italic;font-size:14px}

/* a delegate */
.ll-in-temper{margin:0;font-size:14px}
.ll-in-temper b{font-family:var(--f-head);font-weight:400;color:var(--rubric);letter-spacing:.04em;font-size:15px}
.ll-in-temper span{color:var(--ink-2)}
.ll-in-pips{display:inline-flex;gap:5px;padding:0 3px}
.ll-in-pips i{width:9px;height:9px;transform:rotate(45deg);border:1px solid var(--gold-ink)}
.ll-in-pips i.is-on{background:linear-gradient(135deg,var(--gold-2),var(--gold))}
.ll-in-wage{display:inline-flex;align-items:center;gap:6px}
.ll-in-wage b{font-weight:400;font-size:17px;color:var(--rubric)}
.ll-in-step{appearance:none;-webkit-appearance:none;width:24px;height:24px;border-radius:50%;border:1px solid var(--ink-3);background:rgba(255,250,235,.7);color:var(--ink);cursor:pointer;font-size:15px;line-height:1;display:inline-grid;place-items:center;padding:0}
.ll-in-step:hover:not(:disabled){border-color:var(--rubric);color:var(--rubric)}
.ll-in-step:disabled{opacity:.4;cursor:not-allowed}
.ll-in-order{padding:1px 0 2px 9px;border-left:2px solid var(--gold)}
.ll-in-uses{color:var(--ink-3)}

@media (max-width:699px){
  .ll-in-sheet{max-height:min(52vh,440px)}
}
`;

const WORD_CSS = `
/* ───────── the Word bar ───────── */
.ll-part-wordbar{position:relative;width:100%;color:var(--ink);font-family:var(--f-body);font-size:var(--fs-s);line-height:1.3;pointer-events:none}
.ll-part-wordbar[hidden]{display:none}
.ll-wb-above{position:absolute;left:0;right:0;bottom:100%;display:flex;flex-direction:column;align-items:stretch;gap:6px;padding-bottom:9px;pointer-events:none}
.ll-wb-above>*{pointer-events:auto}

/* a speech scroll, rolled at both ends */
.ll-wb-bar{pointer-events:auto;position:relative;padding:6px 18px 8px;display:flex;flex-direction:column;gap:5px;border-radius:1px;transition:box-shadow .15s}
.ll-wb-bar::before,.ll-wb-bar::after{content:"";position:absolute;top:-4px;bottom:-4px;width:12px;border-radius:6px;
  background:linear-gradient(90deg,#a38955,#f5ebcf 34%,#e6d6ae 58%,#9c8250);box-shadow:0 3px 6px rgba(0,0,0,.45)}
.ll-wb-bar::before{left:-6px}
.ll-wb-bar::after{right:-6px}
.ll-wb-bar.is-focus{box-shadow:var(--lift),0 0 0 2px rgba(227,192,90,.6)}
.ll-wb-chips{display:flex;flex-wrap:wrap;gap:4px 5px;align-items:center}
.ll-wb-chip{appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;gap:4px;padding:0 9px 0 6px;height:24px;border-radius:12px;border:1px solid rgba(138,116,90,.75);background:rgba(255,250,235,.5);
  color:var(--ink-2);font-family:var(--f-head);font-size:13px;letter-spacing:.04em;cursor:pointer;white-space:nowrap;max-width:200px;line-height:1}
.ll-wb-chip span{overflow:hidden;text-overflow:ellipsis}
.ll-wb-chip .ll-icon{width:14px;height:14px;flex:none}
.ll-wb-chip:hover{color:var(--rubric);border-color:var(--rubric)}
.ll-wb-chip.is-on{background:linear-gradient(180deg,#b3382f,var(--rubric-2));border-color:#5e1512;color:#fbf0d8}
.ll-wb-row{display:flex;align-items:center;gap:8px}
.ll-wb-row .ll-seal{width:36px;height:36px}
.ll-wb-row .ll-seal .ll-icon{width:18px;height:18px}
.ll-wb-row .ll-seal[hidden]{display:none}
.ll-wb-input{flex:1;min-width:0;height:38px;border:0;border-bottom:1.5px solid var(--ink-3);border-radius:0;background:transparent;font-family:var(--f-body);font-size:18px;color:var(--ink);padding:2px 2px 0;outline:none;user-select:text;-webkit-user-select:text}
.ll-wb-input::placeholder{color:var(--ink-3);font-style:italic}
.ll-wb-input:focus{border-bottom-color:var(--rubric)}
.ll-wb-bar.is-listening .ll-wb-input{border-bottom-color:var(--gold);font-style:italic}
.ll-wb-mic.is-on{animation:ll-wb-pulse 1s ease-in-out infinite}
@keyframes ll-wb-pulse{50%{box-shadow:0 0 0 7px rgba(227,192,90,.38),0 1px 2px rgba(0,0,0,.5)}}
.ll-wb-send{background:radial-gradient(circle at 35% 30%,#6385bd,var(--lapis) 55%,#1b2b4a)}
.ll-wb-send.is-arming{animation:ll-wb-arm 1.2s linear}
@keyframes ll-wb-arm{from{box-shadow:0 0 0 0 rgba(227,192,90,.95)}to{box-shadow:0 0 0 11px rgba(227,192,90,0)}}
.ll-wb-logbtn{appearance:none;-webkit-appearance:none;border:0;background:none;color:var(--ink-2);cursor:pointer;width:28px;height:34px;display:grid;place-items:center;padding:0;border-radius:4px;flex:none}
.ll-wb-logbtn .ll-icon{width:21px;height:21px}
.ll-wb-logbtn:hover,.ll-wb-logbtn.is-on{color:var(--rubric)}

/* the candle: is anyone at court listening */
.ll-wb-candle{appearance:none;-webkit-appearance:none;border:0;background:none;padding:0;width:22px;height:34px;flex:none;cursor:pointer;line-height:0}
.ll-wb-candlesvg{width:100%;height:100%;overflow:visible}
.ll-wb-wax{fill:#f6edd6;stroke:var(--ink-2);stroke-width:1;stroke-linejoin:round}
.ll-wb-drip{fill:none;stroke:var(--ink-3);stroke-width:.8;stroke-linecap:round}
.ll-wb-dish{fill:#b9963f;stroke:var(--gold-ink);stroke-width:1;stroke-linejoin:round}
.ll-wb-wick{stroke:var(--ink);stroke-width:1.1;fill:none;stroke-linecap:round}
.ll-wb-flame{fill:#f4b83c;stroke:#c8741c;stroke-width:.8;transform-origin:10px 11px;opacity:0}
.ll-wb-glow{fill:rgba(255,196,84,0);transition:fill .5s}
.ll-wb-wisp{fill:none;stroke:var(--ink-3);stroke-width:.9;stroke-linecap:round;opacity:.75}
.ll-wb-candle.is-lit .ll-wb-flame{opacity:1;animation:ll-wb-flick 2.3s ease-in-out infinite}
.ll-wb-candle.is-lit .ll-wb-glow{fill:rgba(255,196,84,.3)}
.ll-wb-candle.is-lit .ll-wb-wisp{opacity:0}
.ll-wb-candle:not(.is-lit) .ll-wb-wax{fill:#ddd2b8}
.ll-wb-candle:not(.is-lit) .ll-wb-dish{fill:#998454}
@keyframes ll-wb-flick{0%,100%{transform:scale(1,1) rotate(-2deg)}30%{transform:scale(.93,1.08) rotate(2deg)}62%{transform:scale(1.05,.94) rotate(-1deg)}}

/* one quiet line */
.ll-wb-note{margin:0;align-self:center;max-width:100%;padding:4px 13px 5px;font-size:14px;font-style:italic;color:var(--parch);background:rgba(20,14,10,.8);border:1px solid rgba(184,159,108,.5);border-radius:14px;text-align:center;line-height:1.25}
.ll-wb-note[hidden]{display:none}

/* the answer */
.ll-wb-ex{position:relative;padding:9px 34px 10px 12px;display:flex;flex-direction:column;gap:7px;animation:ll-wb-rise .22s ease-out}
.ll-wb-ex[hidden]{display:none}
@keyframes ll-wb-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.ll-wb-ex::after{content:"";position:absolute;left:44px;bottom:-7px;width:12px;height:12px;background:var(--parch-2);border:solid var(--parch-edge);border-width:0 1px 1px 0;transform:rotate(45deg)}
.ll-wb-ex[data-status="refused"],.ll-wb-ex[data-status="error"]{box-shadow:var(--lift),inset 3px 0 0 var(--rubric)}
.ll-wb-ex[data-status="needs_confirm"]{box-shadow:var(--lift),inset 3px 0 0 var(--gold)}
.ll-wb-x{position:absolute;top:5px;right:5px;appearance:none;-webkit-appearance:none;border:0;background:none;color:var(--ink-3);cursor:pointer;font-size:13px;width:26px;height:26px;border-radius:50%;padding:0}
.ll-wb-x:hover{color:var(--rubric);background:rgba(158,43,37,.09)}
.ll-wb-said{margin:0;font-size:14px;font-style:italic;color:var(--ink-2);overflow-wrap:anywhere}
.ll-wb-saidto{font-style:normal;font-family:var(--f-head);letter-spacing:.05em;color:var(--ink-3);font-size:13px}
.ll-wb-reply{display:flex;gap:10px;align-items:flex-start}
.ll-wb-face{flex:none;width:52px;height:52px;line-height:0;display:block}
.ll-wb-face.is-empty{border-radius:50%;border:1.5px dashed var(--ink-3);opacity:.5}
.ll-wb-words{flex:1;min-width:0}
.ll-wb-who{font-family:var(--f-head);font-size:15px;letter-spacing:.04em;color:var(--rubric);line-height:1.2}
.ll-wb-role{color:var(--ink-2);font-size:13px}
.ll-wb-text{margin:2px 0 0;font-size:16px;line-height:1.35;min-height:1.35em;overflow-wrap:anywhere;user-select:text;-webkit-user-select:text}
.ll-wb-dots{display:flex;gap:5px;padding:10px 0 4px}
.ll-wb-dots i{width:6px;height:6px;border-radius:50%;background:var(--ink-2);animation:ll-wb-dot 1.2s ease-in-out infinite}
.ll-wb-dots i:nth-child(2){animation-delay:.18s}
.ll-wb-dots i:nth-child(3){animation-delay:.36s}
@keyframes ll-wb-dot{0%,70%,100%{opacity:.25;transform:none}35%{opacity:1;transform:translateY(-3px)}}
.ll-wb-acts{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;padding-left:62px}
.ll-wb-acts:empty{display:none}
.ll-wb-aye{min-width:74px}
.ll-wb-hint{font-size:13px;color:var(--ink-3);font-style:italic}
.ll-wb-verdict{margin:0;flex-basis:100%;font-family:var(--f-head);font-size:14px;letter-spacing:.04em;color:var(--ink-2)}
.ll-wb-verdict.is-good{color:var(--good)}
.ll-wb-verdict.is-bad{color:var(--bad)}
.ll-wb-ex>.ll-wb-verdict{padding-left:0}
.ll-wb-ex.is-stamped .ll-wb-verdict{transform-origin:20% 50%;animation:ll-wb-stamp .34s cubic-bezier(.2,1.5,.4,1)}
@keyframes ll-wb-stamp{from{transform:scale(1.5) rotate(-5deg);opacity:0}to{transform:none;opacity:1}}

/* what has been said */
.ll-wb-log{display:flex;flex-direction:column;max-height:min(46vh,360px);overflow:hidden}
.ll-wb-log[hidden]{display:none}
.ll-wb-loghead{display:flex;align-items:center;gap:8px;padding:8px 9px 6px 12px;border-bottom:1px solid var(--parch-edge)}
.ll-wb-loghead .ll-title{font-size:16px}
.ll-wb-loghead .ll-seal{width:24px;height:24px;font-size:11px}
.ll-wb-loglist{overflow-y:auto;padding:8px 12px 10px;display:flex;flex-direction:column;gap:9px;min-height:0}
.ll-wb-loglist .ll-note{margin:0}
.ll-wb-logrow{border-left:2px solid var(--parch-edge);padding-left:9px}
.ll-wb-logrow.is-refused{border-left-color:var(--rubric)}
.ll-wb-logrow.is-needs_confirm{border-left-color:var(--gold)}
.ll-wb-logmeta{font-family:var(--f-head);font-size:12px;letter-spacing:.06em;color:var(--ink-3)}
.ll-wb-logsaid{appearance:none;-webkit-appearance:none;border:0;background:none;padding:0;font:inherit;font-style:italic;font-size:14px;color:var(--ink-2);cursor:pointer;text-align:left;overflow-wrap:anywhere}
.ll-wb-logsaid:hover{color:var(--rubric)}
.ll-wb-logreply{margin:1px 0 0;font-size:14px;overflow-wrap:anywhere}
.ll-wb-logreply b{font-family:var(--f-head);font-weight:400;color:var(--rubric);letter-spacing:.03em}

@media (max-width:699px){
  .ll-wb-bar{padding:6px 14px 8px}
  .ll-wb-chip{height:28px}
  .ll-wb-row{gap:6px}
  .ll-wb-acts{padding-left:0}
}
`;

export const TOOLS_CSS = BUILD_CSS + INSPECTOR_CSS + WORD_CSS;
