/* TAESTEP 발표 화면
   play.html?deck=<이름>            발표
   play.html?deck=<이름>&view=presenter   발표자 화면 (노트 · 다음 장 · 시계) — 발표 창과 서로 따라감
   play.html?deck=<이름>&print=1    PDF 로 인쇄 */
'use strict';
(async () => {
  const $ = id => document.getElementById(id);
  const q = new URLSearchParams(location.search); const id = q.get('deck') || '';
  const ALONE = !!window.TS_DECK, EMBED = !!q.get('embed') && window.parent !== window; // 단독 HTML · 편집 화면 안에서 띄운 발표
  const deck = window.TS_DECK || (id ? await TSStore.load(id) : null);
  if (!deck || !Array.isArray(deck.slides) || !deck.slides.length) { document.body.innerHTML = '<div class="empty-page"><h1>교안을 찾지 못했습니다</h1><p><a href="./">목록으로 돌아가기</a></p></div>'; return; }
  document.title = deck.title + ' — TAESTEP';
  const S = deck.slides, N = S.length;
  const ch = 'BroadcastChannel' in window && !ALONE ? new BroadcastChannel('taestep:' + id) : null;
  const back = () => { if (ALONE) return; if (EMBED) return parent.postMessage({ type: 'taestep-play-close', slide: cur + 1 }, location.origin); location.href = q.get('from') === 'studio' ? `studio.html?deck=${encodeURIComponent(id)}${location.hash}` : './'; };
  let cur = -1, step = 0;

  /* ---------- PDF 인쇄 ---------- */
  if (q.get('print')) {
    const notes = q.get('print') === 'notes'; document.body.className = notes ? 'ts-handout' : 'ts-print'; document.body.innerHTML = '';
    const st = document.createElement('style'); st.textContent = notes ? '@page { size: A4 portrait; margin: 0; }' : '@page { size: 1920px 1080px; margin: 0; }'; document.head.appendChild(st);
    if (notes) S.forEach((s, i) => { const pg = document.createElement('section'); pg.className = 'ho-page'; pg.innerHTML = `<header><b>${TS.E(deck.title || '')}</b><span>${i + 1} / ${N}${s.time ? ' · ' + TS.E(s.time) : ''}</span></header><div class="ho-pic"></div><h4>발표 노트</h4><div class="ho-notes">${TS.E(s.notes || '(노트 없음)')}</div>`; document.body.appendChild(pg); const h = pg.querySelector('.ho-pic'); const el = TS.slideEl(deck, s, i, N); h.appendChild(el); TS.fit(el); el.style.zoom = h.clientWidth / 1920; });
    else S.forEach((s, i) => { const el = TS.slideEl(deck, s, i, N); document.body.appendChild(el); TS.fit(el); });
    const imgs = [...new Set(S.flatMap(s => [s.bg && s.bg.src, s.image && s.image.src]).filter(x => x && !TS.isVideo(x)))];
    await Promise.all(imgs.map(src => new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = src; })));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    setTimeout(() => window.print(), 400); return;
  }

  /* ---------- 발표자 화면 ---------- */
  if (q.get('view') === 'presenter') {
    document.body.className = 'presenter';
    document.body.innerHTML = `<div class="pv"><div class="pv-top"><b>${TS.E(deck.title)}</b><span id="pvPage"></span><span class="sp"></span><span id="pvTimer" title="누르면 0으로">00:00</span><span id="pvClock"></span></div>
      <div class="pv-main"><div class="pv-cur"><div id="pvCur"></div></div><div class="pv-side"><div class="pv-label">다음 장</div><div id="pvNext"></div><div class="pv-label">발표 노트</div><div id="pvNotes"></div></div></div>
      <div class="pv-bar"><button id="pvPrev">◀ 이전</button><button id="pvNextBtn" class="pri">다음 ▶</button></div></div>`;
    let t0 = 0;
    const draw = (cur, step) => {
      TS.thumb(deck, S[cur], cur, N, $('pvCur'));
      if (cur + 1 < N) TS.thumb(deck, S[cur + 1], cur + 1, N, $('pvNext')); else $('pvNext').innerHTML = '<div class="pv-end">마지막 장입니다</div>';
      $('pvNotes').textContent = S[cur].notes || '(노트 없음)'; $('pvPage').textContent = `${cur + 1} / ${N}` + (step ? ` · ${step}번째 클릭` : '');
    };
    draw(0, 0);
    if (ch) { ch.onmessage = e => { const m = e.data || {}; if (m.type === 'state') { if (!t0 && (m.cur || m.step)) t0 = Date.now(); draw(m.cur, m.step); } }; ch.postMessage({ type: 'hello' }); }
    const cmd = c => { if (!t0) t0 = Date.now(); if (ch) ch.postMessage({ type: 'cmd', cmd: c }); };
    $('pvPrev').onclick = () => cmd('prev'); $('pvNextBtn').onclick = () => cmd('next'); $('pvTimer').onclick = () => { t0 = Date.now(); };
    addEventListener('keydown', e => { if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); cmd('next'); } else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); cmd('prev'); } });
    setInterval(() => { const d = new Date(); $('pvClock').textContent = d.toTimeString().slice(0, 5); const s = t0 ? Math.floor((Date.now() - t0) / 1000) : 0; $('pvTimer').textContent = TS.pad(Math.floor(s / 60)) + ':' + TS.pad(s % 60); }, 500);
    return;
  }

  /* ---------- 발표 ---------- */
  const stage = $('stage'), wrap = $('wrap');
  if (q.get('motion') === '0') stage.classList.add('no-motion');
  const els = S.map((s, i) => { const el = TS.slideEl(deck, s, i, N); stage.appendChild(el); return el; });
  const fitAll = () => els.forEach(TS.fit);
  fitAll(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);
  const scale = () => { const k = Math.min(innerWidth / 1920, innerHeight / 1080); stage.style.transform = `translate(${(innerWidth - 1920 * k) / 2}px, ${(innerHeight - 1080 * k) / 2}px) scale(${k})`; };
  scale(); addEventListener('resize', scale);

  const tell = () => { if (ch) ch.postMessage({ type: 'state', cur, step }); };
  /* 장 넘김: 앞으로 갈 때는 들어오는 장의 효과, 뒤로 갈 때는 방금 있던 장의 효과를 거꾸로 */
  function show(n, fromBack) {
    n = Math.max(0, Math.min(N - 1, n)); if (n === cur) return;
    const old = els[cur], el = els[n]; const still = stage.classList.contains('no-motion');
    const tr = !old || still ? 'none' : TS.trOf(deck, fromBack ? S[cur] : S[n]);
    if (old) { old.classList.remove('is-active', 'morphing'); old.dataset.leave = tr; old.classList.toggle('back', !!fromBack); old.classList.add('is-leaving'); clearTimeout(old._lt); old._lt = setTimeout(() => old.classList.remove('is-leaving'), 920); const v = old.querySelector('video'); if (v) v.pause(); }
    el.classList.remove('is-leaving'); clearTimeout(el._lt); el.dataset.tr = tr; el.classList.toggle('back', !!fromBack);
    const c = TS.live(el); c.reset(!!fromBack); cur = n; step = c.step;
    const mo = tr === 'morph' && old ? TS.morph(old, el) : null; // 같은 요소의 자리를 재 둔다 (장을 바꾸기 전에)
    el.classList.toggle('morphing', !!mo); void el.offsetWidth; el.classList.add('is-active'); if (mo) mo.run();
    const v = el.querySelector('video'); if (v) { try { v.currentTime = 0; v.play(); } catch (e) { } }
    setTimeout(() => { if (cur === n) TS.countUp(fromBack ? el : { querySelectorAll: q2 => [...el.querySelectorAll(q2)].filter(x => !x.closest('[data-step]')) }); }, 450);
    $('pgNow').textContent = n + 1; $('notesText').textContent = S[n].notes || '(노트 없음)';
    try { history.replaceState(null, '', '#' + (n + 1)); } catch (e) { }
    if (EMBED) parent.postMessage({ type: 'taestep-play-slide', slide: n + 1 }, location.origin);
    tell();
  }
  function next() { const c = TS.live(els[cur]); if (c.next()) { step = c.step; tell(); } else if (cur < N - 1) show(cur + 1); }
  function prev() { const c = TS.live(els[cur]); if (c.prev()) { step = c.step; tell(); } else if (cur > 0) show(cur - 1, true); }
  $('pgAll').textContent = N;
  show(Math.max(1, parseInt(location.hash.slice(1), 10) || 1) - 1);

  /* 도구 · 목록 · 노트 */
  const full = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => { }); };
  const overview = on => {
    const o = $('overview'); const want = on == null ? o.hidden : on; o.hidden = !want; if (!want) return;
    if (!o.dataset.ready) { o.dataset.ready = '1'; S.forEach((s, i) => { const b = document.createElement('button'); b.className = 'ov-item'; b.innerHTML = `<div class="ov-pic"></div><span>${i + 1}</span>`; b.onclick = () => { overview(false); show(i); }; o.querySelector('.ov-grid').appendChild(b); TS.thumb(deck, s, i, N, b.firstChild); }); }
    o.querySelectorAll('.ov-item').forEach((b, i) => b.classList.toggle('cur', i === cur));
    const c = o.querySelector('.ov-item.cur'); if (c) c.scrollIntoView({ block: 'center' });
  };
  const notes = () => { $('notes').hidden = !$('notes').hidden; };
  const presenter = () => window.open(`play.html?deck=${encodeURIComponent(id)}&view=presenter`, 'taestep-presenter', 'width=1100,height=720');
  $('btPrev').onclick = prev; $('btNext').onclick = next; $('btGrid').onclick = () => overview(); $('btNotes').onclick = notes; $('btPres').onclick = presenter; $('btFull').onclick = full; $('btExit').onclick = back;
  $('ovClose').onclick = () => overview(false);
  if (ch) ch.onmessage = e => { const m = e.data || {}; if (m.type === 'hello') tell(); else if (m.type === 'cmd') { if (m.cmd === 'next') next(); else if (m.cmd === 'prev') prev(); } };

  let typed = '';
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (!$('overview').hidden) { if (k === 'Escape' || k === 'g' || k === 'G') overview(false); return; }
    if (/^\d$/.test(k)) { typed += k; return; }
    if (k === 'Enter' && typed) { show(parseInt(typed, 10) - 1); typed = ''; return; }
    typed = '';
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); prev(); }
    else if (k === 'Home') show(0); else if (k === 'End') show(N - 1);
    else if (k === 'f' || k === 'F') full(); else if (k === 'g' || k === 'G') overview(); else if (k === 'n' || k === 'N') notes();
    else if (k === 'p' || k === 'P') presenter(); else if (k === 'b' || k === 'B' || k === '.') document.body.classList.toggle('blackout');
    else if (k === 'Escape') { if (!$('notes').hidden) notes(); else if (!document.fullscreenElement || EMBED) back(); }
  });
  wrap.addEventListener('click', e => { if (e.clientX < innerWidth * .22) prev(); else next(); });
  let tx = 0, ty = 0;
  wrap.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  wrap.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) next(); else prev(); } });
  let idle = 0; const wake = () => { document.body.classList.remove('idle'); clearTimeout(idle); idle = setTimeout(() => document.body.classList.add('idle'), 2600); };
  addEventListener('mousemove', wake); addEventListener('touchstart', wake, { passive: true }); wake();
})();
