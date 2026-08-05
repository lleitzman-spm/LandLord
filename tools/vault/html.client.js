/*
 * The Great Book's client — inlined whole into the render by html.mjs.
 *
 * Everything here runs from one file on file://, under the page's own strict
 * CSP. No fetch, no import, no worker, no eval: the data arrives as JSON in a
 * script tag, the page bodies as inert <template> elements, and this script
 * wires the three together into a reader.
 *
 * The moving parts, honestly listed:
 *   router    — #page-id opens a page; #browse filters the shelves;
 *               #fact:x opens the ledger at that row; #slug alone scrolls
 *               within the open page (heading anchors share the hash).
 *   search    — an inverted word index built once, on idle, from the corpus
 *               the renderer embedded. Typing never touches the DOM of the
 *               pages; at a few thousand pages the index answers in
 *               milliseconds where a DOM scan would take seconds.
 *   graph     — the local neighbourhood of the open page, one or two hops,
 *               drawn as inline SVG. Deliberately NOT a global force layout:
 *               at this size that is a hairball, and a hairball misleads.
 *   theme     — follows the system until the reader chooses; the choice is
 *               kept in localStorage where file:// allows it, and forgotten
 *               without complaint where it does not.
 *   keys      — / search · j k move · enter open · esc close · g then a
 *               letter to jump. A reader's hands need never leave the keys.
 *
 * Honest limits: results cap at 40; the graph caps its neighbours rather
 * than drawing a thicket; and 'g' chords wait 900ms before giving up on the
 * second key.
 */
