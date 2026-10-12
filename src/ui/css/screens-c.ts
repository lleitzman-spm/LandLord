/**
 * Styles for the ledger (an open book on the table) and the council (your
 * household of delegates seated at an oak table). OWNER: ui-screens-c.
 * Prefixes: `ldg-` ledger, `cnc-` council. Built on the tokens in base.ts.
 */
const PAPER_GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .35 0 0 0 0 .25 0 0 0 0 .12 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='.38'/%3E%3C/svg%3E")`;
const WOOD_GRAIN = `repeating-linear-gradient(176deg, rgba(255,215,160,.035) 0 2px, transparent 2px 7px, rgba(0,0,0,.05) 7px 8px, transparent 8px 15px)`;

export const SCREENS_C_CSS = `
/* ═════════════════════════════ the ledger ═════════════════════════════ */
.ldg-veil{place-items:center;grid-template-columns:minmax(0,1fr);padding:16px;background:radial-gradient(70% 60% at 50% 48%,rgba(60,38,20,.38),rgba(14,10,8,.88))}
.ldg-veil[hidden]{display:none}
.ldg-wrap{position:relative;display:flex;align-items:stretch;width:min(1230px,100%);height:min(764px,calc(100vh - 32px));height:min(764px,calc(100dvh - 32px));animation:ldg-open .32s cubic-bezier(.2,.8,.25,1)}
@keyframes ldg-open{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}

.ldg-book{position:relative;flex:1;min-width:0;z-index:2;padding:15px 17px;border-radius:12px 15px 15px 12px;
  background:
    radial-gradient(120% 80% at 30% 10%,rgba(150,70,40,.35),transparent 60%),
    radial-gradient(90% 90% at 80% 100%,rgba(0,0,0,.4),transparent 70%),
    linear-gradient(160deg,#5a2a1b,#3a1a10 55%,#2a120a);
  box-shadow:0 34px 70px rgba(0,0,0,.65),0 6px 14px rgba(0,0,0,.5),0 0 0 1px #160905,inset 0 1px 0 rgba(255,210,170,.12)}
.ldg-book::before{content:"";position:absolute;inset:6px;border:1px solid rgba(201,162,39,.38);border-radius:8px 10px 10px 8px;pointer-events:none;box-shadow:inset 0 0 0 3px rgba(0,0,0,.18),inset 0 0 0 4px rgba(201,162,39,.16)}
.ldg-pages{position:relative;height:100%;border-radius:3px 4px 4px 3px;overflow:hidden;color:var(--ink);
  background:
    linear-gradient(90deg,rgba(110,78,40,.30) 0,rgba(110,78,40,0) 3.5%,rgba(110,78,40,0) 45%,rgba(110,78,40,.16) 48.6%,rgba(70,45,22,.36) 50%,rgba(110,78,40,.16) 51.4%,rgba(110,78,40,0) 55%,rgba(110,78,40,0) 96.5%,rgba(110,78,40,.30) 100%),
    radial-gradient(70% 60% at 22% 18%,rgba(255,251,234,.55),transparent 70%),
    radial-gradient(70% 60% at 78% 18%,rgba(255,251,234,.55),transparent 70%),
    radial-gradient(60% 50% at 25% 100%,rgba(160,120,70,.18),transparent 70%),
    ${PAPER_GRAIN},
    linear-gradient(180deg,var(--parch),var(--parch-2));
  box-shadow:-2px 0 0 #eadcb9,-3px 0 0 #b9a273,-5px 0 0 #e4d4ad,-6px 0 0 #a8915f,2px 0 0 #eadcb9,3px 0 0 #b9a273,5px 0 0 #e4d4ad,6px 0 0 #a8915f}
.ldg-gutter{position:absolute;top:0;bottom:0;left:50%;width:70px;transform:translateX(-50%);pointer-events:none;z-index:3;
  background:linear-gradient(90deg,transparent,rgba(90,60,28,.10) 30%,rgba(55,34,16,.30) 49%,rgba(255,250,235,.25) 50.5%,rgba(90,60,28,.10) 68%,transparent)}
.ldg-heads,.ldg-folios{position:absolute;left:0;right:0;display:grid;grid-template-columns:1fr 1fr;pointer-events:none;z-index:2;font-family:var(--f-head);letter-spacing:.12em;color:var(--ink-3)}
.ldg-heads{top:0;height:34px;align-items:end;font-size:12px}
.ldg-folios{bottom:0;height:30px;align-items:center;font-family:var(--f-body);font-style:italic;font-size:12px;letter-spacing:.04em}
.ldg-heads>span,.ldg-folios>span{text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 60px}
.ldg-spread{position:absolute;inset:38px 0 30px 0;overflow:auto;overscroll-behavior:contain;padding:4px 38px 22px;scrollbar-gutter:stable both-edges;scrollbar-width:thin;scrollbar-color:rgba(138,116,90,.55) transparent;z-index:1;outline:none}
.ldg-close{position:absolute;top:-10px;right:-10px;z-index:6;width:36px;height:36px;font-size:15px}

/* bands: a page-pair row, or a row spanning the spread */
.ldg-content{display:flex;flex-direction:column;gap:20px;min-height:100%}
.ldg-band{display:grid;grid-template-columns:minmax(0,1fr) 10% minmax(0,1fr);align-items:start}
.ldg-L{grid-column:1;display:flex;flex-direction:column;gap:16px;min-width:0}
.ldg-R{grid-column:3;display:flex;flex-direction:column;gap:16px;min-width:0}
.ldg-S{grid-column:1/-1;min-width:0}

/* type on the page */
.ldg-h{display:flex;align-items:flex-end;gap:2px;margin:6px 0 0;font-family:var(--f-head);font-weight:400;font-size:27px;line-height:1;letter-spacing:.03em;color:var(--rubric)}
.ldg-h .ldg-cap{display:inline-flex;align-items:flex-end;line-height:.8;margin-right:2px}
.ldg-h .ldg-cap>*{max-height:54px}
.ldg-h .ldg-cap svg{width:52px;height:52px}
.ldg-h .ldg-cap .ll-black{font-size:58px!important;line-height:.85}
.ldg-lede{margin:6px 0 0;font-size:15px;color:var(--ink-2);font-style:italic;line-height:1.4}
.ldg-h2{margin:0;font-family:var(--f-head);font-weight:400;font-size:15px;letter-spacing:.1em;color:var(--ink-2);display:flex;align-items:baseline;gap:10px;border-bottom:1px solid rgba(184,159,108,.8);padding-bottom:3px}
.ldg-h2>.ldg-aside{margin-left:auto;font-family:var(--f-body);font-size:13px;letter-spacing:0;font-style:italic;color:var(--ink-3)}
.ldg-p{margin:0;font-size:15px;line-height:1.45}
.ldg-small{font-size:13px;color:var(--ink-2)}
.ldg-faint{color:var(--ink-3)}
.ldg-em{font-style:italic}
.ldg-big{font-family:var(--f-head);font-size:34px;line-height:1;letter-spacing:.02em;font-variant-numeric:lining-nums tabular-nums}
.ldg-flourish{display:flex;justify-content:center;opacity:.85}
.ldg-flourish>*{max-width:100%}
.ldg-doodle{pointer-events:none;opacity:.9;align-self:flex-end;line-height:0}
.ldg-doodle:empty{display:none}
.ldg-foot{margin-top:auto;padding-top:4px}
.ldg-noface{border-radius:50%;background:radial-gradient(circle at 40% 35%,#4a6596,var(--lapis));box-shadow:inset 0 0 0 2px var(--gold)}
.ldg-block{position:relative;display:flex;flex-direction:column;gap:8px}
.ldg-good{color:var(--good)} .ldg-bad{color:var(--bad)} .ldg-warn{color:var(--warn)} .ldg-rub{color:var(--rubric)}

/* period stepper (accounts) */
.ldg-period{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.ldg-period .ldg-pname{font-family:var(--f-head);font-size:15px;letter-spacing:.06em;min-width:12ch;text-align:center}
.ldg-step{width:28px;height:28px;padding:0;display:inline-grid;place-items:center;font-size:15px;line-height:1}
.ldg-chip{font-family:var(--f-head);font-size:13px;letter-spacing:.06em;padding:3px 10px;border-radius:14px;border:1px solid var(--ink-3);background:transparent;color:var(--ink-2);cursor:pointer}
.ldg-chip:hover{border-color:var(--rubric);color:var(--rubric)}
.ldg-chip.is-on{background:var(--ink);border-color:var(--ink);color:var(--parch)}

/* the two-column account */
.ldg-acct{display:grid;grid-template-columns:1fr 1fr;gap:4px 22px}
.ldg-acct .ldg-colh{font-family:var(--f-head);font-size:13px;letter-spacing:.12em;color:var(--rubric);border-bottom:1px solid var(--parch-edge);padding-bottom:2px;margin-bottom:2px}
.ldg-lines{display:flex;flex-direction:column;gap:2px}
.ldg-line{display:flex;align-items:baseline;gap:0;font-size:15px;line-height:1.5;min-width:0}
.ldg-line>.k{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.ldg-line>.lead{flex:1;min-width:10px;border-bottom:1px dotted rgba(138,116,90,.75);margin:0 5px .32em}
.ldg-line>.v{font-variant-numeric:tabular-nums lining-nums;white-space:nowrap;text-align:right}
.ldg-line.is-total{margin-top:4px;padding-top:3px;border-top:1px solid var(--ink-3);font-family:var(--f-head);letter-spacing:.04em}
.ldg-line.is-total>.v{border-bottom:3px double var(--ink-2);line-height:1.25}
.ldg-line.is-empty{color:var(--ink-3);font-style:italic}
.ldg-net{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:8px 12px;border:1px solid rgba(184,159,108,.9);border-radius:var(--rad);background:rgba(255,250,235,.38)}
.ldg-net .k{font-family:var(--f-head);letter-spacing:.08em;font-size:15px;color:var(--ink-2)}
.ldg-net .v{font-family:var(--f-head);font-size:24px;font-variant-numeric:lining-nums tabular-nums}

/* coffers, projection, small figure boxes */
.ldg-coffers{display:flex;align-items:center;gap:14px}
.ldg-coffers .ldg-coin{width:46px;height:46px;flex:none;border-radius:50%;display:grid;place-items:center;color:var(--gold-ink);
  background:radial-gradient(circle at 35% 30%,#f6df8f,var(--gold) 55%,#8a6a16);box-shadow:inset 0 -2px 3px rgba(0,0,0,.3),0 2px 4px rgba(42,29,20,.35)}
.ldg-coffers .ldg-coin svg{width:26px;height:26px}
.ldg-proj{margin:0;padding:8px 12px;border-left:3px solid var(--gold);background:linear-gradient(90deg,rgba(201,162,39,.14),transparent);font-size:16px;font-style:italic;line-height:1.4}
.ldg-proj b{font-style:normal;font-family:var(--f-head);letter-spacing:.03em}
.ldg-boxes{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ldg-box{padding:9px 12px 10px;border:1px solid rgba(184,159,108,.9);border-radius:var(--rad);background:rgba(255,250,235,.3);display:flex;flex-direction:column;gap:4px;min-width:0}
.ldg-box .bk{font-family:var(--f-head);font-size:13px;letter-spacing:.1em;color:var(--ink-2)}
.ldg-box .bv{font-family:var(--f-head);font-size:21px;font-variant-numeric:lining-nums tabular-nums;line-height:1.1}
.ldg-box .bn{font-size:13px;color:var(--ink-2);line-height:1.35}
.ldg-box .ll-btn{align-self:flex-start;margin-top:4px;padding:4px 10px;font-size:13px}

/* charts (drawn to scale in SVG) */
.ldg-chart{display:block;width:100%;overflow:visible}
.ldg-chart text{font-family:var(--f-body);font-size:12px;fill:var(--ink-2)}
.ldg-chart .ax{stroke:var(--ink-2);stroke-width:1.2}
.ldg-chart .grid{stroke:rgba(138,116,90,.55);stroke-width:1;stroke-dasharray:1 3}
.ldg-chart .pos{fill:var(--ink-2)}
.ldg-chart .neg{fill:var(--rubric)}
.ldg-chart .due{fill:rgba(255,250,235,.45);stroke:var(--ink-3);stroke-width:1}
.ldg-chart .got{fill:var(--lapis);opacity:.82}
.ldg-chart .cur{opacity:.9}
.ldg-chart .val{font-size:12px;fill:var(--ink)}
.ldg-chart .val.neg-t{fill:var(--rubric)}
.ldg-chart .tick{font-size:12px;fill:var(--ink-3)}
.ldg-chart .mon{font-size:12px;fill:var(--ink-2)}
.ldg-chart .mon.now{fill:var(--rubric);font-family:var(--f-head)}
.ldg-chart .hit{fill:transparent}
.ldg-chart .hit:hover{fill:rgba(201,162,39,.16)}
.ldg-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:var(--ink-2)}
.ldg-legend i{display:inline-block;width:12px;height:10px;margin-right:5px;vertical-align:-1px;border-radius:1px}
.ldg-legend .sw-pos{background:var(--ink-2)} .ldg-legend .sw-neg{background:var(--rubric)}
.ldg-legend .sw-cur{background:repeating-linear-gradient(45deg,var(--ink-2) 0 2px,transparent 2px 4px);border:1px solid var(--ink-3)}
.ldg-legend .sw-due{background:rgba(255,250,235,.6);border:1px solid var(--ink-3)} .ldg-legend .sw-got{background:var(--lapis)}

/* the day book */
.ldg-daybook{display:flex;flex-direction:column}
.ldg-dayrow{display:grid;grid-template-columns:5.4em minmax(0,1fr) auto;gap:10px;align-items:baseline;font-size:14px;padding:3px 0;border-bottom:1px dotted rgba(138,116,90,.5)}
.ldg-dayrow .d{color:var(--ink-3);font-size:13px;white-space:nowrap}
.ldg-dayrow .m{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ldg-dayrow .a{font-variant-numeric:tabular-nums lining-nums;text-align:right;white-space:nowrap}

/* households table: names on the left page, figures on the right */
.ldg-sortbar{display:none;align-items:center;gap:6px;flex-wrap:wrap}
.ldg-sortbar .ldg-small{margin-right:2px}
.ldg-htable{width:100%;border-collapse:collapse;table-layout:fixed;font-size:14px}
.ldg-htable th{font-family:var(--f-head);font-weight:400;font-size:13px;letter-spacing:.05em;color:var(--ink-2);text-align:left;padding:4px 6px 5px;border-bottom:1.5px solid var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ldg-htable th.sortable{cursor:pointer}
.ldg-htable th.sortable:hover{color:var(--rubric)}
.ldg-htable th.is-sorted{color:var(--rubric)}
.ldg-htable th .arr{display:inline-block;width:1em;font-size:11px;text-align:center}
.ldg-htable th .arr:empty{width:0}
.ldg-htable th.gut,.ldg-htable td.gut{border:0!important;background:none!important;padding:0}
.ldg-htable td{padding:5px 6px;border-bottom:1px dotted rgba(138,116,90,.6);vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ldg-htable .n{text-align:right;font-variant-numeric:tabular-nums lining-nums}
.ldg-htable th.n{text-align:right}
.ldg-htable tbody tr{cursor:pointer;transition:background .12s}
.ldg-htable tbody tr:hover td:not(.gut),.ldg-htable tbody tr:focus-visible td:not(.gut){background:rgba(201,162,39,.16)}
.ldg-htable tbody tr:focus-visible{outline:none}
.ldg-htable tbody tr:focus-visible td:first-child{box-shadow:inset 3px 0 0 var(--gold)}
.ldg-htable tfoot td{border-bottom:0;border-top:1.5px solid var(--ink-3);padding-top:6px;font-family:var(--f-head);letter-spacing:.03em;color:var(--ink-2)}
.ldg-who{display:flex;align-items:center;gap:9px;min-width:0}
.ldg-who .pt{flex:none;width:34px;height:34px;border-radius:50%;overflow:hidden;display:grid;place-items:center}
.ldg-who .tx{display:flex;flex-direction:column;min-width:0;line-height:1.2}
.ldg-who .nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:15px}
.ldg-sub{display:block;font-size:12px;color:var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.25}
.ldg-hap{display:flex;align-items:center;gap:6px;justify-content:flex-end}
.ldg-hap .ll-meter{width:44px;min-width:44px;height:7px}
.ldg-hap .num{min-width:2ch;text-align:right;font-variant-numeric:tabular-nums}
.ldg-stage{display:block;font-size:12px;line-height:1.2;font-family:var(--f-head);letter-spacing:.06em}
.ldg-paid{color:var(--ink-3);font-style:italic;font-size:13px}
.ldg-over{color:var(--warn)} .ldg-under{color:var(--good)}
.ldg-key{line-height:1.45;max-width:46ch}
.ldg-key .ldg-over,.ldg-key .ldg-under{font-family:var(--f-head);letter-spacing:.04em}

/* vacancy / departure lists */
.ldg-list{display:flex;flex-direction:column}
.ldg-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;align-items:baseline;padding:6px 6px 7px;border-bottom:1px dotted rgba(138,116,90,.55);border-radius:2px;text-align:left;background:none;border-left:0;border-right:0;border-top:0;font:inherit;color:inherit;width:100%}
button.ldg-item{cursor:pointer}
button.ldg-item:hover{background:rgba(201,162,39,.14)}
.ldg-item .t{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ldg-item .r{font-variant-numeric:tabular-nums lining-nums;text-align:right;white-space:nowrap;font-size:14px}
.ldg-item .s{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:13px;color:var(--ink-2)}
.ldg-item .ll-tag{font-size:12px}
.ldg-empty{margin:0;padding:10px 0;color:var(--ink-3);font-style:italic;font-size:15px}
.ldg-kv{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 14px;font-size:15px}
.ldg-kv>.k{color:var(--ink-2)}
.ldg-kv>.v{text-align:right;font-variant-numeric:tabular-nums lining-nums}

/* standing orders: ruled entries */
.ldg-order{position:relative;padding:12px 14px 12px 16px;border:1px solid rgba(184,159,108,.85);border-radius:var(--rad);display:flex;flex-direction:column;gap:7px;
  background:repeating-linear-gradient(180deg,transparent 0 25px,rgba(47,74,122,.10) 25px 26px),rgba(255,250,235,.28)}
.ldg-order::before{content:"";position:absolute;left:7px;top:10px;bottom:10px;width:1px;background:rgba(158,43,37,.45)}
.ldg-order .to{display:flex;align-items:center;flex-wrap:wrap;gap:2px 8px;font-family:var(--f-head);font-size:13px;letter-spacing:.09em;color:var(--lapis)}
.ldg-order .to .pt{flex:none;width:26px;height:26px;border-radius:50%;overflow:hidden}
.ldg-order .to .when{margin-left:auto;font-family:var(--f-body);letter-spacing:0;font-style:italic;color:var(--ink-3);font-size:12px;white-space:nowrap}
.ldg-words{margin:0;font-size:19px;line-height:1.3;color:var(--ink);text-wrap:pretty}
.ldg-words::before{content:"\\201C";color:var(--rubric);margin-right:1px}
.ldg-words::after{content:"\\201D";color:var(--rubric);margin-left:1px}
.ldg-gist{margin:0;font-size:14px;color:var(--ink-2);font-style:italic}
.ldg-gist b{font-style:normal;font-family:var(--f-head);font-weight:400;letter-spacing:.05em}
.ldg-governs{margin:0;display:flex;gap:8px;font-size:15px;line-height:1.4;padding:6px 9px;background:rgba(201,162,39,.12);border-radius:2px}
.ldg-governs .hand{flex:none;color:var(--rubric);font-size:17px;line-height:1.2}
.ldg-order .foot{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--ink-2)}
.ldg-order .foot .ll-btn{margin-left:auto;padding:3px 10px;font-size:13px}
.ldg-saying{margin:0;padding:10px 14px;border-left:3px solid var(--rubric);font-size:18px;font-style:italic;line-height:1.35;background:rgba(255,250,235,.32)}
.ldg-saying small{display:block;margin-top:4px;font-style:normal;font-size:13px;color:var(--ink-2)}

/* oaths */
.ldg-tally{display:flex;flex-direction:column;gap:10px}
.ldg-tally .row{display:grid;grid-template-columns:5.5em 1fr auto;align-items:center;gap:10px}
.ldg-tally .lab{font-family:var(--f-head);letter-spacing:.08em;font-size:14px;color:var(--ink-2)}
.ldg-tally .cnt{font-family:var(--f-head);font-size:22px;font-variant-numeric:lining-nums}
.ldg-tally svg{display:block;height:24px;max-width:100%}
.ldg-tally .kept path{stroke:var(--ink)} .ldg-tally .broke path{stroke:var(--rubric)}
.ldg-oath{position:relative;padding:10px 12px 11px;border:1px solid rgba(184,159,108,.85);border-radius:var(--rad);background:rgba(255,250,235,.3);display:flex;flex-direction:column;gap:6px}
.ldg-oath.is-urgent{border-color:var(--rubric);box-shadow:inset 3px 0 0 var(--rubric)}
.ldg-oath .top{display:flex;align-items:center;gap:9px}
.ldg-oath .top .pt{flex:none;width:34px;height:34px;border-radius:50%;overflow:hidden}
.ldg-oath .who{font-family:var(--f-head);font-size:15px;letter-spacing:.04em;line-height:1.15;min-width:0}
.ldg-oath .what{display:block;font-family:var(--f-body);font-size:13px;color:var(--ink-2);letter-spacing:0}
.ldg-oath .left{margin-left:auto;text-align:right;white-space:nowrap;font-family:var(--f-head);font-size:15px;letter-spacing:.03em}
.ldg-oath .left small{display:block;font-family:var(--f-body);font-size:12px;color:var(--ink-3);letter-spacing:0}
.ldg-oath .ll-meter{height:5px}
.ldg-oath .acts{display:flex;justify-content:flex-end}
.ldg-oath .acts .ll-btn{padding:2px 8px;font-size:13px}
.ldg-rec{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 12px;padding:8px 2px;border-bottom:1px dotted rgba(138,116,90,.55);align-items:start}
.ldg-stamp{grid-row:span 2;align-self:center;font-family:var(--f-head);font-size:12px;letter-spacing:.12em;padding:3px 7px;border:1.5px solid currentColor;border-radius:3px;transform:rotate(-4deg);text-transform:uppercase}
.ldg-stamp.kept{color:var(--good)} .ldg-stamp.broken{color:var(--rubric)} .ldg-stamp.released{color:var(--ink-3)}
.ldg-rec .tx{font-size:15px;line-height:1.35}
.ldg-rec .tx.broken{text-decoration:line-through;text-decoration-color:rgba(158,43,37,.6)}
.ldg-rec .mt{font-size:12px;color:var(--ink-3)}

/* policies */
.ldg-pol{display:flex;flex-direction:column;gap:6px;padding:10px 0 12px;border-bottom:1px dotted rgba(138,116,90,.6)}
.ldg-pol:last-child{border-bottom:0}
.ldg-pol .hd{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.ldg-pol .nm{font-family:var(--f-head);font-size:16px;letter-spacing:.06em;flex:1;min-width:8em}
.ldg-pol .cons{margin:0;font-size:14.5px;line-height:1.45;color:var(--ink-2)}
.ldg-pol .cons b{font-weight:400;color:var(--ink);font-family:var(--f-head);letter-spacing:.03em}
.ldg-stepper{display:inline-flex;align-items:center;border:1px solid var(--ink-3);border-radius:16px;background:rgba(255,250,235,.55);overflow:hidden}
.ldg-stepper button{width:30px;height:30px;border:0;background:transparent;cursor:pointer;font-size:17px;line-height:1;color:var(--ink);display:grid;place-items:center}
.ldg-stepper button:hover:not(:disabled){background:rgba(158,43,37,.12);color:var(--rubric)}
.ldg-stepper button:disabled{opacity:.35;cursor:not-allowed}
.ldg-stepper .val{min-width:6.5em;text-align:center;font-family:var(--f-head);font-size:14px;letter-spacing:.04em;padding:0 4px;font-variant-numeric:lining-nums tabular-nums;border-left:1px solid rgba(138,116,90,.45);border-right:1px solid rgba(138,116,90,.45);line-height:30px}
.ldg-seg{display:inline-flex;border:1px solid var(--ink-3);border-radius:16px;overflow:hidden;background:rgba(255,250,235,.55)}
.ldg-seg button{border:0;background:transparent;padding:5px 12px;font-family:var(--f-head);font-size:13px;letter-spacing:.05em;color:var(--ink-2);cursor:pointer;white-space:nowrap}
.ldg-seg button+button{border-left:1px solid rgba(138,116,90,.45)}
.ldg-seg button:hover{color:var(--rubric)}
.ldg-seg button.is-on{background:var(--ink);color:var(--parch)}

/* the realm */
.ldg-census{width:100%;border-collapse:collapse;font-size:14px}
.ldg-census th{font-family:var(--f-head);font-weight:400;font-size:12px;letter-spacing:.1em;color:var(--ink-3);text-align:left;padding:2px 4px;border-bottom:1px solid var(--parch-edge)}
.ldg-census th.n,.ldg-census td.n{text-align:right}
.ldg-census td{padding:4px 4px;border-bottom:1px dotted rgba(138,116,90,.5);vertical-align:middle;font-variant-numeric:tabular-nums lining-nums}
.ldg-census tr.cat td{font-family:var(--f-head);letter-spacing:.1em;font-size:12px;color:var(--rubric);border-bottom:0;padding-top:9px}
.ldg-census .ll-meter{width:64px;height:7px;display:inline-block;vertical-align:middle;margin-right:6px}
.ldg-census .cw{font-size:12px;color:var(--ink-3);font-style:italic}
.ldg-stand{display:flex;flex-direction:column;gap:6px}
.ldg-stand .hd{display:flex;align-items:baseline;gap:10px}
.ldg-stand .hd .nm{font-family:var(--f-head);font-size:16px;letter-spacing:.06em}
.ldg-stand .hd .v{margin-left:auto;font-family:var(--f-head);font-size:22px;font-variant-numeric:lining-nums}
.ldg-stand .ll-meter{height:9px}
.ldg-moves{display:flex;flex-direction:column;gap:3px;margin:2px 0 0;padding:0;list-style:none}
.ldg-moves li{display:grid;grid-template-columns:1.1em minmax(0,1fr) auto;gap:6px;font-size:13.5px;line-height:1.35;color:var(--ink-2)}
.ldg-moves .ar{font-size:11px;line-height:1.7}
.ldg-moves .ar.up{color:var(--good)} .ldg-moves .ar.dn{color:var(--rubric)} .ldg-moves .ar.eq{color:var(--gold-ink)}
.ldg-moves .ago{color:var(--ink-3);font-size:12px;white-space:nowrap}
.ldg-tug{position:relative;height:16px;border-radius:8px;background:linear-gradient(90deg,var(--lapis),#4a5f8a 49.6%,var(--rubric) 50.4%,#b04a3c);box-shadow:inset 0 1px 2px rgba(0,0,0,.3)}
.ldg-tug i{position:absolute;top:-4px;width:4px;height:24px;margin-left:-2px;background:var(--gold);border-radius:2px;box-shadow:0 0 0 1px var(--gold-ink)}
.ldg-tug-l{display:flex;justify-content:space-between;font-size:13px;color:var(--ink-2)}

/* ribbons (tabs) */
.ldg-ribbons{position:relative;z-index:1;display:flex;flex-direction:column;gap:7px;padding-top:44px;margin-left:-16px;flex:none}
.ldg-rib{--rc:var(--rubric);--rt:#fbf0d8;position:relative;display:flex;align-items:center;gap:7px;width:178px;height:38px;padding:0 22px 0 24px;border:0;cursor:pointer;
  font-family:var(--f-head);font-size:14px;letter-spacing:.05em;color:var(--rt);text-align:left;white-space:nowrap;
  background:
    repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 3px),
    linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0) 40%,rgba(0,0,0,.22)),
    var(--rc);
  clip-path:polygon(0 0,100% 0,calc(100% - 11px) 50%,100% 100%,0 100%);
  filter:drop-shadow(0 2px 2px rgba(0,0,0,.5)) brightness(.82) saturate(.85);
  text-shadow:0 1px 0 rgba(0,0,0,.35);transform:translateX(-10px);transition:transform .16s,filter .16s}
.ldg-rib:hover{transform:translateX(-3px);filter:drop-shadow(0 2px 2px rgba(0,0,0,.5)) brightness(.95)}
.ldg-rib.is-on{transform:translateX(6px);filter:drop-shadow(0 3px 3px rgba(0,0,0,.55)) brightness(1.06)}
.ldg-rib:focus-visible{outline:none;filter:drop-shadow(0 0 0 var(--gold-2)) drop-shadow(0 0 3px var(--gold-2)) brightness(1.06)}
.ldg-rib .ll-icon{width:17px;height:17px;flex:none;opacity:.95}
.ldg-rib .badge{margin-left:auto;min-width:18px;height:18px;padding:0 5px;border-radius:9px;font-family:var(--f-body);font-size:12px;line-height:18px;text-align:center;background:rgba(251,240,216,.92);color:var(--rubric-2);text-shadow:none}
.ldg-rib[data-tab="accounts"]{--rc:#a8841c;--rt:#2a1d14}
.ldg-rib[data-tab="accounts"]{text-shadow:0 1px 0 rgba(255,240,200,.35)}
.ldg-rib[data-tab="households"]{--rc:#9e2b25}
.ldg-rib[data-tab="orders"]{--rc:#2f4a7a}
.ldg-rib[data-tab="oaths"]{--rc:#6b2f4f}
.ldg-rib[data-tab="policies"]{--rc:#4f7a5a}
.ldg-rib[data-tab="realm"]{--rc:#5a4633}

/* ── one page, under 760px ── */
@media (max-width:760px){
  .ldg-veil{padding:10px 16px 16px;place-items:stretch;grid-template-columns:minmax(0,1fr)}
  .ldg-wrap{flex-direction:column-reverse;height:calc(100vh - 26px);height:calc(100dvh - 26px);width:100%;min-width:0}
  .ldg-ribbons{flex-direction:row;gap:4px;padding:0 2px 0 4px;margin:0 0 -8px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;flex:none;height:54px;align-items:flex-start;min-width:0;width:100%;scroll-snap-type:x proximity}
  .ldg-rib{scroll-snap-align:start}
  .ldg-ribbons::-webkit-scrollbar{display:none}
  .ldg-rib{width:auto;height:44px;padding:0 13px 10px;align-items:center;font-size:13px;flex:none;transform:translateY(-4px);
    clip-path:polygon(0 0,100% 0,100% 100%,50% calc(100% - 9px),0 100%)}
  .ldg-rib:hover{transform:translateY(-2px)} .ldg-rib.is-on{transform:translateY(3px)}
  .ldg-rib .ll-icon{display:none}
  .ldg-book{padding:7px;border-radius:9px}
  .ldg-book::before{inset:3px}
  .ldg-pages{background:
    linear-gradient(90deg,rgba(110,78,40,.26) 0,rgba(110,78,40,0) 5%,rgba(110,78,40,0) 95%,rgba(110,78,40,.22) 100%),
    radial-gradient(90% 60% at 40% 10%,rgba(255,251,234,.55),transparent 70%),${PAPER_GRAIN},linear-gradient(180deg,var(--parch),var(--parch-2));
    box-shadow:2px 0 0 #eadcb9,3px 0 0 #b9a273,4px 0 0 #a8915f}
  .ldg-gutter{display:none}
  .ldg-heads,.ldg-folios{grid-template-columns:1fr}
  .ldg-heads>span:last-child,.ldg-folios>span:last-child{display:none}
  .ldg-heads>span,.ldg-folios>span{padding:0 50px 0 16px;text-align:left}
  .ldg-heads{height:30px}
  .ldg-spread{inset:32px 0 26px 0;padding:2px 14px 18px;scrollbar-gutter:auto}
  .ldg-close{top:-6px;right:-6px}
  .ldg-band{grid-template-columns:minmax(0,1fr);gap:16px}
  .ldg-wide{display:none}
  .ldg-census .ll-meter{width:38px;min-width:38px;margin-right:5px}
  .ldg-census td{white-space:nowrap}
  .ldg-census td:first-child{white-space:normal}
  .ldg-L,.ldg-R,.ldg-S{grid-column:1}
  .ldg-h{font-size:24px}
  .ldg-acct{grid-template-columns:1fr;gap:12px}
  .ldg-boxes{grid-template-columns:1fr}
  .ldg-sortbar{display:flex}
  /* households become entries, one per household */
  .ldg-htable,.ldg-htable tbody,.ldg-htable tfoot{display:block}
  .ldg-htable thead,.ldg-htable colgroup,.ldg-htable td.gut{display:none}
  .ldg-htable tbody tr{display:grid;grid-template-columns:minmax(0,1fr) auto auto;grid-template-areas:"who who rent" "home hap owe" "lease lease months";gap:3px 10px;padding:8px 4px;border-bottom:1px dotted rgba(138,116,90,.6)}
  .ldg-htable tfoot tr{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:8px 4px}
  .ldg-htable td{border:0;padding:0;white-space:normal}
  .ldg-htable tfoot td{border:0;padding:0}
  .ldg-htable tfoot td:empty{display:none}
  .ldg-htable td[data-c="who"]{grid-area:who} .ldg-htable td[data-c="rent"]{grid-area:rent;text-align:right}
  .ldg-htable td[data-c="home"]{grid-area:home;font-size:13px;color:var(--ink-2)} .ldg-htable td[data-c="hap"]{grid-area:hap}
  .ldg-htable td[data-c="owe"]{grid-area:owe;text-align:right} .ldg-htable td[data-c="lease"]{grid-area:lease;font-size:13px;color:var(--ink-2)}
  .ldg-htable td[data-c="months"]{grid-area:months;font-size:13px;color:var(--ink-2)}
  .ldg-htable td[data-c="market"]{display:none}
  .ldg-htable td[data-lab]::before{content:attr(data-lab) " ";font-size:12px;color:var(--ink-3);font-family:var(--f-head);letter-spacing:.05em}
  .ldg-htable .ldg-stage{display:inline;margin-left:4px}
}

/* ═════════════════════════════ the council ═════════════════════════════ */
.cnc-veil{place-items:start center;grid-template-columns:minmax(0,1fr);padding:18px 16px 24px;background:
  radial-gradient(60% 45% at 50% 52%,rgba(255,170,80,.10),transparent 70%),
  radial-gradient(80% 70% at 50% 45%,rgba(40,24,14,.45),rgba(12,8,6,.92))}
.cnc-veil[hidden]{display:none}
.cnc-room{position:relative;width:min(1240px,100%);display:flex;flex-direction:column;gap:12px;animation:ldg-open .32s cubic-bezier(.2,.8,.25,1)}
.cnc-head{display:flex;align-items:center;gap:16px;padding:0 6px;color:var(--parch);flex-wrap:wrap}
.cnc-title{margin:0;font-family:var(--f-head);font-weight:400;font-size:30px;letter-spacing:.06em;color:var(--parch);text-shadow:0 2px 8px rgba(0,0,0,.6)}
.cnc-title b{font-weight:400;color:var(--gold-2)}
.cnc-sub{margin:2px 0 0;font-size:15px;color:#d8c8a2;font-style:italic}
.cnc-head .grow{flex:1;min-width:0}
.cnc-head .ll-btn{background:linear-gradient(180deg,rgba(255,250,235,.92),rgba(217,199,156,.92))}
.cnc-close{width:36px;height:36px;font-size:15px}

.cnc-hall{position:relative;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;padding:0 10px 22px}
.cnc-table{position:absolute;left:-6px;right:-6px;top:150px;bottom:0;border-radius:30px 30px 18px 18px;pointer-events:none;
  background:
    radial-gradient(18% 30% at 25% 8%,rgba(255,190,110,.20),transparent 70%),
    radial-gradient(18% 30% at 75% 8%,rgba(255,190,110,.20),transparent 70%),
    ${WOOD_GRAIN},
    linear-gradient(180deg,#76492a 0,#5b371f 6%,#4a2c18 40%,#3a2213);
  box-shadow:inset 0 3px 0 rgba(255,215,160,.16),inset 0 -12px 30px rgba(0,0,0,.35),0 34px 60px rgba(0,0,0,.6),0 0 0 1px #1e0f07}
.cnc-table::before{content:"";position:absolute;left:0;right:0;top:0;height:14px;border-radius:30px 30px 0 0;background:linear-gradient(180deg,rgba(255,220,170,.18),transparent)}
.cnc-candle{position:absolute;top:-38px;width:12px;height:34px;margin-left:-6px;border-radius:3px 3px 2px 2px;background:linear-gradient(90deg,#d8c9a4,#f2e7c9 45%,#c9b88f);box-shadow:0 4px 6px rgba(0,0,0,.4);pointer-events:none;z-index:0}
.cnc-candle::before{content:"";position:absolute;left:50%;top:-14px;width:9px;height:15px;margin-left:-4.5px;border-radius:50% 50% 45% 45%/60% 60% 40% 40%;background:radial-gradient(circle at 50% 70%,#fff6d0,#ffc95a 45%,rgba(255,140,40,.0) 72%);animation:cnc-flick 2.6s ease-in-out infinite;transform-origin:50% 100%}
.cnc-candle::after{content:"";position:absolute;left:50%;top:-60px;width:120px;height:120px;margin-left:-60px;border-radius:50%;background:radial-gradient(circle,rgba(255,200,110,.22),transparent 65%);pointer-events:none}
@keyframes cnc-flick{0%,100%{transform:scale(1) rotate(-1deg)}30%{transform:scale(1.06,.94) rotate(2deg)}60%{transform:scale(.95,1.05) rotate(-2deg)}}

.cnc-seat{position:relative;display:flex;flex-direction:column;align-items:center;min-width:0;z-index:1}
.cnc-seat.is-hl .cnc-card{box-shadow:var(--lift),0 0 0 3px var(--gold-2)}
.cnc-chair{position:absolute;top:0;left:50%;width:156px;height:178px;margin-left:-78px;border-radius:78px 78px 10px 10px;
  background:radial-gradient(70% 50% at 50% 30%,rgba(120,70,40,.35),transparent 70%),linear-gradient(180deg,#3b2113,#24130a 70%,#1b0e07);
  box-shadow:inset 0 0 0 5px rgba(0,0,0,.25),inset 0 0 0 6px rgba(201,162,39,.20),0 8px 18px rgba(0,0,0,.5)}
.cnc-chair::before{content:"";position:absolute;left:50%;top:-9px;width:26px;height:26px;margin-left:-13px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#7a4a2a,#2b160b);box-shadow:0 2px 4px rgba(0,0,0,.5)}
.cnc-plate{position:absolute;top:150px;left:50%;transform:translateX(-50%);z-index:3;padding:2px 12px;border-radius:2px;font-family:var(--f-head);font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#3b2a08;
  background:linear-gradient(180deg,#f0d77e,#c9a227 55%,#9a7a1a);box-shadow:0 1px 0 rgba(255,240,190,.6) inset,0 2px 4px rgba(0,0,0,.5);white-space:nowrap}
.cnc-portrait{position:relative;z-index:2;margin-top:24px;width:128px;height:128px;border-radius:50%;display:grid;place-items:center;filter:drop-shadow(0 6px 10px rgba(0,0,0,.55))}
.cnc-portrait.is-empty{border-radius:50%;border:2px dashed rgba(201,162,39,.35);background:radial-gradient(circle,rgba(0,0,0,.25),rgba(0,0,0,.05));color:rgba(227,192,90,.55);filter:none}
.cnc-portrait.is-empty .ll-icon{width:40px;height:40px}
.cnc-card{position:relative;z-index:2;width:100%;margin-top:16px;padding:20px 14px 14px;display:flex;flex-direction:column;gap:9px;transform:rotate(var(--tilt,0deg))}
.cnc-name{margin:0;font-family:var(--f-head);font-weight:400;font-size:20px;letter-spacing:.03em;line-height:1.1;text-align:center;color:var(--ink)}
.cnc-role{margin:0;text-align:center;font-family:var(--f-head);font-size:13px;letter-spacing:.14em;color:var(--rubric)}
.cnc-temper{display:flex;flex-direction:column;gap:2px;padding:7px 9px;border-radius:2px;background:rgba(47,74,122,.08);border-left:2px solid var(--lapis)}
.cnc-temper .tn{font-family:var(--f-head);font-size:15px;letter-spacing:.04em;color:var(--lapis)}
.cnc-temper .tn i{font-style:italic;font-family:var(--f-body);letter-spacing:0;color:var(--ink-2)}
.cnc-temper .tb{font-size:13.5px;line-height:1.35;color:var(--ink-2);font-style:italic}
.cnc-temper.is-unknown{background:rgba(42,29,20,.05);border-left-color:var(--ink-3)}
.cnc-temper.is-unknown .tn{color:var(--ink-3)}
.cnc-row{display:flex;align-items:center;gap:8px;font-size:14px;min-width:0}
.cnc-row .k{font-family:var(--f-head);font-size:13px;letter-spacing:.07em;color:var(--ink-2);min-width:4.6em}
.cnc-row .v{margin-left:auto;text-align:right;font-variant-numeric:tabular-nums lining-nums}
.cnc-pips{display:inline-flex;gap:4px}
.cnc-pips i{width:11px;height:11px;border-radius:50%;border:1.5px solid var(--gold-ink);background:transparent}
.cnc-pips i.on{background:radial-gradient(circle at 35% 30%,var(--gold-2),var(--gold) 60%,var(--gold-ink))}
.cnc-wage{display:inline-flex;align-items:center;gap:0;border:1px solid var(--ink-3);border-radius:14px;overflow:hidden;background:rgba(255,250,235,.55);margin-left:auto}
.cnc-wage button{width:26px;height:26px;border:0;background:transparent;cursor:pointer;font-size:16px;line-height:1;display:grid;place-items:center;color:var(--ink)}
.cnc-wage button:hover{background:rgba(158,43,37,.12);color:var(--rubric)}
.cnc-wage button:disabled{opacity:.35;cursor:not-allowed}
.cnc-wage .wv{min-width:3.2em;text-align:center;font-family:var(--f-head);font-size:14px;line-height:26px;border-left:1px solid rgba(138,116,90,.45);border-right:1px solid rgba(138,116,90,.45);font-variant-numeric:tabular-nums lining-nums}
.cnc-note{margin:0;font-size:13px;line-height:1.35;color:var(--ink-2)}
.cnc-note.warn{color:var(--warn)} .cnc-note.good{color:var(--good)}
.cnc-loyal{display:flex;flex-direction:column;gap:3px}
.cnc-loyal .ll-meter{height:8px}
.cnc-auth{margin:0;font-size:14px;line-height:1.38;padding:6px 0 0;border-top:1px dotted rgba(138,116,90,.6)}
.cnc-auth b{font-family:var(--f-head);font-weight:400;letter-spacing:.05em;color:var(--ink-2)}
.cnc-auth .next{display:block;margin-top:3px;font-size:12.5px;font-style:italic;color:var(--ink-3)}
.cnc-hopefuls{display:flex;align-items:center;justify-content:center;gap:9px;margin-top:4px;padding-top:8px;border-top:1px dotted rgba(138,116,90,.6);font-size:13px;color:var(--ink-2);text-align:left}
.cnc-hopefuls .faces{display:inline-flex;flex:none}
.cnc-hopefuls .faces>*{width:30px;height:30px;border-radius:50%;overflow:hidden;box-shadow:0 0 0 2px var(--parch)}
.cnc-hopefuls .faces>*+*{margin-left:-9px}
.cnc-now{margin:0;font-size:14px;line-height:1.38;display:flex;gap:7px;align-items:flex-start}
.cnc-now .ll-icon{margin-top:2px;color:var(--ink-3)}
.cnc-links{display:flex;gap:10px;flex-wrap:wrap;font-size:13px}
.cnc-links .ll-btn-quiet{padding:0;font-family:var(--f-body);font-size:13px;letter-spacing:0;text-decoration:underline;text-decoration-color:rgba(138,116,90,.6)}
.cnc-acts{display:flex;gap:8px;margin-top:2px}
.cnc-acts .ll-btn{flex:1}
.cnc-confirm{display:flex;flex-direction:column;gap:8px;padding:10px 11px;border:1px solid var(--rubric);border-radius:var(--rad);background:rgba(158,43,37,.07)}
.cnc-confirm p{margin:0;font-size:14px;line-height:1.4}
.cnc-confirm .cnc-acts .ll-btn{white-space:normal}

/* speaking at the table */
.cnc-speak{display:flex;flex-direction:column;gap:7px;padding-top:6px;border-top:1px dotted rgba(138,116,90,.6)}
.cnc-speak form{display:flex;gap:6px}
.cnc-mic{flex:none;width:34px;border:1px solid var(--ink-3);border-radius:var(--rad);background:rgba(255,250,235,.6);color:var(--ink-2);cursor:pointer;display:grid;place-items:center;padding:0}
.cnc-mic:hover{color:var(--rubric);border-color:var(--rubric)}
.cnc-mic.is-on{background:var(--rubric);border-color:var(--rubric-2);color:#fbf0d8;animation:cnc-listen 1.2s ease-in-out infinite}
.cnc-mic .ll-icon{width:18px;height:18px}
@keyframes cnc-listen{0%,100%{box-shadow:0 0 0 0 rgba(158,43,37,.45)}50%{box-shadow:0 0 0 5px rgba(158,43,37,0)}}
.cnc-sayings{display:flex;flex-direction:column;gap:3px}
.cnc-sayings[hidden],.cnc-veil [hidden],.ldg-veil [hidden]{display:none!important}
.cnc-sayings .lab{font-family:var(--f-head);font-size:12px;letter-spacing:.1em;color:var(--ink-3)}
.cnc-saying{text-align:left;border:0;border-left:2px solid rgba(158,43,37,.5);background:rgba(255,250,235,.35);padding:4px 8px;font:inherit;font-size:13.5px;font-style:italic;line-height:1.3;color:var(--ink-2);cursor:pointer;border-radius:0 2px 2px 0}
.cnc-saying:hover{color:var(--rubric);background:rgba(201,162,39,.16)}
.cnc-speak .ll-input{padding:6px 9px;font-size:15px}
.cnc-speak .ll-btn{padding:4px 10px}
.cnc-said{margin:0;font-size:14px;font-style:italic;color:var(--ink-2);text-align:right}
.cnc-said::before{content:"\\201C"} .cnc-said::after{content:"\\201D"}
.cnc-reply{position:relative;margin:0;padding:8px 10px;border-radius:3px;background:rgba(255,250,235,.7);border:1px solid var(--parch-edge);font-size:14.5px;line-height:1.4;min-height:2.2em}
.cnc-reply::before{content:"";position:absolute;left:18px;top:-6px;width:10px;height:10px;background:inherit;border-left:1px solid var(--parch-edge);border-top:1px solid var(--parch-edge);transform:rotate(45deg)}
.cnc-reply.is-refused{border-color:var(--rubric)}
.cnc-reply.is-think{color:var(--ink-3);font-style:italic}
.cnc-reply .dots i{display:inline-block;animation:cnc-dot 1.2s infinite;opacity:.3}
.cnc-reply .dots i:nth-child(2){animation-delay:.2s} .cnc-reply .dots i:nth-child(3){animation-delay:.4s}
@keyframes cnc-dot{0%,100%{opacity:.25}40%{opacity:1}}

/* empty seats and the candidates */
.cnc-why{display:flex;flex-direction:column;gap:6px;text-align:center;padding:4px 2px}
.cnc-why .big{font-family:var(--f-head);font-size:17px;letter-spacing:.04em;color:var(--rubric)}
.cnc-why p{margin:0;font-size:14px;line-height:1.4;color:var(--ink-2)}
.cnc-cands{display:flex;flex-direction:column;gap:10px}
.cnc-cands-h{margin:0;text-align:center;font-family:var(--f-head);font-size:13px;letter-spacing:.12em;color:var(--ink-2)}
.cnc-cand{position:relative;padding:10px 11px 11px;display:flex;flex-direction:column;gap:6px;transform:rotate(var(--tilt,0deg));background:
  radial-gradient(120% 90% at 20% 0%,rgba(255,250,230,.6),transparent 60%),linear-gradient(180deg,#f3e9cf,#e8dab4);border:1px solid var(--parch-edge);border-radius:2px;box-shadow:0 3px 8px rgba(42,29,20,.28)}
.cnc-cand .top{display:flex;align-items:center;gap:9px}
.cnc-cand .pt{flex:none;width:52px;height:52px;border-radius:50%;overflow:hidden}
.cnc-cand .nm{font-family:var(--f-head);font-size:15.5px;letter-spacing:.03em;line-height:1.15}
.cnc-cand .sp{display:block;font-family:var(--f-body);font-size:12.5px;color:var(--ink-3);letter-spacing:0}
.cnc-pitch{margin:0;font-size:14px;line-height:1.38;font-style:italic;color:var(--ink)}
.cnc-pitch::before{content:"\\201C";color:var(--rubric)} .cnc-pitch::after{content:"\\201D";color:var(--rubric)}
.cnc-cand .meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;color:var(--ink-2)}
.cnc-cand .meta .wage{margin-left:auto;font-variant-numeric:tabular-nums lining-nums}
.cnc-cand .tmp{font-size:13px;color:var(--lapis)}
.cnc-cand .tmp.unk{color:var(--ink-3);font-style:italic}
.cnc-cand .ll-btn{align-self:stretch}
.cnc-cand.is-dim{opacity:.72}

@media (max-width:1020px){
  .cnc-hall{grid-template-columns:repeat(2,minmax(0,1fr));row-gap:30px}
  .cnc-table{display:none}
  .cnc-seat::before{content:"";position:absolute;left:-4px;right:-4px;top:150px;bottom:-10px;border-radius:24px 24px 14px 14px;z-index:-1;background:${WOOD_GRAIN},linear-gradient(180deg,#6b4226,#4a2c18 30%,#3a2213);box-shadow:inset 0 3px 0 rgba(255,215,160,.14),0 18px 34px rgba(0,0,0,.5)}
}
@media (max-width:620px){
  .cnc-veil{padding:12px 16px 20px}
  .cnc-head{position:relative;padding:0 46px 0 2px;gap:10px}
  .cnc-head .grow{flex:1 1 100%}
  .cnc-close{position:absolute;top:0;right:0}
  .cnc-hall{grid-template-columns:minmax(0,1fr);padding:0 2px 16px}
  .cnc-title{font-size:25px;line-height:1.1}
  .cnc-card{transform:none}
}
`;
