/* TAESTEP 슬라이드 엔진 — 교안(JSON)을 화면으로 그린다
   교안 = { title, theme, transition, org, footer, slides: [ { id, layout, kicker, title, subtitle, body, items[], image, bg, notes, time, source, build } ] }
   글 안의 *강조* 는 강조색으로, 줄바꿈은 그대로 줄바꿈으로 나온다. */
'use strict';
const TS = (() => {
  const E = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const F = s => E(s).replace(/\*([^*\n]+)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');
  const pad = n => String(n).padStart(2, '0');
  const MARK = '<svg viewBox="0 0 34 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><rect x="1.5" y="14.5" width="9" height="6" rx="1.4"/><rect x="12.5" y="9" width="9" height="6" rx="1.4"/><rect x="23.5" y="3.5" width="9" height="6" rx="1.4" stroke="var(--accent, #4DEBFF)"/></svg>';
  const STAIRS = '<svg viewBox="0 0 520 360" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><rect x="6" y="236" width="150" height="100" rx="14"/><rect x="184" y="132" width="150" height="100" rx="14"/><rect x="362" y="28" width="150" height="100" rx="14" stroke="var(--accent)" stroke-width="5"/></svg>';

  /* 장 유형: 편집기가 이 표를 보고 입력 칸을 만든다 (f = 쓰는 칸, it = 항목 한 줄의 칸) */
  const LAYOUTS = {
    cover: { name: '표지', f: ['kicker', 'title', 'subtitle', 'meta'], tone: 'left', dim: .62 },
    section: { name: '장 구분', f: ['k', 'kicker', 'title', 'subtitle'], tone: 'left', dim: .66 },
    statement: { name: '한 문장', f: ['kicker', 'title', 'subtitle'], tone: 'left', dim: .7 },
    bullets: { name: '항목', f: ['kicker', 'title', 'subtitle', 'items', 'source'], it: ['t', 'd'], build: true, max: 5, tone: 'full', dim: .82 },
    stat: { name: '숫자', f: ['kicker', 'title', 'subtitle', 'items', 'source'], it: ['k', 'v', 'u', 't', 'd'], build: true, max: 4, tone: 'full', dim: .8 },
    cards: { name: '카드', f: ['kicker', 'title', 'subtitle', 'items', 'source'], it: ['k', 't', 'd'], build: true, max: 4, tone: 'full', dim: .8 },
    split: { name: '글 + 그림', f: ['kicker', 'title', 'body', 'items', 'image', 'side', 'source'], it: ['t', 'd'], max: 5, tone: 'full', dim: .86 },
    steps: { name: '단계(계단)', f: ['kicker', 'title', 'subtitle', 'items', 'source'], it: ['t', 'd'], build: true, max: 5, tone: 'full', dim: .82 },
    compare: { name: '비교', f: ['kicker', 'title', 'subtitle', 'items', 'source'], it: ['k', 't', 'd'], max: 2, tone: 'full', dim: .82 },
    agenda: { name: '진행 순서', f: ['kicker', 'title', 'subtitle', 'items'], it: ['k', 't', 'd'], max: 6, tone: 'full', dim: .84 },
    table: { name: '표', f: ['kicker', 'title', 'subtitle', 'body', 'source'], tone: 'full', dim: .86 },
    quote: { name: '인용', f: ['title', 'subtitle'], tone: 'full', dim: .76 },
    photo: { name: '사진', f: ['kicker', 'title', 'subtitle', 'source'], tone: 'bottom', dim: .55 },
    closing: { name: '마무리', f: ['kicker', 'title', 'subtitle', 'items', 'meta'], it: ['t'], max: 4, tone: 'full', dim: .72 },
  };
  const FIELD_LABEL = { k: '번호', kicker: '머리말(작은 글)', title: '제목', subtitle: '부제 · 설명', body: '본문', meta: '아래 정보', items: '항목', image: '그림', side: '그림 위치', source: '출처' };
  const ITEM_LABEL = { k: '꼬리표', v: '숫자', u: '단위', t: '제목', d: '설명' };
  const MOTIONS = { 'zoom-in': '천천히 다가가기', 'zoom-out': '천천히 물러나기', 'pan-left': '왼쪽으로 흐르기', 'pan-right': '오른쪽으로 흐르기', rise: '위로 떠오르기', none: '움직임 없음' };
  const TONES = { left: '왼쪽을 어둡게', right: '오른쪽을 어둡게', bottom: '아래를 어둡게', full: '전체를 고르게', none: '덮지 않음' };
  const THEMES = { midnight: '미드나잇 (남색 · 청록)', ember: '엠버 (검정 · 주황)', paper: '페이퍼 (흰색 · 남색)' };

  const cssUrl = src => /^data:/.test(src) ? src : encodeURI(src).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
  const isVideo = src => /\.(mp4|webm)(\?|$)/i.test(src || '');

  function bgHtml(s, L, deck) {
    const own = s.bg || {}; const base = (deck && deck.bg) || {}; const fall = !own.src && !!base.src && !own.off; // 그림 없는 장에는 교안 기본 배경
    const b = fall ? Object.assign({}, base, { tone: 'full', dim: Math.max(base.dim == null ? .86 : base.dim, L.dim) }) : own; const src = b.src || '';
    const tone = b.tone || L.tone; const dim = b.dim == null ? L.dim : b.dim; const mo = b.motion || 'zoom-in';
    let img = '';
    if (src && isVideo(src)) img = `<video class="ts-bg-img" src="${E(src)}" muted loop playsinline preload="metadata"></video>`;
    else if (src) img = `<div class="ts-bg-img kb-${E(mo)}" style="background-image:url('${cssUrl(src)}');background-position:${E(b.pos || 'center')}"></div>`;
    return `<div class="ts-bg">${img}<div class="ts-bg-shade tone-${E(src ? tone : 'none')}" style="--dim:${+dim}"></div><div class="ts-bg-fx"></div></div>`;
  }
  function head(s, c, tag) {
    return `<header class="ts-head">${s.kicker ? `<div class="ts-kicker in" style="--i:${c.i++}"><i></i><span>${F(s.kicker)}</span></div>` : ''}`
      + (s.title ? `<${tag || 'h2'} class="ts-title in" style="--i:${c.i++}">${F(s.title)}</${tag || 'h2'}>` : '')
      + (s.subtitle ? `<p class="ts-lead in" style="--i:${c.i++}">${F(s.subtitle)}</p>` : '') + '</header>';
  }
  /* 항목이 차례로 나오는 장: 클릭마다 하나씩(build) 또는 들어올 때 차례로 */
  const stepAttr = (s, L, c, idx, st = '') => (L.build && s.build !== false) ? `data-step="${idx + 1}"${st ? ` style="${st}"` : ''}` : `style="${st}--i:${c.i++}"`;
  const stepCls = (s, L) => (L.build && s.build !== false) ? '' : ' in';
  const items = (s, L) => (Array.isArray(s.items) ? s.items : []).filter(x => x && (x.t || x.d || x.v || x.k)).slice(0, L.max || 9);
  const num = v => { const m = String(v == null ? '' : v).trim(); return /^[\d,]+(\.\d+)?$/.test(m) ? `<span data-count="${E(m)}">${E(m)}</span>` : F(m); };
  const wrap = inner => `<div class="ts-main"><div class="ts-fit">${inner}</div></div>`;

  const R = {
    cover(s, c, d) {
      const meta = String(s.meta || '').split(/\n|\s\|\s/).map(x => x.trim()).filter(Boolean);
      return `<div class="ts-org in" style="--i:${c.i++}"><span class="ts-mark">${MARK}</span><span>${F(d.org || '')}</span></div>` + head(s, c, 'h1')
        + (meta.length ? `<div class="ts-meta in" style="--i:${c.i++}">${meta.map(m => { const k = m.match(/^([^:：]{1,12})[:：]\s*(.+)$/); return k ? `<span>${F(k[1])} &nbsp;<b>${F(k[2])}</b></span>` : `<span><b>${F(m)}</b></span>`; }).join('')}</div>` : '');
    },
    section(s, c) {
      return `<div class="ts-stairs in" style="--i:${c.i + 3}">${STAIRS}</div>` + (s.k ? `<div class="ts-num in" style="--i:${c.i++}">${F(s.k)}</div>` : '') + head(s, c);
    },
    statement(s, c) { return head(s, c); },
    bullets(s, c, d, L) {
      return head(s, c) + wrap(`<ul class="ts-list">${items(s, L).map((x, i) => `<li class="ts-item${stepCls(s, L)}" ${stepAttr(s, L, c, i)}><span class="n">${pad(i + 1)}</span><div><div class="t">${F(x.t)}</div>${x.d ? `<div class="d">${F(x.d)}</div>` : ''}</div></li>`).join('')}</ul>`);
    },
    stat(s, c, d, L) {
      const a = items(s, L);
      return head(s, c) + wrap(`<div class="ts-stats" style="--n:${a.length || 1}">${a.map((x, i) => `<div class="ts-stat ts-card${stepCls(s, L)}" ${stepAttr(s, L, c, i)}>${x.k ? `<div class="k">${F(x.k)}</div>` : ''}<div class="v">${num(x.v)}${x.u ? `<small>${F(x.u)}</small>` : ''}</div>${x.t ? `<div class="t">${F(x.t)}</div>` : ''}${x.d ? `<div class="d">${F(x.d)}</div>` : ''}</div>`).join('')}</div>`);
    },
    cards(s, c, d, L) {
      const a = items(s, L);
      return head(s, c) + wrap(`<div class="ts-cards" style="--n:${a.length || 1}">${a.map((x, i) => `<div class="ts-cardi ts-card${stepCls(s, L)}" ${stepAttr(s, L, c, i)}>${x.k ? `<div class="k">${F(x.k)}</div>` : ''}<div class="t">${F(x.t)}</div>${x.d ? `<div class="d">${F(x.d)}</div>` : ''}</div>`).join('')}</div>`);
    },
    split(s, c, d, L) {
      const a = items(s, L); const im = s.image || {};
      const text = `<div class="ts-col">${head(s, c)}${s.body ? `<p class="ts-text in" style="--i:${c.i++}">${F(s.body)}</p>` : ''}${a.length ? `<ul class="ts-points">${a.map(x => `<li class="in" style="--i:${c.i++}"><b>${F(x.t)}</b>${x.d ? ` <span>— ${F(x.d)}</span>` : ''}</li>`).join('')}</ul>` : ''}</div>`;
      const pic = `<figure class="ts-pic in" style="--i:${c.i++};margin:0">${im.src ? `<div style="background-image:url('${cssUrl(im.src)}');background-position:${E(im.pos || 'center')}"></div>` : ''}${im.caption ? `<figcaption>${F(im.caption)}</figcaption>` : ''}</figure>`;
      return text + pic;
    },
    steps(s, c, d, L) {
      const a = items(s, L); const lift = a.length > 4 ? 40 : 52;
      return head(s, c) + wrap(`<div class="ts-steps" style="--n:${a.length || 1};--lift:${lift}px">${a.map((x, i) => `<div class="ts-step ts-card${i === a.length - 1 ? ' last' : ''}${stepCls(s, L)}" ${stepAttr(s, L, c, i, `--idx:${i};`)}><div class="n">STEP ${pad(i + 1)}</div><div class="t">${F(x.t)}</div>${x.d ? `<div class="d">${F(x.d)}</div>` : ''}</div>`).join('')}</div>`);
    },
    compare(s, c, d, L) {
      const a = items(s, L);
      return head(s, c) + wrap(`<div class="ts-cmp">${a.map((x, i) => `<div class="ts-side ts-card in ${i ? 'b' : 'a'}" style="--i:${c.i++}">${x.k ? `<div class="k">${F(x.k)}</div>` : ''}<div class="t">${F(x.t)}</div><ul>${String(x.d || '').split('\n').filter(l => l.trim()).map(l => `<li>${F(l.trim())}</li>`).join('')}</ul></div>`).join('')}</div>`);
    },
    agenda(s, c, d, L) {
      return head(s, c) + wrap(`<div class="ts-rows">${items(s, L).map((x, i) => `<div class="ts-row in" style="--i:${c.i++}"><span class="k">${F(x.k || pad(i + 1))}</span><span class="dot"></span><div><div class="t">${F(x.t)}</div>${x.d ? `<div class="d">${F(x.d)}</div>` : ''}</div></div>`).join('')}</div>`);
    },
    table(s, c) {
      const rows = String(s.body || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => l.split('|').map(x => x.trim()));
      const hd = rows.shift() || [];
      return head(s, c) + wrap(`<table class="ts-card in" style="--i:${c.i++}"><thead><tr>${hd.map(x => `<th>${F(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(x => `<td>${F(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    },
    quote(s, c) {
      return `<div class="ts-q in" style="--i:${c.i++}">“</div><h2 class="ts-title in" style="--i:${c.i++}">${F(s.title)}</h2>${s.subtitle ? `<div class="ts-by in" style="--i:${c.i++}">${F(s.subtitle)}</div>` : ''}`;
    },
    photo(s, c) { return head(s, c); },
    closing(s, c, d, L) {
      const a = items(s, L);
      return head(s, c) + (a.length ? `<div class="ts-chips" style="--n:${a.length === 4 ? 2 : Math.min(3, a.length)}">${a.map((x, i) => `<div class="ts-chip ts-card in" style="--i:${c.i++}"><span class="n">${pad(i + 1)}</span><span>${F(x.t)}</span></div>`).join('')}</div>` : '')
        + (s.meta ? `<div class="ts-meta in" style="--i:${c.i++}">${F(s.meta)}</div>` : '');
    },
  };

  function slideEl(deck, s, i, total) {
    const lay = R[s.layout] ? s.layout : 'bullets'; const L = LAYOUTS[lay];
    const el = document.createElement('section');
    const hasImg = !!((s.bg && s.bg.src) || (deck.bg && deck.bg.src && !(s.bg && s.bg.off)));
    el.className = `ts-slide L-${lay} T-${THEMES[deck.theme] ? deck.theme : 'midnight'}${hasImg ? ' has-img' : ''}${lay === 'split' && s.side === 'left' ? ' side-left' : ''}`;
    el.dataset.id = s.id || ''; el.dataset.index = i;
    if (deck.accent) el.style.setProperty('--accent', deck.accent);
    const c = { i: 0 };
    el.innerHTML = bgHtml(s, L, deck) + `<div class="ts-body">${R[lay](s, c, deck, L)}</div>`
      + (s.source ? `<div class="ts-source">${F(s.source)}</div>` : '')
      + `<footer class="ts-foot"><span class="ts-mark">${MARK}</span><span class="ts-foot-t">${E(deck.footer || deck.title || '')}</span><span class="ts-foot-n">${pad(i + 1)}<b>/</b>${pad(total)}</span></footer><div class="ts-prog" style="width:${(i + 1) / total * 100}%"></div>`;
    return el;
  }
  /* 내용이 넘치면 본문만 줄여서 한 장 안에 넣는다 (화면에 붙은 뒤에 불러야 함) */
  function fit(el) {
    const main = el.querySelector('.ts-main'), box = el.querySelector('.ts-fit'); if (!main || !box) return;
    box.style.zoom = ''; let z = 1;
    while (z > .56 && box.scrollHeight * z > main.clientHeight + 2) { z -= .04; box.style.zoom = z; if (box.offsetHeight <= main.clientHeight + 2) break; }
  }
  /* 작은 그림 한 장 (목록·편집 미리보기용) */
  function thumb(deck, s, i, total, host) {
    host.classList.add('ts-thumb'); host.innerHTML = '';
    const el = slideEl(deck, s, i, total); host.appendChild(el);
    const apply = () => { const w = host.clientWidth; if (w) el.style.transform = `scale(${w / 1920})`; };
    apply(); fit(el);
    if (window.ResizeObserver) { if (host._ro) host._ro.disconnect(); host._ro = new ResizeObserver(apply); host._ro.observe(host); }
    return el;
  }
  function countUp(root) {
    root.querySelectorAll('[data-count]').forEach(n => {
      const raw = n.dataset.count; const dec = (raw.split('.')[1] || '').length; const comma = raw.includes(','); const to = parseFloat(raw.replace(/,/g, ''));
      if (!isFinite(to) || n._done) return; n._done = true;
      const fmt = v => { const t = v.toFixed(dec); return comma ? t.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : t; };
      const t0 = performance.now(), dur = 1100;
      const tick = t => { const p = Math.min(1, (t - t0) / dur); n.textContent = fmt(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); else n.textContent = raw; };
      requestAnimationFrame(tick);
    });
  }
  const uid = () => Math.random().toString(36).slice(2, 10);
  const blank = (layout) => {
    const L = LAYOUTS[layout] || LAYOUTS.bullets; const s = { id: uid(), layout: LAYOUTS[layout] ? layout : 'bullets', title: '제목을 입력하세요', notes: '' };
    if (L.it) s.items = Array.from({ length: Math.min(3, L.max || 3) }, (_, i) => { const o = {}; L.it.forEach(k => o[k] = k === 't' ? '항목 ' + (i + 1) : k === 'v' ? '0' : ''); return o; });
    return s;
  };
  return { E, F, pad, MARK, LAYOUTS, FIELD_LABEL, ITEM_LABEL, MOTIONS, TONES, THEMES, slideEl, fit, thumb, countUp, uid, blank, isVideo };
})();
