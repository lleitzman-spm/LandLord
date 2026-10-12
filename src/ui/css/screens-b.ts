/**
 * Styles for the audience and the charter (ui-screens-b).
 * Both screens size themselves from their own box (container queries), so
 * they lay out correctly wherever the shell mounts them.
 *
 * Shared pieces: the letterbox bars (.ll-lbx-*), the wax seal (.ll-wax),
 * typed text (.ll-typed / .ll-untyped). Audience: .ll-aud-*. Charter: .ll-chr-*.
 */
export const SCREENS_B_CSS = `
/* ───────── shared: typed text, art holders, wax ───────── */
.ll-untyped{visibility:hidden}
.ll-art{display:inline-block;line-height:0;flex:none}
.ll-art:empty{display:none}
.ll-art>svg{display:block;max-width:100%;height:auto}
.ll-wax{position:relative;display:inline-grid;place-items:center;flex:none;filter:drop-shadow(0 3px 4px rgba(50,8,6,.55))}
.ll-wax>svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.ll-wax-icon{position:relative;display:grid;place-items:center;color:rgba(70,12,9,.82);filter:drop-shadow(0 1px 0 rgba(255,196,170,.4))}
.ll-wax-icon .ll-icon{width:1em;height:1em;vertical-align:0}
.ll-wax.is-gold .ll-wax-icon{color:rgba(84,62,6,.85);filter:drop-shadow(0 1px 0 rgba(255,240,190,.55))}

/* ───────── shared: letterbox bars ───────── */
.ll-lbx{background:#060403;color:var(--parch-3);display:flex;align-items:center;gap:var(--s-4);padding:0 var(--s-5);min-height:54px;font-family:var(--f-head);font-size:var(--fs-s);letter-spacing:.09em;position:relative;z-index:3;min-width:0}
.ll-lbx.is-top{border-bottom:1px solid rgba(201,162,39,.4);box-shadow:0 10px 30px rgba(0,0,0,.55);animation:ll-lbx-top .55s cubic-bezier(.2,.8,.2,1) both}
.ll-lbx.is-bottom{border-top:1px solid rgba(201,162,39,.4);box-shadow:0 -10px 30px rgba(0,0,0,.55);animation:ll-lbx-bottom .55s cubic-bezier(.2,.8,.2,1) both}
@keyframes ll-lbx-top{from{transform:translateY(-100%)}}
@keyframes ll-lbx-bottom{from{transform:translateY(100%)}}
.ll-lbx-kicker{color:var(--gold-2);white-space:nowrap}
.ll-lbx-dim{color:var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.ll-lbx-note{font-family:var(--f-body);font-style:italic;letter-spacing:0;color:#a8946f;min-width:0}
.ll-lbx .ll-btn-quiet{color:var(--parch-3)}
.ll-lbx .ll-btn-quiet:hover:not(:disabled){color:var(--gold-2)}
.ll-lbx-btn{font-family:var(--f-head);font-size:var(--fs-s);letter-spacing:.07em;padding:7px 14px;border-radius:var(--rad);cursor:pointer;border:1px solid rgba(201,162,39,.55);background:rgba(201,162,39,.08);color:var(--parch);white-space:nowrap;transition:background .12s,border-color .12s}
.ll-lbx-btn:hover:not(:disabled){background:rgba(201,162,39,.2);border-color:var(--gold-2)}
.ll-lbx-btn:disabled{opacity:.4;cursor:not-allowed}

/* ═════════════════════ the audience ═════════════════════ */
.ll-aud{position:absolute;inset:0;container-type:size;container-name:llaud;isolation:isolate;display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;color:var(--parch);
  background:radial-gradient(85% 70% at 50% 46%,rgba(14,10,8,.2),rgba(14,10,8,.6) 68%,rgba(14,10,8,.88));
  -webkit-backdrop-filter:blur(2.5px) saturate(.82);backdrop-filter:blur(2.5px) saturate(.82);animation:ll-aud-veil .5s both}
.ll-aud[hidden],.ll-aud [hidden],.ll-chr[hidden],.ll-chr [hidden]{display:none!important}
@keyframes ll-aud-veil{from{opacity:0}}

/* top bar: who is waiting */
.ll-aud-queue{margin-left:auto;display:flex;align-items:center;gap:var(--s-2);min-width:0}
.ll-aud-queue[hidden]{display:none}
.ll-aud-queue-label{color:var(--ink-3);white-space:nowrap}
.ll-aud-qbtn{position:relative;padding:0;border:0;background:none;border-radius:50%;cursor:pointer;line-height:0;opacity:.72;transition:opacity .15s,transform .15s;flex:none}
.ll-aud-qbtn:hover:not(:disabled){opacity:1;transform:translateY(-1px)}
.ll-aud-qbtn:disabled{cursor:default}
.ll-aud-qbtn.is-now{opacity:1;box-shadow:0 0 0 2px #060403,0 0 0 4px var(--gold-2)}
.ll-aud-qbtn.is-urgent::after{content:'';position:absolute;right:-2px;top:-2px;width:9px;height:9px;border-radius:50%;background:var(--rubric);box-shadow:0 0 0 2px #060403}
.ll-aud-leave-top{display:none}

/* the stage */
.ll-aud-stage{min-height:0;display:grid;grid-template-columns:minmax(250px,318px) minmax(0,610px) minmax(196px,236px);gap:var(--s-5);justify-content:center;align-items:stretch;padding:var(--s-5)}

/* the petitioner */
.ll-aud-who{display:flex;flex-direction:column;align-items:center;gap:var(--s-3);min-height:0;min-width:0}
.ll-aud.is-entering .ll-aud-who{animation:ll-aud-arrive .7s .1s cubic-bezier(.2,.8,.2,1) both}
@keyframes ll-aud-arrive{from{opacity:0;transform:translateY(18px) scale(.96)}}
.ll-aud-portrait{position:relative;display:grid;place-items:center;flex:none;margin-top:var(--s-1);cursor:default}
.ll-aud-portrait::before{content:'';position:absolute;inset:-16%;border-radius:50%;background:radial-gradient(closest-side,rgba(255,180,100,.4),rgba(255,170,90,.12) 58%,transparent 74%);z-index:-1;animation:ll-aud-candle 5.5s ease-in-out infinite}
@keyframes ll-aud-candle{0%,100%{opacity:.85;transform:scale(1)}37%{opacity:1;transform:scale(1.03)}61%{opacity:.78;transform:scale(.985)}80%{opacity:.95}}
.ll-aud-face{border-radius:50%;line-height:0;box-shadow:0 18px 44px rgba(0,0,0,.65),0 2px 0 rgba(0,0,0,.4)}
.ll-aud-plate{position:relative;text-align:center;padding:8px 22px 10px;max-width:100%;min-width:66%;margin-top:-18px;z-index:1}
.ll-aud-plate::before,.ll-aud-plate::after{content:'';position:absolute;top:9px;bottom:-5px;width:22px;background:linear-gradient(180deg,var(--parch-3),#c4ae7e);z-index:-1;box-shadow:0 4px 10px rgba(0,0,0,.4)}
.ll-aud-plate::before{left:-13px;clip-path:polygon(0 0,100% 0,100% 100%,0 100%,42% 50%)}
.ll-aud-plate::after{right:-13px;clip-path:polygon(0 0,100% 0,58% 50%,100% 100%,0 100%)}
.ll-aud-name{font-family:var(--f-head);font-weight:400;font-size:var(--fs-xl);line-height:1.1;letter-spacing:.03em;color:var(--rubric);margin:0;text-wrap:balance}
.ll-aud-desc{font-size:var(--fs-s);color:var(--ink-2);margin:3px 0 0;text-wrap:balance}
.ll-aud-mood{display:inline-block;margin-top:5px;font-family:var(--f-head);font-size:var(--fs-xs);letter-spacing:.1em;color:var(--ink-2)}
.ll-aud-mood b{font-weight:400;color:var(--ink)}
.ll-aud-mood.is-warm b{color:var(--good)} .ll-aud-mood.is-cold b{color:var(--bad)}
.ll-aud-facts-toggle{display:none}
.ll-aud-facts{width:100%;padding:10px 14px 12px;font-size:var(--fs-s);display:flex;flex-direction:column;gap:5px;overflow:auto;min-height:0;scrollbar-width:thin}
.ll-aud-facts .ll-stat-v{display:inline-flex;align-items:center;gap:6px;justify-content:flex-end;flex-wrap:wrap}
.ll-aud-hface{width:18px;height:18px;flex:none}
.ll-aud-traits{display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end}
.ll-aud-mem-h{font-family:var(--f-head);font-size:var(--fs-xs);letter-spacing:.12em;color:var(--rubric);margin:5px 0 0;display:flex;align-items:center;gap:8px}
.ll-aud-mem-h::after{content:'';flex:1;height:1px;background:var(--parch-edge)}
.ll-aud-mem{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px}
.ll-aud-mem li{display:grid;grid-template-columns:16px 1fr;gap:6px;font-style:italic;color:var(--ink);line-height:1.3}
.ll-aud-mem li svg{width:14px;height:14px;margin-top:3px}
.ll-aud-mem li.is-fond svg{color:var(--rubric)} .ll-aud-mem li.is-bitter svg{color:var(--ink-2)}
.ll-aud-mem-none{font-style:italic;color:var(--ink-3)}

/* the document: matter, transcript, your word */
.ll-aud-doc{position:relative;display:flex;flex-direction:column;min-height:0;min-width:0}
.ll-aud.is-entering .ll-aud-doc{animation:ll-aud-rise .65s .18s cubic-bezier(.2,.8,.2,1) both}
@keyframes ll-aud-rise{from{opacity:0;transform:translateY(22px)}}
.ll-aud-doc.is-thump{animation:ll-aud-shake .22s linear both}
@keyframes ll-aud-shake{0%{transform:translateY(0)}30%{transform:translateY(4px) rotate(-.15deg)}60%{transform:translateY(-1px)}100%{transform:none}}
.ll-aud-matter{display:grid;grid-template-columns:auto minmax(0,1fr) auto;column-gap:12px;row-gap:2px;align-items:start;padding:16px 22px 12px;border-bottom:1px solid var(--parch-edge);background:linear-gradient(180deg,rgba(158,43,37,.075),transparent)}
.ll-aud-cap{grid-row:1 / span 2;align-self:start;line-height:.8;margin-top:1px}
.ll-aud-cap>span{display:block;line-height:.86}
.ll-aud-title{font-family:var(--f-head);font-weight:400;font-size:var(--fs-xl);line-height:1.12;letter-spacing:.035em;color:var(--rubric);margin:2px 0 0;text-wrap:balance}
.ll-aud-herald{grid-column:2 / span 2;margin:3px 0 0;font-size:var(--fs-s);line-height:1.35;color:var(--ink-2);font-style:italic;text-wrap:pretty}
.ll-aud-timer{display:flex;flex-direction:column;align-items:flex-end;gap:3px;font-family:var(--f-head);font-size:var(--fs-xs);letter-spacing:.08em;color:var(--ink-2);white-space:nowrap;padding-top:5px}
.ll-aud-timer[hidden]{display:none}
.ll-aud-timer-row{display:flex;align-items:center;gap:5px}
.ll-aud-timer.is-soon{color:var(--rubric)}
.ll-aud-timer .ll-meter{width:84px;height:5px;min-width:0}
.ll-aud-scroll{position:relative;flex:1 1 0;min-height:72px;overflow-y:auto;padding:16px 24px 12px;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 14px);mask-image:linear-gradient(180deg,transparent 0,#000 14px);display:flex;flex-direction:column;gap:13px;scrollbar-width:thin;scrollbar-color:var(--parch-edge) transparent;overscroll-behavior:contain}
.ll-aud-doodle{position:absolute;right:16px;bottom:8px;opacity:.5;pointer-events:none;z-index:0;transition:opacity .6s}
.ll-aud-doodle.is-under{opacity:0}
.ll-aud-line{position:relative;z-index:1;max-width:90%;animation:ll-aud-line .3s both}
@keyframes ll-aud-line{from{opacity:0;transform:translateY(6px)}}
.ll-aud-by{display:block;font-family:var(--f-head);font-size:var(--fs-xs);letter-spacing:.12em;color:var(--rubric);margin-bottom:1px}
.ll-aud-line p{margin:0;font-size:var(--fs-l);line-height:1.36;color:var(--ink);text-wrap:pretty;user-select:text;-webkit-user-select:text}
.ll-aud-line.is-them{align-self:flex-start;padding-left:12px;border-left:2px solid rgba(158,43,37,.55)}
.ll-aud-line.is-typing{cursor:pointer}
.ll-aud-line.is-you{align-self:flex-end;text-align:right;padding-right:12px;border-right:2px solid rgba(47,74,122,.6)}
.ll-aud-line.is-you .ll-aud-by{color:var(--lapis)}
.ll-aud-line.is-you p{font-style:italic;color:var(--lapis);font-size:17px}
.ll-aud-line.is-steward{align-self:center;text-align:center;max-width:86%}
.ll-aud-line.is-steward p{font-size:var(--fs-s);font-style:italic;color:var(--ink-2)}
.ll-aud-line.is-usher{padding:0 0 2px}
.ll-aud-line.is-usher p{font-size:var(--fs-s);color:var(--ink-3);letter-spacing:.01em;text-wrap:balance}
.ll-aud-line.is-usher p::before,.ll-aud-line.is-usher p::after{content:'';display:inline-block;width:22px;height:1px;background:var(--parch-edge);vertical-align:middle;margin:0 10px}
.ll-aud-line.is-steward p b{font-family:var(--f-head);font-style:normal;font-weight:400;letter-spacing:.08em;color:var(--gold-ink)}
.ll-aud-dots{display:inline-flex;gap:7px;padding:9px 0 5px}
.ll-aud-dots i{width:7px;height:7px;border-radius:50% 46% 52% 48%;background:var(--ink-2);animation:ll-aud-dot 1.25s infinite both}
.ll-aud-dots i:nth-child(2){animation-delay:.18s} .ll-aud-dots i:nth-child(3){animation-delay:.36s}
@keyframes ll-aud-dot{0%,62%,100%{opacity:.22;transform:translateY(0)}30%{opacity:.95;transform:translateY(-3px)}}

/* the Steward's whispers: slips tucked into the margin of the document */
.ll-aud-whispers{position:absolute;left:calc(100% + 12px);bottom:10px;width:232px;display:flex;flex-direction:column;gap:10px;z-index:2}
.ll-aud-whispers[hidden]{display:none}
.ll-aud-whispers-cap{font-size:var(--fs-s);font-style:italic;color:#cdb98e;text-shadow:0 1px 3px #000;display:flex;align-items:center;gap:8px;line-height:1.25;margin:0 0 0 6px}
.ll-aud-whispers-cap b{display:block;font-family:var(--f-head);font-style:normal;font-weight:400;letter-spacing:.06em;color:var(--parch)}
.ll-aud-whispers-cap i{display:block}
.ll-aud-whisper{display:block;width:100%;text-align:left;padding:8px 12px 10px 14px;cursor:pointer;color:var(--ink);border:1px solid var(--parch-edge);border-radius:2px;
  background:linear-gradient(175deg,#f4ebd0,#e4d3a6);box-shadow:0 7px 16px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,252,240,.6);transform:rotate(-1.1deg);transform-origin:0 50%;transition:transform .16s,box-shadow .16s}
.ll-aud-whisper:nth-of-type(even){transform:rotate(.8deg)}
.ll-aud.is-entering .ll-aud-whisper{animation:ll-aud-slip .5s both}
.ll-aud.is-entering .ll-aud-whisper:nth-of-type(1){animation-delay:.9s} .ll-aud.is-entering .ll-aud-whisper:nth-of-type(2){animation-delay:1.02s} .ll-aud.is-entering .ll-aud-whisper:nth-of-type(3){animation-delay:1.14s} .ll-aud.is-entering .ll-aud-whisper:nth-of-type(4){animation-delay:1.26s}
@keyframes ll-aud-slip{from{opacity:0;translate:26px 0}}
.ll-aud-whisper:hover:not(:disabled),.ll-aud-whisper:focus-visible{transform:rotate(0) translateX(-5px);box-shadow:0 10px 22px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,252,240,.6)}
.ll-aud-whisper:active:not(:disabled){transform:translateX(-2px) translateY(1px)}
.ll-aud-whisper:disabled{opacity:.55;cursor:default}
.ll-aud-whisper b{display:block;font-family:var(--f-head);font-weight:400;font-size:var(--fs-xs);letter-spacing:.09em;color:var(--rubric);margin-bottom:2px}
.ll-aud-whisper span{display:block;font-size:var(--fs-s);line-height:1.3;font-style:italic}
.ll-aud-whispers.is-plain .ll-aud-whisper{border-left:4px solid var(--rubric)}
.ll-aud-whispers.is-plain .ll-aud-whisper b{font-size:var(--fs-s);color:var(--ink)}
.ll-aud-whispers.is-plain .ll-aud-whisper span{color:var(--ink-2)}

/* your word */
.ll-aud-word{border-top:1px solid var(--parch-edge);padding:10px 16px 12px;display:flex;flex-direction:column;gap:7px;background:linear-gradient(180deg,rgba(47,74,122,.075),rgba(47,74,122,.02))}
.ll-aud-word[hidden]{display:none}
.ll-aud-word-head{display:flex;align-items:baseline;gap:10px;min-width:0}
.ll-aud-word-label{font-family:var(--f-head);font-size:var(--fs-s);letter-spacing:.12em;color:var(--lapis);white-space:nowrap}
.ll-aud-word-note{font-size:var(--fs-xs);font-style:italic;color:var(--ink-2);min-width:0;line-height:1.3}
.ll-aud-word-note.is-warn{color:var(--rubric)}
.ll-aud-word-row{display:flex;align-items:flex-end;gap:10px}
.ll-aud-box{flex:1;resize:none;font-size:var(--fs-l);line-height:1.35;height:66px;font-style:italic;color:var(--lapis);background:rgba(255,251,238,.78);padding:8px 12px;user-select:text;-webkit-user-select:text;transition:border-color .12s,box-shadow .12s}
.ll-aud-box:focus{outline:none;border-color:var(--lapis);box-shadow:0 0 0 2px rgba(47,74,122,.22)}
.ll-aud-box.is-hearing{border-color:var(--gold-ink);box-shadow:0 0 0 2px rgba(201,162,39,.35)}
.ll-aud-box.is-filled{animation:ll-aud-filled .5s}
@keyframes ll-aud-filled{0%{background:rgba(227,192,90,.55)}100%{background:rgba(255,251,238,.78)}}
.ll-aud-box:disabled{opacity:.6}
.ll-aud-mic,.ll-aud-send{width:46px;height:46px;font-size:20px;touch-action:none}
.ll-aud-mic[hidden]{display:none}
.ll-aud-mic.is-on{animation:ll-aud-hear 1.1s ease-in-out infinite}
@keyframes ll-aud-hear{0%,100%{box-shadow:0 0 0 0 rgba(227,192,90,.7),0 1px 2px rgba(0,0,0,.5)}50%{box-shadow:0 0 0 9px rgba(227,192,90,0),0 1px 2px rgba(0,0,0,.5)}}
.ll-aud-send{background:radial-gradient(circle at 35% 30%,#5d7db5,var(--lapis) 55%,#1a2b4b)}
.ll-aud-send:disabled{filter:saturate(.3);opacity:.55;cursor:default}
.ll-aud-send.is-ready{animation:ll-aud-ready 1s ease-in-out 2}
@keyframes ll-aud-ready{50%{transform:scale(1.12)}}

/* the ruling */
.ll-aud-ruling{position:relative;border-top:1px solid var(--parch-edge);padding:16px 20px 16px 136px;min-height:136px;display:flex;flex-direction:column;gap:6px;background:linear-gradient(180deg,rgba(201,162,39,.16),rgba(201,162,39,.04));overflow:hidden auto;max-height:62%}
.ll-aud-ruling[hidden]{display:none}
.ll-aud-ruling .ll-wax{position:absolute;left:20px;top:16px;width:100px;height:100px;font-size:46px;transform:rotate(-8deg);animation:ll-aud-thump .5s cubic-bezier(.3,1.4,.5,1) both}
@keyframes ll-aud-thump{0%{transform:translateY(-90px) scale(2.4) rotate(-32deg);opacity:0}50%{transform:translateY(0) scale(.9) rotate(-9deg);opacity:1}72%{transform:scale(1.06) rotate(-7deg)}100%{transform:scale(1) rotate(-8deg)}}
.ll-aud-ruling .ll-wax::after{content:'';position:absolute;inset:6%;border-radius:50%;border:2px solid rgba(158,43,37,.5);animation:ll-aud-ring .7s .24s ease-out both;pointer-events:none}
@keyframes ll-aud-ring{from{transform:scale(.8);opacity:.9}to{transform:scale(1.9);opacity:0}}
.ll-aud-kicker{font-family:var(--f-head);font-size:var(--fs-s);letter-spacing:.14em;color:var(--rubric);animation:ll-aud-line .35s .34s both}
.ll-aud-result{margin:0;font-size:var(--fs-l);line-height:1.36;color:var(--ink);text-wrap:pretty;animation:ll-aud-line .4s .42s both}
.ll-aud-entries{list-style:none;margin:2px 0 0;padding:0;display:flex;flex-direction:column;gap:5px}
.ll-aud-entries li{display:grid;grid-template-columns:18px 1fr;gap:7px;font-size:var(--fs-s);line-height:1.35;color:var(--ink);animation:ll-aud-line .4s both}
.ll-aud-entries li .ll-icon{margin-top:2px;color:var(--gold-ink)}
.ll-aud-entries li b{font-family:var(--f-head);font-weight:400;letter-spacing:.07em;color:var(--gold-ink)}
.ll-aud-entries li em{color:var(--lapis)}
.ll-aud-entries li small{font-size:var(--fs-xs);color:var(--ink-2);font-style:italic}
.ll-aud-ruling-actions{display:flex;gap:var(--s-2);justify-content:flex-end;align-items:center;margin-top:6px;flex-wrap:wrap;animation:ll-aud-line .4s .7s both}
.ll-aud-ruling-actions .ll-btn-primary{font-size:var(--fs-m);padding:8px 20px}
.ll-aud-ruling.is-plain{padding-left:20px;min-height:0}

/* bottom bar */
.ll-aud-foot-right{margin-left:auto;display:flex;align-items:center;gap:var(--s-3);min-width:0}

/* ───────── audience, no room for a margin: the whispers come inside the document ───────── */
@container llaud (max-width: 1119px){
  .ll-aud-stage{grid-template-columns:minmax(230px,300px) minmax(0,660px)}
  .ll-aud-whispers{position:static;width:auto;flex-direction:row;align-items:stretch;gap:8px;overflow-x:auto;padding:8px 12px 10px;scrollbar-width:none;border-top:1px dotted var(--parch-edge);scroll-snap-type:x proximity;scroll-padding:0 12px}
  .ll-aud-wide{display:none}
  .ll-aud-whispers::-webkit-scrollbar{display:none}
  .ll-aud-whispers-cap{flex:0 0 76px;margin:0;color:var(--ink-2);text-shadow:none;font-size:var(--fs-xs);flex-direction:column;align-items:flex-start;gap:0;justify-content:center;scroll-snap-align:start}
  .ll-aud-whispers-cap b{color:var(--ink)}
  .ll-aud-whisper,.ll-aud-whisper:nth-of-type(even){flex:1 0 150px;transform:none;box-shadow:0 2px 5px rgba(42,29,20,.3);scroll-snap-align:start;padding:7px 10px 8px}
  .ll-aud-whisper:hover:not(:disabled),.ll-aud-whisper:focus-visible{transform:translateY(-1px)}
}
/* between a phone and a desk, with height to spare: the slips sit side by side, none off the page */
@container llaud (min-width: 761px) and (max-width: 1119px) and (min-height: 521px){
  .ll-aud-whispers{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));overflow:visible;gap:6px 8px;padding:7px 14px 10px}
  .ll-aud-whispers:has(.ll-aud-whisper:nth-of-type(4)){grid-template-columns:1fr 1fr}
  .ll-aud-whispers-cap{grid-column:1 / -1;flex-direction:row;align-items:baseline;gap:6px;font-size:var(--fs-s)}
  .ll-aud-whispers-cap b,.ll-aud-whispers-cap i{display:inline}
  .ll-aud-whispers-cap>span{display:flex;gap:6px;align-items:baseline}
}
/* ───────── audience, narrow (phones) ───────── */
@container llaud (max-width: 760px){
  .ll-aud .ll-lbx{min-height:44px;padding:0 var(--s-3);gap:var(--s-2)}
  .ll-aud .ll-lbx.is-bottom{display:none}
  .ll-aud .ll-lbx-dim{display:none}
  .ll-aud .ll-lbx{overflow:hidden}
  .ll-aud .ll-lbx:has(.ll-aud-queue:not([hidden])) .ll-lbx-kicker{display:none}
  .ll-aud .ll-lbx:has(.ll-aud-queue:not([hidden])) .ll-aud-queue{margin-left:0}
  .ll-aud .ll-lbx:has(.ll-aud-queue:not([hidden])) .ll-aud-leave-top{margin-left:auto}
  .ll-aud-queue-label{display:none}
  .ll-aud-leave-top{display:inline-block;padding:6px 10px;font-size:var(--fs-xs);margin-left:auto}
  .ll-aud-stage{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);gap:var(--s-2);padding:var(--s-2) var(--s-2) var(--s-2)}
  .ll-aud-who{flex-direction:row;align-items:center;gap:var(--s-3);padding:2px 6px 0;position:relative}
  .ll-aud-portrait{margin:0}
  .ll-aud-plate{background:none;border:0;box-shadow:none;text-align:left;padding:0;margin:0;min-width:0;flex:1;color:var(--parch)}
  .ll-aud-plate::before,.ll-aud-plate::after{display:none}
  .ll-aud-name{font-size:var(--fs-l);color:var(--gold-2);text-shadow:0 1px 3px #000}
  .ll-aud-desc{color:var(--parch-3);font-size:var(--fs-xs);text-shadow:0 1px 3px #000;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .ll-aud-mood{color:#b9a57c;margin-top:3px} .ll-aud-mood b{color:var(--parch)}
  .ll-aud-mood.is-warm b{color:#a9cf8c} .ll-aud-mood.is-cold b{color:#e79583}
  .ll-aud-facts-toggle{display:inline-block;margin-left:10px;font-family:var(--f-head);font-size:var(--fs-xs);letter-spacing:.08em;color:var(--gold-2);background:none;border:0;border-bottom:1px dotted var(--gold-2);padding:0 0 1px;cursor:pointer}
  .ll-aud-facts{display:none;position:absolute;left:4px;right:4px;top:100%;z-index:5;max-height:48cqh;margin-top:4px}
  .ll-aud-who.is-facts .ll-aud-facts{display:flex}
  .ll-aud-matter{padding:10px 14px 8px;column-gap:8px}
  .ll-aud-cap>svg{width:44px;height:44px}
  .ll-aud-line.is-usher{max-width:100%}
  .ll-aud-line.is-usher p::before,.ll-aud-line.is-usher p::after{display:none}
  .ll-aud-title{font-size:var(--fs-l)}
  .ll-aud-herald{font-size:var(--fs-xs);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .ll-aud-timer{padding-top:3px} .ll-aud-timer .ll-meter{width:56px}
  .ll-aud-scroll{padding:12px 14px 8px;gap:11px}
  .ll-aud-line p{font-size:17px} .ll-aud-line.is-you p{font-size:var(--fs-m)}
  .ll-aud-whisper,.ll-aud-whisper:nth-of-type(even){flex:0 0 min(66%,250px)}
  .ll-aud-word{padding:8px 10px 10px;gap:5px}
  .ll-aud-word-hint{display:none}
  .ll-aud-box{font-size:17px;height:58px;padding:7px 10px}
  .ll-aud-ruling{display:block;padding:12px 14px 14px 14px;max-height:70%;min-height:0}
  .ll-aud-ruling>*+*{margin-top:6px}
  .ll-aud-ruling .ll-wax{position:relative;left:auto;top:auto;float:left;width:72px;height:72px;font-size:34px;margin:0 12px 2px 0}
  .ll-aud-ruling .ll-aud-kicker{padding-top:4px;overflow:hidden}
  .ll-aud-ruling .ll-aud-result{overflow:hidden}
  .ll-aud-entries,.ll-aud-ruling-actions{clear:both}
  .ll-aud-result{font-size:17px}
}
@container llaud (max-height: 620px) and (min-width: 761px){
  .ll-aud-stage{padding:var(--s-3) var(--s-5)}
  .ll-aud .ll-lbx{min-height:40px}
}
/* a phone on its side: keep the talk, shed the trimmings */
@container llaud (max-height: 520px) and (min-width: 761px){
  .ll-aud .ll-lbx{min-height:36px}
  .ll-aud .ll-lbx.is-bottom{display:none}
  .ll-aud-leave-top{display:inline-block;padding:5px 10px;font-size:var(--fs-xs)}
  .ll-aud .ll-lbx:not(:has(.ll-aud-queue:not([hidden]))) .ll-aud-leave-top{margin-left:auto}
  .ll-aud-stage{padding:var(--s-2) var(--s-4);gap:var(--s-4)}
  .ll-aud-matter{padding:8px 16px 6px}
  .ll-aud-herald,.ll-aud-word-hint{display:none}
  .ll-aud-scroll{padding:10px 16px 8px}
  .ll-aud-word{padding:6px 12px 8px;gap:4px}
  .ll-aud-box{height:48px;font-size:17px}
  .ll-aud-whispers{padding:6px 12px 7px}
  .ll-aud-whisper,.ll-aud-whisper:nth-of-type(even){flex:0 0 228px;padding:5px 10px 6px}
  .ll-aud-whisper span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .ll-aud-title{font-size:var(--fs-l)}
  .ll-aud-ruling{max-height:78%}
}

/* ═════════════════════ the charter ═════════════════════ */
.ll-chr{position:absolute;inset:0;container-type:size;container-name:llchr;isolation:isolate;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr);place-items:center;padding:var(--s-3);overflow:hidden;
  background:radial-gradient(80% 70% at 50% 45%,rgba(14,10,8,.38),rgba(14,10,8,.84));animation:ll-aud-veil .4s both}
.ll-chr-doc{position:relative;width:min(1020px,100%);max-height:100%;display:flex;flex-direction:column;padding:26px 38px 20px;animation:ll-aud-rise .55s cubic-bezier(.2,.8,.2,1) both}
.ll-chr-close{position:absolute;right:28px;top:26px;z-index:2}
.ll-chr-body{min-height:0;overflow:auto;scrollbar-width:thin;scrollbar-color:var(--parch-edge) transparent;display:flex;flex-direction:column;gap:var(--s-3);padding:2px 4px}
.ll-chr-head{display:flex;align-items:center;gap:var(--s-4);padding:0 40px 0 6px}
.ll-chr-crest{align-self:center}
.ll-chr-headings{min-width:0;flex:1 1 auto}
.ll-chr-kicker{font-family:var(--f-head);font-size:var(--fs-s);letter-spacing:.2em;color:var(--gold-ink);margin:0}
.ll-chr-title{display:flex;align-items:flex-end;gap:5px;margin:2px 0 0;font-size:var(--fs-xl);font-weight:400;color:var(--ink);line-height:1}
.ll-chr-title .ll-art>span{display:block;line-height:.86}
.ll-chr-title-rest{font-family:var(--f-black);font-size:var(--fs-3xl);line-height:.95;letter-spacing:.01em}
.ll-chr-title-of{font-family:var(--f-head);font-size:var(--fs-xl);letter-spacing:.05em;color:var(--rubric);margin-left:10px;line-height:1.3;text-wrap:balance}
.ll-chr-sub{margin:4px 0 0;font-size:var(--fs-s);color:var(--ink-2);font-style:italic;text-wrap:balance}
.ll-chr-duty{flex:0 1 43%;min-width:0;margin:0;padding:8px 14px 9px 16px;border-left:3px solid var(--rubric);background:linear-gradient(90deg,rgba(158,43,37,.07),transparent 85%);font-size:18px;line-height:1.33;color:var(--ink);text-wrap:pretty}
.ll-chr-duty b{display:block;font-family:var(--f-head);font-weight:400;font-size:var(--fs-xs);letter-spacing:.16em;color:var(--rubric);margin-bottom:2px}
.ll-chr-flourish{display:block;align-self:stretch;margin:0 6px}
.ll-chr-flourish:empty{display:none}
.ll-chr-flourish>svg{margin:0 auto}
.ll-chr-flourish>hr{margin:2px 0}
.ll-chr-cols{display:grid;grid-template-columns:minmax(0,1.18fr) minmax(0,1fr);gap:var(--s-5);padding:2px 6px 0;align-items:stretch}
.ll-chr-col{display:flex;flex-direction:column;gap:var(--s-3);min-width:0}
.ll-chr-col+.ll-chr-col{padding-left:var(--s-5);border-left:1px solid var(--parch-edge)}
.ll-chr-h{font-family:var(--f-head);font-weight:400;font-size:var(--fs-l);letter-spacing:.05em;color:var(--rubric);margin:0;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.ll-chr-h small{font-family:var(--f-body);font-style:italic;font-size:var(--fs-s);letter-spacing:0;color:var(--ink-2)}
.ll-chr-goals{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:9px}
.ll-chr-goal{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 150px;gap:3px 12px;align-items:center;padding-right:46px}
.ll-chr-goal-text{grid-column:1 / -1;font-size:var(--fs-m);line-height:1.25;color:var(--ink)}
.ll-chr-goal .ll-meter{height:10px;border-radius:2px;background:rgba(42,29,20,.13);box-shadow:inset 0 1px 2px rgba(42,29,20,.35),0 0 0 1px rgba(138,116,90,.55)}
.ll-chr-goal .ll-meter>i{border-radius:1px;background:linear-gradient(180deg,#f0d57c,var(--gold) 55%,#a5831b);box-shadow:inset 0 1px 0 rgba(255,248,214,.7)}
.ll-chr-goal-num{font-size:var(--fs-s);color:var(--ink-2);font-variant-numeric:tabular-nums lining-nums;white-space:nowrap;text-align:right}
.ll-chr-goal-num b{font-weight:400;color:var(--ink);font-size:var(--fs-m)}
.ll-chr-goal.is-done .ll-chr-goal-text{color:var(--ink-2)}
.ll-chr-goal.is-done .ll-meter>i{background:linear-gradient(180deg,#86ad6a,var(--good) 60%,#375a27)}
.ll-chr-goal .ll-wax{position:absolute;right:0;top:50%;width:36px;height:36px;font-size:17px;margin-top:-18px;transform:rotate(-10deg)}
.ll-chr-goal-open{position:absolute;right:7px;top:50%;width:22px;height:22px;margin-top:-11px;border-radius:50%;border:1px dashed var(--ink-3);opacity:.6}
.ll-chr-tally{font-size:var(--fs-s);font-style:italic;color:var(--ink-2);margin:0}
.ll-chr-ready{display:flex;align-items:center;gap:var(--s-3);padding:10px 14px;border:1px solid var(--gold-ink);border-radius:var(--rad);background:linear-gradient(90deg,rgba(201,162,39,.24),rgba(201,162,39,.08));flex-wrap:wrap}
.ll-chr-ready[hidden]{display:none}
.ll-chr-ready p{margin:0;flex:1;min-width:160px;font-size:var(--fs-m);color:var(--ink)}
.ll-chr-brings{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}
.ll-chr-bring{display:grid;grid-template-columns:20px minmax(0,1fr);gap:0 9px;align-items:start;font-size:var(--fs-s);line-height:1.32;color:var(--ink);text-wrap:pretty}
.ll-chr-bring .ll-icon{margin-top:2px;color:var(--lapis);width:17px;height:17px}
.ll-chr-bring b{font-family:var(--f-head);font-weight:400;font-size:var(--fs-xs);letter-spacing:.12em;color:var(--rubric);margin-right:7px}
.ll-chr-bring .ll-meter{display:inline-block;width:84px;min-width:0;height:7px;vertical-align:1px;margin-right:8px}
.ll-chr-rival{display:flex;flex-direction:column;gap:6px;padding-top:var(--s-3);border-top:1px solid var(--parch-edge)}
.ll-chr-rival-name{margin:0;font-size:var(--fs-s);color:var(--ink-2);font-style:italic}
.ll-chr-rival-k{font-family:var(--f-head);font-style:normal;font-size:var(--fs-l);letter-spacing:.05em;color:var(--rubric);margin-right:10px}
.ll-chr-rival-name b{font-style:normal;font-weight:400;font-family:var(--f-head);letter-spacing:.04em;color:var(--ink);font-size:var(--fs-m)}
.ll-chr-tug{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px}
.ll-chr-tug-end{display:flex;flex-direction:column;align-items:center;gap:2px;font-family:var(--f-head);font-size:var(--fs-xs);letter-spacing:.08em;color:var(--ink-2);line-height:1.1;white-space:nowrap}
.ll-chr-tug-end b{font-weight:400;font-size:var(--fs-l);color:var(--ink);font-variant-numeric:tabular-nums lining-nums;letter-spacing:0;margin-left:2px}
.ll-chr-tug-end.is-you b{color:var(--lapis)} .ll-chr-tug-end.is-him b{color:var(--rubric)}
.ll-chr-rope{position:relative;height:44px}
.ll-chr-rope svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.ll-chr-knot{position:absolute;top:50%;width:0;height:0;transition:left .8s cubic-bezier(.3,1.3,.5,1)}
.ll-chr-knot::before{content:'';position:absolute;left:-7px;top:-9px;width:14px;height:18px;border-radius:4px;background:linear-gradient(180deg,#c5473d,var(--rubric-2));box-shadow:0 1px 2px rgba(0,0,0,.45)}
.ll-chr-knot::after{content:'';position:absolute;left:-5px;top:8px;width:10px;height:15px;background:linear-gradient(180deg,var(--rubric),#8c241f);clip-path:polygon(0 0,100% 0,100% 100%,50% 68%,0 100%);animation:ll-chr-sway 3.2s ease-in-out infinite;transform-origin:50% 0}
@keyframes ll-chr-sway{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}
.ll-chr-tug-cap{margin:0;font-size:var(--fs-s);line-height:1.35;color:var(--ink);text-wrap:pretty}
.ll-chr-tug-cap small{display:block;font-size:var(--fs-xs);font-style:italic;color:var(--ink-2);margin-top:2px}
.ll-chr-foot{display:flex;align-items:center;gap:var(--s-3);padding:10px 0 0;margin-top:auto;border-top:1px solid var(--parch-edge);min-height:54px}
.ll-chr-foot .ll-wax{width:48px;height:48px;font-size:23px;transform:rotate(7deg);margin:-4px 0 -6px}
.ll-chr-foot p{margin:0;flex:1;font-size:var(--fs-s);font-style:italic;color:var(--ink-2);text-wrap:pretty}
.ll-chr-foot .ll-art{opacity:.9;margin:-18px 0 -6px}

/* ───────── the ceremony ───────── */
.ll-chr.is-ceremony{padding:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;place-items:stretch;background:radial-gradient(85% 70% at 50% 46%,rgba(14,10,8,.14),rgba(14,10,8,.56) 68%,rgba(14,10,8,.86));-webkit-backdrop-filter:blur(2px) saturate(.9);backdrop-filter:blur(2px) saturate(.9)}
.ll-chr-cer{display:contents}
.ll-chr-cer[hidden]{display:none}
.ll-chr-cer-stage{min-height:0;display:grid;grid-template-columns:minmax(220px,300px) minmax(0,640px);grid-template-rows:minmax(0,1fr);gap:var(--s-6);justify-content:center;align-items:center;padding:var(--s-5)}
.ll-chr-cer-stage.is-kneel{animation:ll-chr-kneel .9s cubic-bezier(.3,.7,.3,1) both}
@keyframes ll-chr-kneel{0%{transform:none}38%{transform:translateY(16px)}100%{transform:none}}
.ll-chr-herald{display:flex;flex-direction:column;align-items:center;gap:var(--s-3);min-width:0;animation:ll-aud-arrive .7s .15s cubic-bezier(.2,.8,.2,1) both}
.ll-chr-herald .ll-aud-plate{margin-top:-16px}
.ll-chr-scroll{position:relative;color:var(--ink);padding:40px 46px 36px;border-radius:2px;display:flex;flex-direction:column;gap:var(--s-4);min-width:0;min-height:0;max-height:100%;animation:ll-chr-unroll .8s .25s cubic-bezier(.2,.8,.2,1) both;transform-origin:50% 0}
@keyframes ll-chr-unroll{from{opacity:0;clip-path:inset(0 0 100% 0)}to{opacity:1;clip-path:inset(-30px -30px -30px -30px)}}
.ll-chr-scroll::before,.ll-chr-scroll::after{content:'';position:absolute;left:-14px;right:-14px;height:20px;border-radius:10px;background:linear-gradient(180deg,#f3e8c8 0%,#d9c79c 35%,#a68f5e 78%,#8c7646 100%);box-shadow:0 5px 12px rgba(0,0,0,.5),inset 0 0 0 1px rgba(90,70,51,.4)}
.ll-chr-scroll::before{top:-10px} .ll-chr-scroll::after{bottom:-10px}
.ll-chr-scroll-kicker{font-family:var(--f-head);font-size:var(--fs-s);letter-spacing:.24em;color:var(--gold-ink);text-align:center;margin:0}
.ll-chr-procl{margin:0;font-size:28px;line-height:1.3;color:var(--ink);text-wrap:pretty;min-height:4.2em;cursor:pointer}
.ll-chr-reading{display:flex;flex-direction:column;gap:var(--s-5)}
.ll-chr-procl::first-letter{font-family:var(--f-black);font-size:2.5em;line-height:.8;float:left;padding:.08em .1em 0 0;color:var(--rubric)}
.ll-chr-cer-actions{display:flex;align-items:center;justify-content:center;gap:var(--s-3);flex-wrap:wrap;transition:opacity .4s}
.ll-chr-cer-actions.is-wait{opacity:0;pointer-events:none}
.ll-chr-kneel{font-size:var(--fs-l);padding:10px 34px;letter-spacing:.12em}
.ll-chr-reveal{position:relative;display:flex;flex-direction:column;align-items:center;gap:var(--s-2);text-align:center;isolation:isolate;min-height:0;flex:1 1 auto;overflow:hidden}
.ll-chr-reveal[hidden]{display:none}
.ll-chr-rays{position:absolute;left:50%;top:64px;width:560px;height:560px;margin:-280px 0 0 -280px;border-radius:50%;z-index:-1;pointer-events:none;
  background:repeating-conic-gradient(from 0deg,rgba(227,192,90,.34) 0deg 7deg,transparent 7deg 18deg);-webkit-mask-image:radial-gradient(closest-side,#000 8%,transparent 72%);mask-image:radial-gradient(closest-side,#000 8%,transparent 72%);animation:ll-chr-rays 26s linear infinite,ll-chr-rays-in 1.2s both}
@keyframes ll-chr-rays{to{transform:rotate(360deg)}}
@keyframes ll-chr-rays-in{from{opacity:0;scale:.4}}
.ll-chr-rise,.ll-chr-newtitle,.ll-chr-newsub{flex:none}
.ll-chr-rise{font-family:var(--f-head);font-size:var(--fs-s);letter-spacing:.24em;color:var(--gold-ink);margin:0;animation:ll-aud-line .5s .1s both}
.ll-chr-newtitle{margin:0;font-family:var(--f-black);font-weight:400;font-size:76px;line-height:1;color:var(--ink);
  background:linear-gradient(175deg,#8a6a12 8%,#e8c860 34%,#a8851c 52%,#f2dc8a 68%,#7a5e12 92%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 1px 0 rgba(42,29,20,.75)) drop-shadow(0 3px 6px rgba(42,29,20,.3));padding:4px 12px 8px;animation:ll-chr-title .9s .2s cubic-bezier(.2,1.4,.4,1) both}
@keyframes ll-chr-title{from{opacity:0;transform:scale(.6)}}
.ll-chr-newsub{margin:0;font-family:var(--f-head);font-size:var(--fs-l);letter-spacing:.06em;color:var(--rubric);animation:ll-aud-line .5s .7s both;text-wrap:balance}
.ll-chr-unlocks{list-style:none;margin:var(--s-2) 0 0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:8px 22px;text-align:left;width:100%;min-height:0;flex:0 1 auto;overflow-y:auto;scrollbar-width:thin}
.ll-chr-unlocks li{display:grid;grid-template-columns:22px minmax(0,1fr);gap:1px 9px;align-content:start;animation:ll-aud-line .45s both}
.ll-chr-unlocks li .ll-icon{grid-row:1 / span 2;margin-top:3px;color:var(--lapis);width:18px;height:18px}
.ll-chr-unlocks li b{font-family:var(--f-head);font-weight:400;font-size:var(--fs-xs);letter-spacing:.12em;color:var(--ink-2)}
.ll-chr-unlocks li span{font-size:var(--fs-s);line-height:1.3;color:var(--ink);text-wrap:pretty}
.ll-chr-reveal .ll-btn-primary{flex:none;margin-top:var(--s-3);font-size:var(--fs-l);padding:9px 34px;letter-spacing:.12em;animation:ll-aud-line .5s 1.5s both}

/* ───────── charter, narrow ───────── */
@container llchr (max-width: 760px){
  .ll-chr{padding:var(--s-2)}
  .ll-chr-doc{padding:26px 20px 20px}
  .ll-chr-close{right:22px;top:22px}
  .ll-chr-head{padding:0 2px;gap:var(--s-3);flex-direction:column;align-items:stretch}
  .ll-chr-headings{padding-right:38px}
  .ll-chr-crest{display:none}
  .ll-chr-title{flex-wrap:wrap}
  .ll-chr-title-rest{font-size:44px}
  .ll-chr-title-of{font-size:var(--fs-l);margin-left:0;flex-basis:100%}
  .ll-chr-duty{flex:none;font-size:var(--fs-m);padding:8px 12px}
  .ll-chr-cols{grid-template-columns:minmax(0,1fr);padding:2px 2px 0;gap:var(--s-4)}
  .ll-chr-col+.ll-chr-col{padding-left:0;border-left:0;padding-top:var(--s-4);border-top:1px solid var(--parch-edge)}
  .ll-chr-goal{grid-template-columns:minmax(0,1fr)}
  .ll-chr-goal-num{text-align:left}
  .ll-chr-foot .ll-art{display:none}
  .ll-chr.is-ceremony{padding:0}
  .ll-chr.is-ceremony .ll-lbx{min-height:40px;padding:0 var(--s-3)}
  .ll-chr.is-ceremony .ll-lbx-dim{display:none}
  .ll-chr-cer-stage{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);gap:var(--s-4);padding:var(--s-3) var(--s-4) var(--s-4);align-items:start}
  .ll-chr-herald{flex-direction:row;gap:var(--s-3);justify-content:center}
  .ll-chr-cer-stage.is-risen{grid-template-rows:minmax(0,1fr)}
  .ll-chr-cer-stage.is-risen .ll-chr-herald{display:none}
  .ll-chr-herald .ll-aud-plate{margin:0;min-width:0;padding:6px 16px 8px}
  .ll-chr-herald .ll-aud-name{font-size:var(--fs-l)}
  .ll-chr-scroll{padding:26px 20px 22px;margin:0 8px}
  .ll-chr-procl{font-size:21px}
  .ll-chr-newtitle{font-size:56px}
  .ll-chr-unlocks{grid-template-columns:1fr;gap:6px}
  .ll-chr-newsub{font-size:var(--fs-m)}
  .ll-chr-rays{width:420px;height:420px;margin:-210px 0 0 -210px}
}
`;
