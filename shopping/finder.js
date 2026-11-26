/*
  Shared product finder for /shopping/<marketplace>/ pages.
  Each page loads its own products.js (window.PRODUCTS), then this file.
  The buy-button text comes from <body data-buy-label="...">.
  Expects elements: #q #clear #searchWrap #chips #meta #grid #empty #reset
*/
(function(){
  const PRODUCTS = (window.PRODUCTS || []).map(p => {
    const tags = (Array.isArray(p.tags) ? p.tags : [p.tags]).filter(Boolean)
      .filter(t => t !== p.category);
    return {
      ...p,
      tags,
      groups: [p.category, ...tags].filter(Boolean),   // every tab this product appears under
      codeNum: parseInt(String(p.code).replace(/\D/g,''), 10),
      priceNum: toPrice(p.price),
      hot: p.hot === true || p.hot === 'yes' || p.hot === 1,
      hay: norm([p.name, p.category, ...tags, p.keywords].filter(Boolean).join(' ')).split(' ')
    };
  });
  const PH = '<div class="ph" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg></div>';

  // "12.9", 12.9, "RM12.90", "RM 1,299" -> number; anything else -> NaN (no price)
  function toPrice(v){
    if (v === undefined || v === null || v === '') return NaN;
    return parseFloat(String(v).replace(/[^0-9.]/g, ''));
  }

  const $ = id => document.getElementById(id);
  const input = $('q'), grid = $('grid'), chips = $('chips'), meta = $('meta'),
        empty = $('empty'), clearBtn = $('clear');
  let activeCat = 'All';
  let sortBy = 'default';   // default | code-asc | price-asc | price-desc | name
  let hotOnly = false;
  let shown = false;        // false while the loading boxes are on screen
  const HAS_PRICE = PRODUCTS.some(p => !isNaN(p.priceNum));
  const HAS_HOT = PRODUCTS.some(p => p.hot);
  window.__PH = PH;

  function norm(s){
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9]+/g,' ').trim();
  }
  const pad = n => isNaN(n) ? '' : String(n).padStart(3,'0');
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const BUY_LABEL = esc(document.body.dataset.buyLabel || 'Shop now');

  // Levenshtein distance capped at 2 (for typo tolerance)
  function near(a, b){
    if (Math.abs(a.length - b.length) > 1) return false;
    let prev = Array.from({length: b.length + 1}, (_, i) => i);
    for (let i = 1; i <= a.length; i++){
      const cur = [i];
      for (let j = 1; j <= b.length; j++){
        cur[j] = Math.min(prev[j] + 1, cur[j-1] + 1, prev[j-1] + (a[i-1] === b[j-1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length] <= 1;
  }

  // Score one search word against a product; 0 = no match
  function scoreToken(p, t){
    if (/^\d+$/.test(t)){
      const n = parseInt(t, 10);
      if (p.codeNum === n) return 100;
      if (String(p.codeNum).startsWith(String(n)) || pad(p.codeNum).startsWith(t)) return 40;
    }
    let best = 0;
    for (const w of p.hay){
      if (w === t) return 12;
      if (w.startsWith(t)) best = Math.max(best, 8);
      else if (t.length >= 3 && w.includes(t)) best = Math.max(best, 5);
      else if (t.length >= 4 && near(t, w)) best = Math.max(best, 3);
    }
    return best;
  }

  function search(q){
    // "#12", "code 12", "kod 12", "no. 12" -> "12"
    const tokens = norm(q.replace(/#/g,' ')).split(' ')
      .filter(t => t && !['code','kod','no','number','nombor'].includes(t));
    let list = PRODUCTS.filter(p => (activeCat === 'All' || p.groups.includes(activeCat)) && (!hotOnly || p.hot));
    if (!tokens.length) return sortList(list);
    const matched = list
      .map(p => {
        let s = 0;
        for (const t of tokens){ const v = scoreToken(p, t); if (!v) return null; s += v; }
        return { p, s };
      })
      .filter(Boolean)
      .sort((a,b) => b.s - a.s || a.p.codeNum - b.p.codeNum)
      .map(x => x.p);
    // While searching, "default" keeps best-match order; any other choice re-sorts the matches
    return sortBy === 'default' ? matched : sortList(matched);
  }

  // Products without a price always go to the end of a price sort
  function byPrice(dir){
    return (a, b) => {
      const x = a.priceNum, y = b.priceNum;
      if (isNaN(x) || isNaN(y)) return isNaN(x) - isNaN(y) || b.codeNum - a.codeNum;
      return (x - y) * dir || b.codeNum - a.codeNum;
    };
  }
  const SORTS = {
    'default':    (a, b) => b.codeNum - a.codeNum,
    'code-asc':   (a, b) => a.codeNum - b.codeNum,
    'price-asc':  byPrice(1),
    'price-desc': byPrice(-1),
    'name':       (a, b) => String(a.name).localeCompare(String(b.name)) || a.codeNum - b.codeNum
  };
  const sortList = list => list.slice().sort(SORTS[sortBy] || SORTS['default']);

  const ARROW = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  const imgTag = (src, alt) =>
    `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" draggable="false" onload="this.classList.add('ok')" onerror="this.replaceWith(document.createRange().createContextualFragment(window.__PH))">`;

  // Photos: `images: [...]` (several) or `image: "..."` (one)
  function photos(p){
    const list = Array.isArray(p.images) && p.images.length ? p.images : [p.image];
    const imgs = list.filter(Boolean);
    if (!imgs.length) return PH;
    if (imgs.length === 1) return imgTag(imgs[0], p.name);
    const n = imgs.length;
    return `<div class="slides" tabindex="0" aria-label="${esc(p.name)} photos">
        ${imgs.map((src, k) => `<div class="slide">${imgTag(src, `${p.name} (photo ${k + 1} of ${n})`)}</div>`).join('')}
      </div>
      <button class="nav prev" type="button" aria-label="Previous photo" hidden>${ARROW('M15 6l-6 6 6 6')}</button>
      <button class="nav next" type="button" aria-label="Next photo">${ARROW('M9 6l6 6-6 6')}</button>
      <div class="dots" aria-hidden="true">${imgs.map((_, k) => `<span${k ? '' : ' class="on"'}></span>`).join('')}</div>`;
  }

  const FLAME = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.5 2.2c.4 3.1-1.1 4.9-2.6 6.6C8.4 10.5 7 12.1 7 14.6 7 18 9.4 21 12.5 21s5.5-2.6 5.5-6.2c0-2.3-1-4.1-2.2-5.4-.2 1.4-.9 2.5-2 3.1.6-3.7-.3-7.6-1.3-10.3z"/></svg>';

  function card(p, i){
    return `<article class="card" style="animation-delay:${Math.min(i,12)*30}ms">
      <div class="thumb">${photos(p)}<span class="code">#${pad(p.codeNum)}</span>${p.hot ? `<span class="hot">${FLAME}Hot</span>` : ''}</div>
      <div class="body">
        ${p.groups.length ? `<div class="tags">${p.groups.map(g => `<span class="tag">${esc(g)}</span>`).join('')}</div>` : ''}
        <h3 class="name">${esc(p.name)}</h3>
        <a class="buy" href="${esc(p.link || '#')}" target="_blank" rel="noopener sponsored">
          ${BUY_LABEL}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>
        </a>
      </div>
    </article>`;
  }

  function render(){
    shown = true;
    grid.removeAttribute('aria-busy');
    meta.classList.remove('loading');
    const q = input.value;
    const results = search(q);
    grid.innerHTML = results.map(card).join('');
    empty.classList.toggle('show', results.length === 0);
    clearBtn.classList.toggle('show', q.length > 0);
    const n = results.length;
    const what = (hotOnly ? 'hot ' : '') + (n === 1 ? 'item' : 'items');
    meta.textContent = q.trim()
      ? `${n} ${hotOnly ? 'hot ' : ''}result${n === 1 ? '' : 's'} for “${q.trim()}”`
      : `${n} ${what}${activeCat === 'All' ? '' : ' in ' + activeCat}`;
    meta.style.visibility = n ? 'visible' : 'hidden';
    if (sortBox) syncSort(q.trim() !== '');
    if (hotBtn) hotBtn.setAttribute('aria-pressed', hotOnly);
  }

  // Keep ?q= in the URL so a search can be shared, e.g. /shopping/tiktok/?q=12
  let urlTimer;
  function syncUrl(){
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const u = new URL(location.href);
      input.value.trim() ? u.searchParams.set('q', input.value.trim()) : u.searchParams.delete('q');
      sortBy !== 'default' ? u.searchParams.set('sort', sortBy) : u.searchParams.delete('sort');
      hotOnly ? u.searchParams.set('hot', '1') : u.searchParams.delete('hot');
      u.searchParams.delete('code');
      history.replaceState(null, '', u);
    }, 400);
  }

  function buildChips(){
    // Tabs: main categories first, then extra tags (e.g. "Baby")
    const cats = [...new Set([...PRODUCTS.map(p => p.category), ...PRODUCTS.flatMap(p => p.tags)].filter(Boolean))];
    if (cats.length < 2){ chips.style.display = 'none'; return; }
    chips.innerHTML = ['All', ...cats].map(c =>
      `<button class="chip" type="button" aria-pressed="${c === activeCat}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
    chips.addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      activeCat = b.dataset.cat;
      chips.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x === b));
      render();
    });
  }

  // ---------- Sort menu + "Hot only" toggle (built here so both shops get them) ----------
  let sortBox = null, hotBtn = null, sortOpts = [];
  function buildToolbar(){
    const bar = document.createElement('div');
    bar.className = 'toolbar';
    meta.replaceWith(bar);
    bar.appendChild(meta);
    const tools = document.createElement('div');
    tools.className = 'tools';
    if (HAS_HOT){
      hotBtn = document.createElement('button');
      hotBtn.type = 'button'; hotBtn.className = 'hot-toggle';
      hotBtn.innerHTML = FLAME + 'Hot only';
      hotBtn.addEventListener('click', () => { hotOnly = !hotOnly; render(); syncUrl(); });
      tools.appendChild(hotBtn);
    }
    sortOpts = [['default', 'Newest'], ['code-asc', 'Code: low to high']];
    if (HAS_PRICE) sortOpts.push(['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low']);
    sortOpts.push(['name', 'Name: A to Z']);
    if (!sortOpts.some(o => o[0] === sortBy)) sortBy = 'default';

    // Custom sort menu (the browser's own <select> list can't be themed)
    const CHECK = '<svg class="ck" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
    sortBox = document.createElement('div');
    sortBox.className = 'sort';
    sortBox.innerHTML = `<button type="button" class="sort-btn" aria-haspopup="listbox" aria-expanded="false">
        <svg class="si" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4m-3.5 3.5L17 4l3.5 3.5"/></svg>
        <span class="sv"></span>
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
      </button>
      <div class="sort-menu" role="listbox" aria-label="Sort items" tabindex="-1">
        <div class="sort-head" aria-hidden="true">Sort by</div>
        ${sortOpts.map(([v, t]) => `<div class="opt" role="option" tabindex="-1" data-v="${v}"><span>${t}</span>${CHECK}</div>`).join('')}
      </div>`;
    const btn = sortBox.querySelector('.sort-btn'), menu = sortBox.querySelector('.sort-menu');
    const items = () => [...menu.querySelectorAll('.opt')];
    const open = () => {
      sortBox.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
      (menu.querySelector('[aria-selected="true"]') || items()[0]).focus();
    };
    const close = (refocus) => {
      if (!sortBox.classList.contains('open')) return;
      sortBox.classList.remove('open'); btn.setAttribute('aria-expanded', 'false');
      if (refocus) btn.focus();
    };
    const pick = el => { sortBy = el.dataset.v; close(true); render(); syncUrl(); };
    btn.addEventListener('click', () => sortBox.classList.contains('open') ? close(false) : open());
    menu.addEventListener('click', e => { const o = e.target.closest('.opt'); if (o) pick(o); });
    menu.addEventListener('keydown', e => {
      const list = items(), k = list.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){
        e.preventDefault();
        list[(k + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length].focus();
      } else if (e.key === 'Home' || e.key === 'End'){
        e.preventDefault(); list[e.key === 'Home' ? 0 : list.length - 1].focus();
      } else if ((e.key === 'Enter' || e.key === ' ') && k >= 0){
        e.preventDefault(); pick(list[k]);
      } else if (e.key === 'Escape'){ close(true); }
      else if (e.key === 'Tab'){ close(false); }
    });
    btn.addEventListener('keydown', e => { if (e.key === 'ArrowDown'){ e.preventDefault(); open(); } });
    document.addEventListener('pointerdown', e => { if (!sortBox.contains(e.target)) close(false); });
    tools.appendChild(sortBox);
    bar.appendChild(tools);
  }

  // Button text + selected tick; the first option reads "Best match" while searching
  function syncSort(searching){
    const label = v => v === 'default' && searching ? 'Best match' : sortOpts.find(o => o[0] === v)[1];
    // Shorter wording on the button so the row fits on small phones
    const SHORT = { 'code-asc': 'Lowest code', 'price-asc': 'Lowest price', 'price-desc': 'Highest price', 'name': 'Name A–Z' };
    sortBox.querySelector('.sv').textContent = SHORT[sortBy] || label(sortBy);
    sortBox.querySelector('.sort-btn').setAttribute('aria-label', 'Sort: ' + label(sortBy));
    sortBox.querySelectorAll('.opt').forEach(o => {
      o.setAttribute('aria-selected', o.dataset.v === sortBy);
      o.querySelector('span').textContent = label(o.dataset.v);
    });
  }

  input.addEventListener('input', () => { render(); syncUrl(); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
  clearBtn.addEventListener('click', () => { input.value = ''; render(); syncUrl(); input.focus(); });
  $('reset').addEventListener('click', () => {
    input.value = ''; activeCat = 'All'; hotOnly = false;
    chips.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x.dataset.cat === 'All'));
    render(); syncUrl();
  });

  // ---------- Photo slider (cards with 2+ photos) ----------
  // Swipe works natively via scroll-snap; the arrows scroll one photo at a time.
  function syncSlider(track){
    const thumb = track.parentElement;
    const n = track.children.length;
    const k = Math.round(track.scrollLeft / track.clientWidth);
    thumb.querySelector('.prev').hidden = k <= 0;
    thumb.querySelector('.next').hidden = k >= n - 1;
    thumb.querySelectorAll('.dots span').forEach((d, j) => d.classList.toggle('on', j === k));
  }
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.nav');
    if (!btn){
      // Tapping anywhere on a card opens the product (same as its buy button).
      // Swiping photos scrolls instead of clicking, so it doesn't trigger this.
      const card = e.target.closest('.card:not(.skel)');
      if (card && !e.target.closest('a, button') && !getSelection().toString()) card.querySelector('.buy').click();
      return;
    }
    const track = btn.parentElement.querySelector('.slides');
    track.scrollBy({ left: (btn.classList.contains('next') ? 1 : -1) * track.clientWidth, behavior: 'smooth' });
  });
  grid.addEventListener('scroll', e => {
    if (e.target.classList && e.target.classList.contains('slides')) syncSlider(e.target);
  }, true);  // scroll doesn't bubble, so listen in the capture phase
  grid.addEventListener('keydown', e => {
    if (!e.target.classList.contains('slides')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft'){
      e.preventDefault();
      e.target.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * e.target.clientWidth, behavior: 'smooth' });
    }
  });

  // Slider styles live here so every shop page gets them. Pages can theme them
  // with --nav-bg, --nav-ink and --dot-on.
  const css = document.createElement('style');
  css.textContent = `
    .toolbar{ display:flex; align-items:center; justify-content:space-between; gap:8px 12px;
      flex-wrap:wrap; margin:4px 2px 14px; }
    .toolbar .meta{ margin:0; }
    .tools{ display:flex; align-items:center; gap:8px; margin-left:auto; }
    .tools{ position:relative; z-index:5; }
    .toolbar .meta{ white-space:nowrap; }
    .hot-toggle, .sort-btn{ height:36px; border-radius:var(--ctl-radius, 999px);
      border:1px solid var(--line); background:var(--card); color:var(--ink);
      font-size:13px; font-weight:600; cursor:pointer;
      box-shadow:0 1px 2px rgba(0,0,0,.05);
      transition:background .2s, color .2s, border-color .2s, box-shadow .2s; }
    .hot-toggle{ display:inline-flex; align-items:center; gap:5px; padding:0 13px 0 11px; }
    .hot-toggle svg{ width:14px; height:14px; color:var(--hot, #FF4D1A); transition:color .2s, transform .2s; }
    .hot-toggle:hover, .sort-btn:hover{ border-color:color-mix(in srgb, var(--hot, #FF4D1A) 55%, var(--line)); }
    .hot-toggle[aria-pressed="true"]{ background:var(--hot, #FF4D1A); border-color:var(--hot, #FF4D1A); color:#fff;
      box-shadow:0 4px 12px color-mix(in srgb, var(--hot, #FF4D1A) 35%, transparent); }
    .hot-toggle[aria-pressed="true"] svg{ color:#fff; transform:scale(1.15); }
    .hot-toggle:focus-visible, .sort-btn:focus-visible{ outline:2px solid var(--hot, #FF4D1A); outline-offset:2px; }

    .sort{ position:relative; }
    .sort-btn{ display:inline-flex; align-items:center; gap:7px; padding:0 11px 0 12px; }
    .sort-btn .si{ width:15px; height:15px; color:var(--hot, #FF4D1A); }
    .sort-btn .chev{ width:14px; height:14px; color:var(--ink-dim); transition:transform .25s var(--ease, ease); }
    .sort.open .sort-btn{ border-color:var(--hot, #FF4D1A);
      box-shadow:0 0 0 3px color-mix(in srgb, var(--hot, #FF4D1A) 16%, transparent); }
    .sort.open .chev{ transform:rotate(180deg); }
    .sort-menu{ position:absolute; right:0; top:calc(100% + 8px); min-width:210px; padding:6px;
      background:var(--card); color:var(--ink);
      border:1px solid var(--line); border-radius:var(--menu-radius, 16px);
      box-shadow:0 12px 32px rgba(0,0,0,.18), 0 2px 6px rgba(0,0,0,.08);
      opacity:0; visibility:hidden; transform:translateY(-6px) scale(.97); transform-origin:top right;
      transition:opacity .18s, transform .18s var(--ease, ease), visibility 0s .18s; outline:none; }
    .sort.open .sort-menu{ opacity:1; visibility:visible; transform:none;
      transition:opacity .18s, transform .18s var(--ease, ease); }
    .sort-head{ padding:6px 10px 6px; font-size:11px; font-weight:700; letter-spacing:.08em;
      text-transform:uppercase; color:var(--ink-dim); }
    .opt{ display:flex; align-items:center; justify-content:space-between; gap:12px;
      height:40px; padding:0 10px; border-radius:calc(var(--menu-radius, 16px) - 6px);
      font-size:14px; font-weight:500; cursor:pointer; outline:none; white-space:nowrap;
      transition:background .15s, color .15s; }
    .opt:hover, .opt:focus-visible{ background:color-mix(in srgb, var(--ink) 6%, transparent); }
    .opt .ck{ width:16px; height:16px; flex:none; opacity:0; transform:scale(.6); transition:opacity .15s, transform .2s; }
    .opt[aria-selected="true"]{ color:var(--hot, #FF4D1A); font-weight:700;
      background:color-mix(in srgb, var(--hot, #FF4D1A) 10%, transparent); }
    .opt[aria-selected="true"] .ck{ opacity:1; transform:none; }
    @media (prefers-reduced-motion: reduce){ .sort-menu, .sort-btn .chev{ transition:none; } }
    .hot{ position:absolute; top:var(--hot-top, 10px); right:var(--hot-right, 10px); z-index:2;
      display:inline-flex; align-items:center; gap:3px;
      background:var(--hot, #FF4D1A); color:#fff;
      font-size:11px; font-weight:800; letter-spacing:.05em; text-transform:uppercase;
      padding:4px 8px 4px 6px; border-radius:var(--hot-radius, 999px);
      box-shadow:0 2px 6px rgba(0,0,0,.2); }
    .hot svg{ width:12px; height:12px; }
    /* Whole card is clickable */
    .card:not(.skel){ cursor:pointer; }
    .card:not(.skel):hover .buy{ filter:brightness(.92); }
    /* Loading boxes: photo area and every text line shimmer */
    .skel{ animation:none; pointer-events:none; }
    .skel .thumb, .skel .bar, .meta.loading, .thumb:has(img:not(.ok)){
      background:linear-gradient(100deg,
        var(--skel, color-mix(in srgb, var(--ink) 7%, var(--card))) 30%,
        var(--skel-shine, color-mix(in srgb, var(--ink) 2%, var(--card))) 50%,
        var(--skel, color-mix(in srgb, var(--ink) 7%, var(--card))) 70%);
      background-size:250% 100%;
      animation:skel-shimmer 1.3s ease-in-out infinite; }
    .meta.loading{ width:56px; height:12px; border-radius:6px; }
    .skel .bar{ display:block; height:12px; border-radius:6px; }
    .skel .bar.btn{ height:40px; margin-top:auto; border-radius:var(--ctl-radius, 999px); }
    @keyframes skel-shimmer{ from{ background-position:100% 0; } to{ background-position:-50% 0; } }
    .thumb img{ transition:opacity .3s; }
    .thumb img:not(.ok){ opacity:0; }
    @media (prefers-reduced-motion: reduce){
      .skel .thumb, .skel .bar, .meta.loading, .thumb:has(img:not(.ok)){ animation:none; }
    }
    .tags{ display:flex; flex-wrap:wrap; gap:4px 8px; }
    .slides{ display:flex; width:100%; height:100%; overflow-x:auto; scroll-snap-type:x mandatory;
      scrollbar-width:none; overscroll-behavior-x:contain; outline:none; }
    .slides::-webkit-scrollbar{ display:none; }
    .slide{ flex:0 0 100%; height:100%; scroll-snap-align:start; scroll-snap-stop:always; }
    .slide img, .slide .ph{ width:100%; height:100%; object-fit:cover; display:block; user-select:none; }
    .nav{ position:absolute; top:50%; transform:translateY(-50%); z-index:2;
      width:32px; height:32px; border-radius:50%; border:0; cursor:pointer;
      display:grid; place-items:center;
      background:var(--nav-bg, rgba(255,255,255,.88)); color:var(--nav-ink, #16161A);
      box-shadow:0 2px 8px rgba(0,0,0,.18);
      transition:opacity .2s, transform .15s; }
    .nav[hidden]{ display:none; }
    .nav:active{ transform:translateY(-50%) scale(.9); }
    .nav svg{ width:16px; height:16px; }
    .nav.prev{ left:8px; } .nav.next{ right:8px; }
    @media (hover:hover){
      .thumb .nav{ opacity:0; }
      .thumb:hover .nav, .thumb:focus-within .nav{ opacity:1; }
    }
    .dots{ position:absolute; left:0; right:0; bottom:8px; z-index:2;
      display:flex; justify-content:center; gap:5px; pointer-events:none; }
    .dots span{ width:6px; height:6px; border-radius:3px; background:rgba(255,255,255,.6);
      box-shadow:0 0 3px rgba(0,0,0,.35); transition:width .25s, background .25s; }
    .dots span.on{ width:16px; background:var(--dot-on, #fff); }
    .slides:focus-visible{ outline:2px solid var(--dot-on, #fff); outline-offset:-4px; }
  `;
  document.head.appendChild(css);

  // Darken the search bar background once it sticks to the top
  const wrap = $('searchWrap');
  new IntersectionObserver(([e]) => wrap.classList.toggle('stuck', e.intersectionRatio < 1),
    { threshold: [1], rootMargin: '-1px 0px 0px 0px' }).observe(wrap);

  // ---------- Loading boxes ----------
  // Show 8 shimmering placeholder cards first, then swap in the real products once
  // the first photos have loaded (at least ~0.5s so it doesn't flash, at most ~2.5s).
  const SKELETON = `<div class="card skel" aria-hidden="true">
      <div class="thumb"></div>
      <div class="body">
        <span class="bar" style="width:38%;height:10px"></span>
        <span class="bar" style="width:92%"></span>
        <span class="bar" style="width:64%"></span>
        <span class="bar" style="width:44%;height:16px;margin-top:2px"></span>
        <span class="bar btn"></span>
      </div>
    </div>`;
  function showSkeleton(){
    grid.innerHTML = SKELETON.repeat(8);
    grid.setAttribute('aria-busy', 'true');
    empty.classList.remove('show');
    meta.textContent = '';
    meta.classList.add('loading');   // shimmer bar where the item count goes
    meta.style.visibility = 'visible';
  }
  function firstPhotosLoaded(){
    const srcs = search(input.value).slice(0, 8).map(p =>
      (Array.isArray(p.images) && p.images.length ? p.images[0] : p.image)).filter(Boolean);
    return Promise.all(srcs.map(src => new Promise(done => {
      const im = new Image(); im.onload = im.onerror = done; im.src = src;
    })));
  }

  const params = new URLSearchParams(location.search);
  input.value = params.get('q') || params.get('code') || '';
  sortBy = params.get('sort') || 'default';
  hotOnly = HAS_HOT && params.get('hot') === '1';
  buildToolbar();
  buildChips();
  showSkeleton();
  // If the viewer searches, taps a tab or sorts before then, render() runs early and this is skipped
  const wait = ms => new Promise(r => setTimeout(r, ms));
  Promise.race([Promise.all([firstPhotosLoaded(), wait(500)]), wait(2500)])
    .then(() => { if (!shown) render(); });
})();