(function () {
  'use strict';

  const data = JSON.parse(document.getElementById('book-data').textContent);
  const P = data.pages;
  const byId = new Map(P.map((p, i) => [p.id, i]));
  const templates = new Map();
  document.querySelectorAll('template[data-page]').forEach((t) => templates.set(t.dataset.page, t));

  const root = document.getElementById('page-root');
  const navLinks = document.getElementById('nav-links');

  // incoming edges, computed once from the outgoing graph
  const incoming = P.map(() => []);
  data.graph.forEach((outs, i) => outs.forEach((t) => { if (incoming[t]) incoming[t].push(i); }));

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const KNOWN = new Set(data.standings);
  const chip = (s) => `<span class="chip ${KNOWN.has(s) ? 's-' + s : s ? 's-other' : 's-none'}">${esc(s || 'unmarked')}</span>`;

  // ── theme ─────────────────────────────────────────────────────────────
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* file:// may refuse; the theme just won't persist */ } },
  };
  const themeName = document.getElementById('theme-name');
  const THEMES = ['auto', 'light', 'dark'];
  let theme = THEMES.includes(store.get('book-theme')) ? store.get('book-theme') : 'auto';
  const applyTheme = () => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    themeName.textContent = theme;
  };
  document.getElementById('theme-toggle').addEventListener('click', () => {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    store.set('book-theme', theme);
    applyTheme();
  });
  applyTheme();

  // ── the spine nav ─────────────────────────────────────────────────────
  const typeCounts = new Map();
  P.forEach((p) => { if (!p.synthetic) typeCounts.set(p.type, (typeCounts.get(p.type) || 0) + 1); });
  const navParts = [
    `<a href="#home" data-nav="home">The Spine</a>`,
    data.startId ? `<a href="#${encodeURIComponent(data.startId)}" data-nav="${esc(data.startId)}">Start Here</a>` : '',
    `<a href="#browse" data-nav="browse">Browse All <span class="nav-count">${typeCounts.size ? [...typeCounts.values()].reduce((a, b) => a + b, 0) : 0}</span></a>`,
    `<a href="#facts-ledger" data-nav="facts-ledger">The Ledger <span class="nav-count">${data.factRows.length}</span></a>`,
    `<div class="nav-head">Shelves</div>`,
    ...[...typeCounts.keys()].sort().map((t) =>
      `<a href="#browse:type=${encodeURIComponent(t)}" data-nav="type:${esc(t)}">${esc(t)} <span class="nav-count">${typeCounts.get(t)}</span></a>`),
  ];
  navLinks.innerHTML = navParts.join('');
  const markNav = (key) => {
    navLinks.querySelectorAll('a').forEach((a) => a.classList.toggle('here', a.dataset.nav === key));
  };

  // ── page chrome ───────────────────────────────────────────────────────
  const BANNERS = {
    proposed: '<strong>Proposed</strong> — a design, not a build. May never be cited as evidence that something works.',
    contested: '<strong>Contested</strong> — sources disagree and no decision has been made. Cite neither side as settled.',
    retired: '<strong>Retired</strong> — superseded, kept for history. Never cite as current.',
    settled: '<strong>Settled</strong> — decided by Edwin. Closed: not to be reopened as a question, a contradiction, or a recommendation.',
  };

  function showPage(id, anchor) {
    const idx = byId.get(id);
    const tpl = templates.get(id);
    if (idx === undefined || !tpl) return showLost(id);
    const p = P[idx];

    root.innerHTML = '';
    const frag = tpl.content.cloneNode(true);

    // the body's own leading H1 is the title; lift it out so it is set once,
    // above the standing banner, not below it
    let titleText = p.title;
    const firstEl = frag.firstElementChild;
    if (firstEl && firstEl.tagName === 'H1') { titleText = firstEl.textContent; firstEl.remove(); }

    const head = document.createElement('div');
    const isHome = id === 'home';
    head.innerHTML =
      (isHome ? '' : `<div class="page-kicker">${esc(p.type)} ${p.synthetic ? '' : chip(p.standing)}</div>`) +
      `<h1 class="page-title">${esc(titleText)}</h1>` +
      (isHome ? `<div class="page-kicker" style="margin-top:6px">${esc(data.subtitle)} · rendered ${esc(data.generated.slice(0, 10))}</div>` : '') +
      `<hr class="page-title-rule">` +
      (BANNERS[p.standing] ? `<div class="standing-banner s-${p.standing}">${BANNERS[p.standing]}</div>` : '');
    root.appendChild(head);

    const prose = document.createElement('div');
    prose.className = 'prose';
    prose.appendChild(frag);
    root.appendChild(prose);

    // backlinks and the local graph — every page shows both roads
    if (!isHome) {
      const app = document.createElement('div');
      app.className = 'page-appendix';
      const backs = incoming[idx] || [];
      app.innerHTML =
        `<div class="backlinks"><h2>Cited by</h2>` +
        (backs.length
          ? `<ul>${backs.map((b) => `<li><a class="wl" href="#${encodeURIComponent(P[b].id)}">${esc(P[b].title)}</a> ${P[b].synthetic ? '' : chip(P[b].standing)}</li>`).join('')}</ul>`
          : `<div class="none">Nothing yet cites this page.</div>`) +
        `</div><div class="local-graph"><h2>The neighbourhood</h2></div>`;
      const g = buildGraph(idx);
      if (g) app.querySelector('.local-graph').appendChild(g);
      else app.querySelector('.local-graph').innerHTML += '<div class="none" style="font:italic 14px var(--serif);color:var(--ink-faint)">This page stands alone — no links in, none out.</div>';
      root.appendChild(app);
    }

    // the footer names the source: the page is a view, the source is the law
    if (!isHome) {
      const foot = document.createElement('div');
      foot.className = 'page-foot';
      foot.innerHTML =
        `This page is a view, not a source — it is overwritten on every render.` +
        (p.source ? ` To change it, edit <span class="path-ref">${esc(p.source)}</span> and re-emit.` : '') +
        (p.generated ? `<br>Generated ${esc(p.generated)}.` : '');
      root.appendChild(foot);
    }

    markNav(id === 'home' ? 'home' : id === data.startId ? id : id === 'facts-ledger' ? 'facts-ledger' : 'type:' + p.type);
    settle(anchor);
  }

  function settle(anchor) {
    if (anchor) {
      const el = root.querySelector('#' + (window.CSS && CSS.escape ? CSS.escape(anchor) : anchor));
      if (el) { el.scrollIntoView(); return; }
    }
    window.scrollTo(0, 0);
  }

  function showLost(id) {
    const q = id.toLowerCase();
    const near = P.filter((p) => !p.synthetic && (p.id.toLowerCase().includes(q) || p.title.toLowerCase().includes(q))).slice(0, 8);
    root.innerHTML =
      `<div class="page-kicker">nowhere</div><h1 class="page-title">No page answers to “${esc(id)}”</h1><hr class="page-title-rule">` +
      `<p class="lost-note">The road ends here. ${near.length ? 'These pages answer to something like it:' : 'Try the search — press <kbd>/</kbd>.'}</p>` +
      (near.length ? `<ul class="spine-list">${near.map((p) => `<li class="spine-row"><a class="wl" href="#${encodeURIComponent(p.id)}">${esc(p.title)}</a> ${chip(p.standing)}</li>`).join('')}</ul>` : '');
    markNav('');
    window.scrollTo(0, 0);
  }

  // ── browse: the shelves, filterable in one click ──────────────────────
  const filters = { type: new Set(), standing: new Set() };
  function showBrowse(preset) {
    filters.type.clear(); filters.standing.clear();
    if (preset) {
      preset.split('&').forEach((kv) => {
        const [k, v] = kv.split('=').map(decodeURIComponent);
        if (k === 'type') filters.type.add(v);
        if (k === 'standing') filters.standing.add(v);
      });
    }
    root.innerHTML =
      `<div class="page-kicker">every shelf</div><h1 class="page-title">Browse the Book</h1><hr class="page-title-rule">` +
      `<div class="browse-controls">
         <div class="chip-row" data-axis="type"><span class="chip-row-label">Type</span></div>
         <div class="chip-row" data-axis="standing"><span class="chip-row-label">Standing</span></div>
       </div>
       <div class="browse-count" id="browse-count"></div><ul class="page-list" id="browse-list"></ul>`;

    const standings = [...new Set(P.filter((p) => !p.synthetic).map((p) => p.standing || ''))]
      .sort((a, b) => (data.standings.indexOf(a) + 1 || 99) - (data.standings.indexOf(b) + 1 || 99));
    const fill = (axis, values) => {
      const row = root.querySelector(`.chip-row[data-axis="${axis}"]`);
      values.forEach((v) => {
        const b = document.createElement('button');
        b.className = 'filter-chip' + (filters[axis].has(v) ? ' on' : '');
        b.textContent = v || 'unmarked';
        b.addEventListener('click', () => {
          filters[axis].has(v) ? filters[axis].delete(v) : filters[axis].add(v);
          b.classList.toggle('on');
          renderList();
        });
        row.appendChild(b);
      });
    };
    fill('type', [...typeCounts.keys()].sort());
    fill('standing', standings);

    const renderList = () => {
      const hits = P.map((p, i) => ({ p, i })).filter(({ p }) => !p.synthetic
        && (!filters.type.size || filters.type.has(p.type))
        && (!filters.standing.size || filters.standing.has(p.standing || '')));
      document.getElementById('browse-count').textContent =
        `${hits.length} page${hits.length === 1 ? '' : 's'}` +
        (filters.type.size || filters.standing.size ? ' under this filter' : ' in the Book');
      document.getElementById('browse-list').innerHTML = hits.map(({ p }) =>
        `<li class="page-row"><span class="row-type">${esc(p.type)}</span><a class="wl" href="#${encodeURIComponent(p.id)}">${esc(p.title)}</a>${chip(p.standing)}</li>`).join('');
    };
    renderList();
    markNav(filters.type.size === 1 && !filters.standing.size ? 'type:' + [...filters.type][0] : 'browse');
    window.scrollTo(0, 0);
  }

  // ── router ────────────────────────────────────────────────────────────
  function route() {
    let h = location.hash.replace(/^#/, '');
    try { h = decodeURIComponent(h); } catch { /* a malformed escape is just a name */ }
    if (!h || h === 'home') return showPage('home');
    if (h === 'browse') return showBrowse('');
    if (h.startsWith('browse:')) return showBrowse(h.slice(7));
    // a real page id always wins the hash — even one that begins "fact:",
    // which an emitter is free to mint (html-check caught exactly that)
    if (byId.has(h)) return showPage(h);
    // #id@anchor deep-links a section of a page; a lone #slug that names an
    // element of the OPEN page just scrolls to it (heading anchors share the hash)
    const at = h.lastIndexOf('@');
    if (at > 0) {
      const id = h.slice(0, at);
      if (byId.has(id)) return showPage(id, h.slice(at + 1));
    }
    if (h.startsWith('fact:')) return showFact(h);
    const el = root.querySelector('#' + (window.CSS && CSS.escape ? CSS.escape(h) : h));
    if (el) return el.scrollIntoView();
    showLost(h);
  }

  function showFact(factId) {
    showPage('facts-ledger');
    const row = root.querySelector(`tr[data-fact="${factId.replace(/"/g, '')}"]`);
    if (row) {
      row.classList.add('fact-lit');
      row.scrollIntoView({ block: 'center' });
      setTimeout(() => row.classList.remove('fact-lit'), 2000);
    }
  }

  window.addEventListener('hashchange', route);

  // ── search: an inverted index, built once, never a DOM scan ───────────
  // token → Set(page index), over titles and full text. Built on idle so
  // opening the Book costs nothing; the first keystroke forces it if idle
  // never came.
  let index = null;
  const lowTitles = P.map((p) => p.title.toLowerCase());
  const lowText = data.corpus.map((t) => (t || '').toLowerCase());
  function buildIndex() {
    if (index) return;
    index = new Map();
    const add = (tok, i) => {
      let s = index.get(tok);
      if (!s) index.set(tok, s = new Set());
      s.add(i);
    };
    for (let i = 0; i < P.length; i++) {
      const words = (lowTitles[i] + ' ' + lowText[i]).split(/[^a-z0-9:]+/);
      for (const w of words) if (w.length > 1) add(w, i);
    }
  }
  (window.requestIdleCallback || ((f) => setTimeout(f, 300)))(buildIndex);

  function search(query) {
    buildIndex();
    const toks = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    if (!toks.length) return [];
    // candidates per token: every indexed word the token prefixes; falls
    // back to a full substring sweep when the index offers nothing
    const candSets = toks.map((tok) => {
      const set = new Set();
      for (const [word, pages] of index) if (word.startsWith(tok)) pages.forEach((p) => set.add(p));
      if (!set.size) for (let i = 0; i < P.length; i++) if (lowText[i].includes(tok) || lowTitles[i].includes(tok)) set.add(i);
      return set;
    });
    // AND semantics: every token must land somewhere on the page
    let cands = candSets[0];
    for (let s = 1; s < candSets.length; s++) cands = new Set([...cands].filter((i) => candSets[s].has(i)));

    const scored = [];
    for (const i of cands) {
      let score = 0;
      for (const tok of toks) {
        const ti = lowTitles[i].indexOf(tok);
        if (lowTitles[i] === tok) score += 120;
        else if (ti === 0) score += 60;
        else if (ti > 0) score += 30;
        const xi = lowText[i].indexOf(tok);
        if (xi >= 0) {
          score += 10;
          // shallow count of further hits, capped: relevance, not exhaustion
          let n = 0, at = xi;
          while (n < 5 && (at = lowText[i].indexOf(tok, at + tok.length)) !== -1) n++;
          score += n * 2;
        }
        if (P[i].id.toLowerCase().includes(tok)) score += 25;
      }
      if (score > 0) scored.push({ i, score });
    }
    scored.sort((a, b) => b.score - a.score || lowTitles[a.i].localeCompare(lowTitles[b.i]));
    return scored.slice(0, 40).map(({ i, score }) => ({ id: P[i].id, title: P[i].title, score, idx: i }));
  }

  // ── search UI ─────────────────────────────────────────────────────────
  const layer = document.getElementById('search-layer');
  const input = document.getElementById('search-input');
  const resultsEl = document.getElementById('search-results');
  let results = [];
  let sel = 0;
  let listMode = false; // j/k walk the results once the reader arrows out of the input

  const snippet = (idx, tok) => {
    const t = data.corpus[idx] || '';
    const at = t.toLowerCase().indexOf(tok);
    if (at < 0) return '';
    const from = Math.max(0, at - 50);
    const raw = (from > 0 ? '…' : '') + t.slice(from, at + tok.length + 70).replace(/\s+/g, ' ') + '…';
    return esc(raw).replace(new RegExp('(' + tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
  };

  function renderResults() {
    const tok = input.value.trim().toLowerCase().split(/\s+/)[0] || '';
    resultsEl.innerHTML = results.length
      ? results.map((r, n) =>
        `<div class="sr${n === sel ? ' sel' : ''}" data-n="${n}">
           <div class="sr-title">${esc(r.title)} <span class="sr-type">${esc(P[r.idx].type)}</span> ${P[r.idx].synthetic ? '' : chip(P[r.idx].standing)}</div>
           <div class="sr-snip">${snippet(r.idx, tok)}</div>
         </div>`).join('')
      : (input.value.trim() ? '<div class="search-empty">Nothing in the Book answers to that.</div>' : '');
    const cur = resultsEl.querySelector('.sr.sel');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }

  function openSearch() {
    layer.hidden = false;
    listMode = false;
    input.value = '';
    results = [];
    renderResults();
    input.focus();
  }
  function closeSearch() { layer.hidden = true; }
  function openSel() {
    const r = results[sel];
    if (!r) return;
    closeSearch();
    location.hash = '#' + encodeURIComponent(r.id);
  }

  document.getElementById('search-open').addEventListener('click', openSearch);
  layer.addEventListener('mousedown', (e) => { if (e.target === layer) closeSearch(); });
  resultsEl.addEventListener('click', (e) => {
    const row = e.target.closest('.sr');
    if (row) { sel = +row.dataset.n; openSel(); }
  });
  input.addEventListener('input', () => {
    results = search(input.value);
    sel = 0;
    renderResults();
  });

  layer.addEventListener('keydown', (e) => {
    const move = (d) => {
      if (!results.length) return;
      sel = (sel + d + results.length) % results.length;
      renderResults();
      e.preventDefault();
    };
    if (e.key === 'Escape') { closeSearch(); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { listMode = true; input.blur(); move(1); }
    else if (e.key === 'ArrowUp') { listMode = true; input.blur(); move(-1); }
    else if (e.key === 'Enter') { openSel(); e.preventDefault(); }
    else if (listMode && (e.key === 'j' || e.key === 'k')) move(e.key === 'j' ? 1 : -1);
    else if (listMode && e.key.length === 1 && !e.ctrlKey && !e.metaKey) { listMode = false; input.focus(); }
  });

  // ── global keys ───────────────────────────────────────────────────────
  // g-then-a-letter jumps; the chord forgets itself after 900ms
  const GOES = {
    h: '#home', b: '#browse', f: '#facts-ledger',
    l: '#browse:type=law', w: '#browse:type=writ', m: '#browse:type=module',
    c: '#browse:standing=contested', p: '#browse:standing=proposed',
    s: data.startId ? '#' + encodeURIComponent(data.startId) : '#home',
  };
  let chord = null;
  document.addEventListener('keydown', (e) => {
    if (!layer.hidden) return; // the search owns its keys
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (chord && GOES[e.key]) { location.hash = GOES[e.key]; chord = null; e.preventDefault(); return; }
    chord = null;
    if (e.key === '/') { openSearch(); e.preventDefault(); }
    else if (e.key === 'g') { chord = setTimeout(() => { chord = null; }, 900); }
  });

  // ── the local graph: one page's neighbourhood, drawn honestly ─────────
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs) => {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  };
  const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  function buildGraph(idx) {
    const outs = (data.graph[idx] || []).filter((t) => t !== idx);
    const ins = (incoming[idx] || []).filter((t) => t !== idx && !outs.includes(t));
    if (!outs.length && !ins.length) return null;

    const CAP = 9; // per side; beyond this a count says what was left out
    const right = outs.slice(0, CAP), left = ins.slice(0, CAP);
    const moreR = outs.length - right.length, moreL = ins.length - left.length;

    // a second hop only when the first is sparse enough to stay readable
    const hop2 = [];
    if (right.length + left.length <= 6) {
      const seen = new Set([idx, ...right, ...left]);
      for (const n of [...right, ...left]) {
        for (const nn of (data.graph[n] || [])) {
          if (!seen.has(nn) && hop2.length < 8) { seen.add(nn); hop2.push({ from: n, to: nn }); }
        }
      }
    }

    const W = 640, H = 300, cx = W / 2, cy = H / 2;
    const svg = mk('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Pages linked to and from this one' });
    // every node is clamped into the frame — a label walking off the edge
    // is a label that might as well not exist
    const clamp = (x, y) => [Math.max(46, Math.min(W - 46, x)), Math.max(22, Math.min(H - 34, y))];
    const pos = new Map([[idx, [cx, cy]]]);
    const place = (list, side) => {
      const rx = 175, ry = 100;
      list.forEach((n, k) => {
        const a = (k + 1) / (list.length + 1) * Math.PI - Math.PI / 2; // -90°..+90°
        pos.set(n, clamp(cx + side * rx * Math.cos(a * 0.9), cy + ry * Math.sin(a) * 1.6));
      });
    };
    place(right, 1);
    place(left, -1);
    // second-hop nodes stack VERTICALLY under their parent. Labels are
    // horizontal, so any horizontal offset lands one label on another;
    // a vertical string of kin reads cleanly and stays in the frame.
    const kids = new Map();
    hop2.forEach(({ from, to }) => {
      const [fx, fy] = pos.get(from);
      const n = (kids.get(from) || 0) + 1;
      kids.set(from, n);
      const off = (Math.ceil(n / 2) * 42) * (n % 2 ? 1 : -1);
      pos.set(to, clamp(fx, fy + off));
    });

    const line = (a, b, cls) => {
      const [x1, y1] = pos.get(a), [x2, y2] = pos.get(b);
      svg.appendChild(mk('line', { x1, y1, x2, y2, class: cls }));
    };
    right.forEach((n) => line(idx, n, 'gedge'));
    left.forEach((n) => line(n, idx, 'gedge in'));
    hop2.forEach(({ from, to }) => line(from, to, 'gedge'));

    const node = (n, hub, far) => {
      const [x, y] = pos.get(n);
      const p = P[n];
      const g = mk('g', { class: 'gnode' + (hub ? ' hub' : '') + (far ? ' far' : ''), transform: `translate(${x},${y})` });
      const dot = KNOWN.has(p.standing) ? 'dot-' + p.standing : 'dot-none';
      g.appendChild(mk('circle', { r: hub ? 7 : 5, class: hub ? '' : dot }));
      // labels point away from the hub, but flip inward near the frame's
      // edge so the far column's names stay readable
      let anchor = x > cx + 10 ? 'start' : x < cx - 10 ? 'end' : 'middle';
      if (anchor === 'start' && x > W - 150) anchor = 'end';
      else if (anchor === 'end' && x < 150) anchor = 'start';
      const tx = anchor === 'start' ? 10 : anchor === 'end' ? -10 : 0;
      const t = mk('text', { x: tx, y: hub ? -12 : 4, 'text-anchor': anchor });
      t.textContent = trunc(p.title, hub ? 34 : 22);
      g.appendChild(t);
      g.addEventListener('click', () => { location.hash = '#' + encodeURIComponent(p.id); });
      svg.appendChild(g);
    };
    hop2.forEach(({ to }) => node(to, false, true));
    left.forEach((n) => node(n, false, false));
    right.forEach((n) => node(n, false, false));
    node(idx, true, false);

    const leg = mk('text', { x: 10, y: H - 10, class: 'gleg' });
    leg.textContent = 'solid — this page links out · dashed — linked from'
      + (moreR > 0 ? ` · +${moreR} more out` : '') + (moreL > 0 ? ` · +${moreL} more in` : '');
    svg.appendChild(leg);
    return svg;
  }

  // ── the verifier's handle, then the first route ───────────────────────
  window.__book = { data, search, go: (id) => { location.hash = '#' + encodeURIComponent(id); } };
  route();
  window.__BOOK_READY__ = true;
})();
