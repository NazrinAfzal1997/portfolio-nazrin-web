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
    `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" draggable="false" onerror="this.replaceWith(document.createRange().createContextualFragment(window.__PH))">`;

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

  const money = n => 'RM' + n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const FLAME = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.5 2.2c.4 3.1-1.1 4.9-2.6 6.6C8.4 10.5 7 12.1 7 14.6 7 18 9.4 21 12.5 21s5.5-2.6 5.5-6.2c0-2.3-1-4.1-2.2-5.4-.2 1.4-.9 2.5-2 3.1.6-3.7-.3-7.6-1.3-10.3z"/></svg>';

  function card(p, i){
    return `<article class="card" style="animation-delay:${Math.min(i,12)*30}ms">
      <div class="thumb">${photos(p)}<span class="code">#${pad(p.codeNum)}</span>${p.hot ? `<span class="hot">${FLAME}Hot</span>` : ''}</div>
      <div class="body">
        ${p.groups.length ? `<div class="tags">${p.groups.map(g => `<span class="tag">${esc(g)}</span>`).join('')}</div>` : ''}
        <h3 class="name">${esc(p.name)}</h3>
        ${isNaN(p.priceNum) ? '' : `<div class="price">${money(p.priceNum)}</div>`}
        <a class="buy" href="${esc(p.link || '#')}" target="_blank" rel="noopener sponsored">
          ${BUY_LABEL}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>
        </a>
      </div>
    </article>`;
  }

  function render(){
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
    if (sortSel){
      // The first option reads "Best match" while searching, "Newest" otherwise
      sortSel.options[0].textContent = q.trim() ? 'Best match' : 'Newest';
      sortSel.value = sortBy;
    }
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
  let sortSel = null, hotBtn = null;
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
    const opts = [['default', 'Newest'], ['code-asc', 'Code: low to high']];
    if (HAS_PRICE) opts.push(['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low']);
    opts.push(['name', 'Name: A to Z']);
    if (!opts.some(o => o[0] === sortBy)) sortBy = 'default';
    const lab = document.createElement('label');
    lab.className = 'sort';
    lab.innerHTML = `<span>Sort</span><select aria-label="Sort items">${opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>`;
    sortSel = lab.querySelector('select');
    sortSel.addEventListener('change', () => { sortBy = sortSel.value; render(); syncUrl(); });
    tools.appendChild(lab);
    bar.appendChild(tools);
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
    const btn = e.target.closest('.nav'); if (!btn) return;
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
    .hot-toggle, .sort{ height:34px; border-radius:var(--ctl-radius, 999px);
      border:1px solid var(--line); background:var(--card); color:var(--ink);
      font-size:13px; font-weight:600; }
    .hot-toggle{ display:inline-flex; align-items:center; gap:5px; padding:0 12px 0 10px; cursor:pointer;
      transition:background .2s, color .2s, border-color .2s; }
    .hot-toggle svg{ width:14px; height:14px; color:var(--hot, #FF4D1A); transition:color .2s; }
    .hot-toggle:hover{ border-color:var(--hot, #FF4D1A); }
    .hot-toggle[aria-pressed="true"]{ background:var(--hot, #FF4D1A); border-color:var(--hot, #FF4D1A); color:#fff; }
    .hot-toggle[aria-pressed="true"] svg{ color:#fff; }
    .sort{ position:relative; display:inline-flex; align-items:center; padding-left:12px; cursor:pointer; }
    .sort span{ color:var(--ink-dim); font-weight:500; }
    .sort select{ appearance:none; -webkit-appearance:none; border:0; background:transparent; color:inherit;
      font:inherit; height:100%; padding:0 30px 0 6px; cursor:pointer; outline:none; }
    .sort select option{ color:#222; background:#fff; }
    .sort svg{ position:absolute; right:10px; width:14px; height:14px; pointer-events:none; color:var(--ink-dim); }
    .sort:focus-within{ border-color:var(--hot, #FF4D1A); }
    .hot{ position:absolute; top:var(--hot-top, 10px); right:var(--hot-right, 10px); z-index:2;
      display:inline-flex; align-items:center; gap:3px;
      background:var(--hot, #FF4D1A); color:#fff;
      font-size:11px; font-weight:800; letter-spacing:.05em; text-transform:uppercase;
      padding:4px 8px 4px 6px; border-radius:var(--hot-radius, 999px);
      box-shadow:0 2px 6px rgba(0,0,0,.2); }
    .hot svg{ width:12px; height:12px; }
    .price{ font-size:16px; font-weight:800; color:var(--price-ink, var(--ink)); letter-spacing:-.01em; }
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

  const params = new URLSearchParams(location.search);
  input.value = params.get('q') || params.get('code') || '';
  sortBy = params.get('sort') || 'default';
  hotOnly = HAS_HOT && params.get('hot') === '1';
  buildToolbar();
  buildChips();
  render();
})();
