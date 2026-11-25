/*
  Shared product finder for /shopping/<marketplace>/ pages.
  Each page loads its own products.js (window.PRODUCTS), then this file.
  The buy-button text comes from <body data-buy-label="...">.
  Expects elements: #q #clear #searchWrap #chips #meta #grid #empty #reset
*/
(function(){
  const PRODUCTS = (window.PRODUCTS || []).map(p => ({
    ...p,
    codeNum: parseInt(String(p.code).replace(/\D/g,''), 10),
    hay: norm([p.name, p.category, p.keywords].filter(Boolean).join(' ')).split(' ')
  }));
  const PH = '<div class="ph" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg></div>';

  const $ = id => document.getElementById(id);
  const input = $('q'), grid = $('grid'), chips = $('chips'), meta = $('meta'),
        empty = $('empty'), clearBtn = $('clear');
  let activeCat = 'All';
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
    let list = PRODUCTS.filter(p => activeCat === 'All' || p.category === activeCat);
    if (!tokens.length) return list.slice().sort((a,b) => b.codeNum - a.codeNum);
    return list
      .map(p => {
        let s = 0;
        for (const t of tokens){ const v = scoreToken(p, t); if (!v) return null; s += v; }
        return { p, s };
      })
      .filter(Boolean)
      .sort((a,b) => b.s - a.s || a.p.codeNum - b.p.codeNum)
      .map(x => x.p);
  }

  function card(p, i){
    const img = p.image
      ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" onerror="this.replaceWith(document.createRange().createContextualFragment(window.__PH))">`
      : PH;
    return `<article class="card" style="animation-delay:${Math.min(i,12)*30}ms">
      <div class="thumb">${img}<span class="code">#${pad(p.codeNum)}</span></div>
      <div class="body">
        ${p.category ? `<span class="tag">${esc(p.category)}</span>` : ''}
        <h3 class="name">${esc(p.name)}</h3>
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
    meta.textContent = q.trim()
      ? `${n} result${n === 1 ? '' : 's'} for “${q.trim()}”`
      : `${n} item${n === 1 ? '' : 's'}${activeCat === 'All' ? '' : ' in ' + activeCat} · newest first`;
    meta.style.visibility = n ? 'visible' : 'hidden';
  }

  // Keep ?q= in the URL so a search can be shared, e.g. /shopping/tiktok/?q=12
  let urlTimer;
  function syncUrl(){
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const u = new URL(location.href);
      input.value.trim() ? u.searchParams.set('q', input.value.trim()) : u.searchParams.delete('q');
      history.replaceState(null, '', u);
    }, 400);
  }

  function buildChips(){
    const cats = [...new Set(PRODUCTS.map(p => p.category).filter(Boolean))];
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

  input.addEventListener('input', () => { render(); syncUrl(); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
  clearBtn.addEventListener('click', () => { input.value = ''; render(); syncUrl(); input.focus(); });
  $('reset').addEventListener('click', () => {
    input.value = ''; activeCat = 'All';
    chips.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x.dataset.cat === 'All'));
    render(); syncUrl();
  });

  // Darken the search bar background once it sticks to the top
  const wrap = $('searchWrap');
  new IntersectionObserver(([e]) => wrap.classList.toggle('stuck', e.intersectionRatio < 1),
    { threshold: [1], rootMargin: '-1px 0px 0px 0px' }).observe(wrap);

  const params = new URLSearchParams(location.search);
  input.value = params.get('q') || params.get('code') || '';
  buildChips();
  render();
})();
