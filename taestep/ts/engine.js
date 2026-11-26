/* TAESTEP 슬라이드 엔진 — 교안(JSON)을 화면으로 그린다
   교안 = { title, theme, transition, org, footer, bg, slides: [ { id, layout, kicker, title, subtitle, body, items[], image, bg, notes, time, source, build, els[] } ] }
   · 장 유형(layout)의 칸: 글 안의 *강조* 는 강조색, 줄바꿈은 그대로 줄바꿈.
   · 자유 요소(els): 어느 장에나 얹을 수 있는 글상자 · 그림 · 도형 · 선 · 아이콘 · 표 · 차트. 좌표는 1920×1080 기준.
     색은 테마 이름표(title · fg · muted · accent · ink · bg2 · card · line)나 #색 — 이름표로 두면 테마를 바꿀 때 함께 바뀐다. */
'use strict';
const TS = (() => {
  const E = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const F = s => E(s).replace(/\*([^*\n]+)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');
  const pad = n => String(n).padStart(2, '0');
  const MARK = '<svg viewBox="0 0 34 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><rect x="1.5" y="14.5" width="9" height="6" rx="1.4"/><rect x="12.5" y="9" width="9" height="6" rx="1.4"/><rect x="23.5" y="3.5" width="9" height="6" rx="1.4" stroke="var(--accent, #4DEBFF)"/></svg>';
  const STAIRS = '<svg viewBox="0 0 520 360" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><rect x="6" y="236" width="150" height="100" rx="14"/><rect x="184" y="132" width="150" height="100" rx="14"/><rect x="362" y="28" width="150" height="100" rx="14" stroke="var(--accent)" stroke-width="5"/></svg>';

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
    free: { name: '빈 장(자유 배치)', f: ['source'], tone: 'full', dim: .8 },
  };
  const FIELD_LABEL = { k: '번호', kicker: '머리말(작은 글)', title: '제목', subtitle: '부제 · 설명', body: '본문', meta: '아래 정보', items: '항목', image: '그림', side: '그림 위치', source: '출처' };
  const ITEM_LABEL = { k: '꼬리표', v: '숫자', u: '단위', t: '제목', d: '설명' };
  const MOTIONS = { 'zoom-in': '천천히 다가가기', 'zoom-out': '천천히 물러나기', 'pan-left': '왼쪽으로 흐르기', 'pan-right': '오른쪽으로 흐르기', rise: '위로 떠오르기', fall: '아래로 내려가기', none: '움직임 없음' };
  /* 모션: 요소가 나타나는 효과 · 강조 · 사라지는 효과 · 장 넘김 */
  const ANIMS = { rise: '아래에서 떠오르기', fade: '서서히 나타나기', drop: '위에서 내려오기', left: '왼쪽에서', right: '오른쪽에서', zoom: '커지며 나타나기', pop: '튀어나오기', wipe: '닦아내듯', blur: '흐림에서 선명하게', flip: '넘기듯', none: '효과 없이 바로' };
  const EMPHS = { pulse: '두근(커졌다 돌아옴)', shake: '흔들기', glow: '빛나기', blink: '깜빡임' };
  const EXITS = { fade: '서서히 사라지기', fall: '아래로 떨어지기', zoom: '작아지며 사라지기', none: '바로 사라지기' };
  const TRANSITIONS = { fade: '부드럽게 겹치기', slide: '옆으로 밀어내기', up: '위로 밀어 올리기', cover: '옆에서 덮기', wipe: '닦아내기', zoom: '다가오며 나타나기', blur: '흐려졌다 선명하게', morph: '모핑 (같은 요소가 이동 · 변형)', none: '효과 없음' };
  const TONES = { left: '왼쪽을 어둡게', right: '오른쪽을 어둡게', bottom: '아래를 어둡게', full: '전체를 고르게', none: '덮지 않음' };
  const THEMES = { paper: '페이퍼 (흰색 · 남색) — 기본', midnight: '미드나잇 (남색 · 청록)', ember: '엠버 (검정 · 주황)' };
  const themeOf = deck => THEMES[deck && deck.theme] ? deck.theme : 'paper'; // 테마를 정하지 않은 교안은 밝은 테마
  /* 테마 색(engine.css 와 같은 값) — PPTX 내보내기처럼 CSS 를 못 쓰는 곳에서 쓴다 */
  const PALETTE = {
    midnight: { title: '#FFFFFF', fg: '#EAF0F8', muted: '#93A4BC', accent: '#4DEBFF', ink: '#04121F', bg: '#06101E', bg2: '#0B1B33', shade: [6, 16, 30] },
    ember: { title: '#FFFFFF', fg: '#F2ECE6', muted: '#A99C92', accent: '#FF7A29', ink: '#1A0B02', bg: '#0A0A0D', bg2: '#18110E', shade: [10, 10, 13] },
    paper: { title: '#0B1B33', fg: '#1B2A41', muted: '#5C6C84', accent: '#0E5FD8', ink: '#FFFFFF', bg: '#F4F6FA', bg2: '#FFFFFF', shade: [244, 246, 250] },
  };
  const palette = deck => Object.assign({}, PALETTE[themeOf(deck)], deck.accent ? { accent: deck.accent } : {});
  const TOKENS = { title: '--title', fg: '--fg', muted: '--muted', accent: '--accent', ink: '--accent-ink', bg2: '--bg2', bg: '--bg', card: '--card', line: '--line' };
  const col = v => !v || v === 'none' ? 'transparent' : TOKENS[v] ? `var(${TOKENS[v]})` : /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(v) ? v : 'transparent';

  const cssUrl = src => /^data:/.test(src) ? src : encodeURI(src).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
  const isVideo = src => /\.(mp4|webm)(\?|$)/i.test(src || '');
  const POS = { center: [50, 50], top: [50, 0], bottom: [50, 100], left: [0, 50], right: [100, 50] };
  const bgPos = b => b.px != null || b.py != null ? `${b.px == null ? 50 : +b.px}% ${b.py == null ? 50 : +b.py}%` : (POS[b.pos] || POS.center).join('% ') + '%';

  /* 그림 없는 장에는 교안 기본 배경을 어둡게 깐다 */
  function bgOf(s, L, deck) {
    const own = s.bg || {}; const base = (deck && deck.bg) || {}; const fall = !own.src && !!base.src && !own.off;
    const b = fall ? Object.assign({}, base, { tone: 'full', dim: Math.max(base.dim == null ? .86 : base.dim, L.dim) }) : own;
    return { src: b.src || '', tone: b.src ? (b.tone || L.tone) : 'none', dim: b.dim == null ? L.dim : +b.dim, motion: b.motion || 'zoom-in', pos: bgPos(b), zoom: Math.max(1, +b.zoom || 1), speed: Math.max(.25, Math.min(4, +b.speed || 1)), amt: Math.max(.2, Math.min(2.5, +b.amt || 1)) };
  }
  function bgHtml(s, L, deck) {
    const g = bgOf(s, L, deck); let img = '';
    if (g.src && isVideo(g.src)) img = `<video class="ts-bg-img" src="${E(g.src)}" muted loop playsinline preload="metadata"></video>`;
    else if (g.src) img = `<div class="ts-bg-zoom" style="transform:scale(${g.zoom});transform-origin:${g.pos}"><div class="ts-bg-img kb-${E(g.motion)}" style="background-image:url('${cssUrl(g.src)}');background-position:${g.pos};--kb-dur:${Math.round(300 / g.speed) / 10}s;--kb-amt:${g.amt}"></div></div>`;
    return `<div class="ts-bg">${img}<div class="ts-bg-shade tone-${E(g.tone)}" style="--dim:${g.dim}"></div><div class="ts-bg-fx"></div></div>`;
  }
  /* data-f = 이 글이 교안의 어느 칸인지 (편집 화면에서 더블클릭하면 그 자리에서 고침) · data-fp = 오른쪽 칸에서 고치는 것 */
  const A = p => ` data-f="${p}"`;
  function head(s, c, tag) {
    return `<header class="ts-head">${s.kicker ? `<div class="ts-kicker in" style="--i:${c.i++}"><i></i><span${A('kicker')}>${F(s.kicker)}</span></div>` : ''}`
      + (s.title ? `<${tag || 'h2'} class="ts-title in" style="--i:${c.i++}"${A('title')}>${F(s.title)}</${tag || 'h2'}>` : '')
      + (s.subtitle ? `<p class="ts-lead in" style="--i:${c.i++}"${A('subtitle')}>${F(s.subtitle)}</p>` : '') + '</header>';
  }
  const stepAttr = (s, L, c, idx, st = '') => (L.build && s.build !== false) ? `data-step="${idx + 1}"${st ? ` style="${st}"` : ''}` : `style="${st}--i:${c.i++}"`;
  const stepCls = (s, L) => (L.build && s.build !== false) ? '' : ' in';
  const items = (s, L) => (Array.isArray(s.items) ? s.items : []).map((x, i) => ({ x, i })).filter(o => o.x && (o.x.t || o.x.d || o.x.v || o.x.k)).slice(0, L.max || 9);
  const num = v => { const m = String(v == null ? '' : v).trim(); return /^[\d,]+(\.\d+)?$/.test(m) ? `<span data-count="${E(m)}">${E(m)}</span>` : F(m); };
  const wrap = inner => `<div class="ts-main"><div class="ts-fit">${inner}</div></div>`;
  const P = (cls, i, k, v) => v ? `<div class="${cls}"${A(`items.${i}.${k}`)}>${F(v)}</div>` : '';

  const R = {
    cover(s, c, d) {
      const meta = String(s.meta || '').split(/\n|\s\|\s/).map(x => x.trim()).filter(Boolean);
      return `<div class="ts-org in" style="--i:${c.i++}"><span class="ts-mark">${MARK}</span><span>${F(d.org || '')}</span></div>` + head(s, c, 'h1')
        + (meta.length ? `<div class="ts-meta in" data-fp="meta" style="--i:${c.i++}">${meta.map(m => { const k = m.match(/^([^:：]{1,12})[:：]\s*(.+)$/); return k ? `<span>${F(k[1])} &nbsp;<b>${F(k[2])}</b></span>` : `<span><b>${F(m)}</b></span>`; }).join('')}</div>` : '');
    },
    section(s, c) { return `<div class="ts-stairs in" style="--i:${c.i + 3}">${STAIRS}</div>` + (s.k ? `<div class="ts-num in" style="--i:${c.i++}"${A('k')}>${F(s.k)}</div>` : '') + head(s, c); },
    statement(s, c) { return head(s, c); },
    bullets(s, c, d, L) {
      return head(s, c) + wrap(`<ul class="ts-list">${items(s, L).map(({ x, i }, n) => `<li class="ts-item${stepCls(s, L)}" ${stepAttr(s, L, c, n)}><span class="n">${pad(n + 1)}</span><div>${P('t', i, 't', x.t)}${P('d', i, 'd', x.d)}</div></li>`).join('')}</ul>`);
    },
    stat(s, c, d, L) {
      const a = items(s, L);
      return head(s, c) + wrap(`<div class="ts-stats" style="--n:${a.length || 1}">${a.map(({ x, i }, n) => `<div class="ts-stat ts-card${stepCls(s, L)}" ${stepAttr(s, L, c, n)}>${P('k', i, 'k', x.k)}<div class="v"><span data-fp="items.${i}.v">${num(x.v)}</span>${x.u ? `<small${A(`items.${i}.u`)}>${F(x.u)}</small>` : ''}</div>${P('t', i, 't', x.t)}${P('d', i, 'd', x.d)}</div>`).join('')}</div>`);
    },
    cards(s, c, d, L) {
      const a = items(s, L);
      return head(s, c) + wrap(`<div class="ts-cards" style="--n:${a.length || 1}">${a.map(({ x, i }, n) => `<div class="ts-cardi ts-card${stepCls(s, L)}" ${stepAttr(s, L, c, n)}>${P('k', i, 'k', x.k)}${P('t', i, 't', x.t)}${P('d', i, 'd', x.d)}</div>`).join('')}</div>`);
    },
    split(s, c, d, L) {
      const a = items(s, L); const im = s.image || {};
      const text = `<div class="ts-col">${head(s, c)}${s.body ? `<p class="ts-text in" style="--i:${c.i++}"${A('body')}>${F(s.body)}</p>` : ''}${a.length ? `<ul class="ts-points">${a.map(({ x, i }) => `<li class="in" style="--i:${c.i++}"><b${A(`items.${i}.t`)}>${F(x.t)}</b>${x.d ? ` <span>— <span${A(`items.${i}.d`)}>${F(x.d)}</span></span>` : ''}</li>`).join('')}</ul>` : ''}</div>`;
      const pic = `<figure class="ts-pic in" data-fp="image" style="--i:${c.i++};margin:0">${im.src ? imgInner(im) : ''}${im.caption ? `<figcaption>${F(im.caption)}</figcaption>` : ''}</figure>`;
      return text + pic;
    },
    steps(s, c, d, L) {
      const a = items(s, L); const lift = a.length > 4 ? 40 : 52;
      return head(s, c) + wrap(`<div class="ts-steps" style="--n:${a.length || 1};--lift:${lift}px">${a.map(({ x, i }, n) => `<div class="ts-step ts-card${n === a.length - 1 ? ' last' : ''}${stepCls(s, L)}" ${stepAttr(s, L, c, n, `--idx:${n};`)}><div class="n">STEP ${pad(n + 1)}</div>${P('t', i, 't', x.t)}${P('d', i, 'd', x.d)}</div>`).join('')}</div>`);
    },
    compare(s, c, d, L) {
      return head(s, c) + wrap(`<div class="ts-cmp">${items(s, L).map(({ x, i }, n) => `<div class="ts-side ts-card in ${n ? 'b' : 'a'}" style="--i:${c.i++}">${P('k', i, 'k', x.k)}${P('t', i, 't', x.t)}<ul data-fp="items.${i}.d">${String(x.d || '').split('\n').filter(l => l.trim()).map(l => `<li>${F(l.trim())}</li>`).join('')}</ul></div>`).join('')}</div>`);
    },
    agenda(s, c, d, L) {
      return head(s, c) + wrap(`<div class="ts-rows">${items(s, L).map(({ x, i }, n) => `<div class="ts-row in" style="--i:${c.i++}"><span class="k"${A(`items.${i}.k`)}>${F(x.k || pad(n + 1))}</span><span class="dot"></span><div>${P('t', i, 't', x.t)}${P('d', i, 'd', x.d)}</div></div>`).join('')}</div>`);
    },
    table(s, c) {
      const rows = String(s.body || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => l.split('|').map(x => x.trim()));
      const hd = rows.shift() || [];
      return head(s, c) + wrap(`<table class="ts-card in" data-fp="body" style="--i:${c.i++}"><thead><tr>${hd.map(x => `<th>${F(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(x => `<td>${F(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    },
    quote(s, c) { return `<div class="ts-q in" style="--i:${c.i++}">“</div><h2 class="ts-title in" style="--i:${c.i++}"${A('title')}>${F(s.title)}</h2>${s.subtitle ? `<div class="ts-by in" style="--i:${c.i++}"${A('subtitle')}>${F(s.subtitle)}</div>` : ''}`; },
    photo(s, c) { return head(s, c); },
    closing(s, c, d, L) {
      const a = items(s, L);
      return head(s, c) + (a.length ? `<div class="ts-chips" style="--n:${a.length === 4 ? 2 : Math.min(3, a.length)}">${a.map(({ x, i }, n) => `<div class="ts-chip ts-card in" style="--i:${c.i++}"><span class="n">${pad(n + 1)}</span><span${A(`items.${i}.t`)}>${F(x.t)}</span></div>`).join('')}</div>` : '')
        + (s.meta ? `<div class="ts-meta in" style="--i:${c.i++}"${A('meta')}>${F(s.meta)}</div>` : '');
    },
    free() { return ''; },
  };

  /* ---------- 자유 요소 ---------- */
  /* 글상자 안의 서식: 정해 둔 태그 · 꾸밈만 남긴다 (붙여넣은 글에 섞여 온 것을 걸러 냄) */
  const OK_TAG = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, MARK: 1, SPAN: 1, BR: 1, DIV: 1, P: 1, UL: 1, OL: 1, LI: 1, FONT: 1, SMALL: 1 };
  const OK_CSS = ['color', 'background-color', 'font-size', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line'];
  function clean(html) {
    const t = document.createElement('template'); t.innerHTML = String(html || '');
    const walk = n => {
      [...n.childNodes].forEach(ch => {
        if (ch.nodeType === 3) return; if (ch.nodeType !== 1) { ch.remove(); return; }
        if (!OK_TAG[ch.tagName]) { if (/^(SCRIPT|STYLE|IFRAME|OBJECT|SVG|IMG|LINK|META|TITLE)$/i.test(ch.tagName)) { ch.remove(); return; } walk(ch); ch.replaceWith(...ch.childNodes); return; }
        const keep = {}; OK_CSS.forEach(k => { const v = ch.style && ch.style.getPropertyValue(k); if (v && !/url|expression/i.test(v)) keep[k] = v; });
        const fc = ch.tagName === 'FONT' && ch.getAttribute('color');
        [...ch.attributes].forEach(a => ch.removeAttribute(a.name));
        Object.entries(keep).forEach(([k, v]) => ch.style.setProperty(k, v)); if (fc) ch.style.color = fc;
        walk(ch);
      });
    };
    walk(t.content); return t.innerHTML;
  }
  const SHAPES = { rect: '사각형', round: '둥근 사각형', ellipse: '원', card: '카드(유리)', triangle: '삼각형', diamond: '마름모', hexagon: '육각형', pentagon: '오각형', star: '별', arrow: '화살 블록', chevron: '갈매기', speech: '말풍선' };
  const POLY = {
    triangle: '50,0 100,100 0,100', diamond: '50,0 100,50 50,100 0,50', hexagon: '25,0 75,0 100,50 75,100 25,100 0,50', pentagon: '50,0 100,38 81,100 19,100 0,38',
    star: '50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35', arrow: '0,28 60,28 60,0 100,50 60,100 60,72 0,72', chevron: '0,0 72,0 100,50 72,100 0,100 28,50', speech: '0,0 100,0 100,74 46,74 24,100 26,74 0,74',
  };
  const MASKS = { none: '없음', round: '둥근 모서리', circle: '원', hexagon: '육각형', arch: '아치', diamond: '마름모' };
  const MASK_CSS = { circle: 'border-radius:50%;', arch: 'border-radius:999px 999px 0 0;', hexagon: 'clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%);', diamond: 'clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);' };
  const CHARTS = { bar: '세로 막대', hbar: '가로 막대', line: '꺾은선', pie: '원형', donut: '도넛' };
  /* 그림 자르기: 틀(요소 크기) 안에서 zoom 배 확대하고 (px, py)% 지점을 보여 준다 */
  function imgInner(im) {
    const z = Math.max(1, +im.zoom || 1), px = im.px == null ? 50 : +im.px, py = im.py == null ? 50 : +im.py;
    const f = [im.br != null && +im.br !== 100 ? `brightness(${+im.br}%)` : '', im.ct != null && +im.ct !== 100 ? `contrast(${+im.ct}%)` : '', im.sat != null && +im.sat !== 100 ? `saturate(${+im.sat}%)` : '', im.gray ? 'grayscale(1)' : ''].filter(Boolean).join(' ');
    return `<img class="ts-img" src="${E(im.src)}" alt="" draggable="false" style="object-position:${px}% ${py}%;transform:scale(${z});transform-origin:${px}% ${py}%;${f ? 'filter:' + f : ''}">`;
  }
  function chartSvg(e) {
    const W = Math.max(60, e.w), H = Math.max(60, e.h), fs = +e.fs || 24, kind = CHARTS[e.kind] ? e.kind : 'bar';
    const data = (e.data || []).map(r => [String(r[0] == null ? '' : r[0]), +String(r[1]).replace(/,/g, '') || 0]).slice(0, 12);
    const max = Math.max(1, ...data.map(d => d[1])); const u = E(e.unit || ''); const fmt = v => (Math.round(v * 100) / 100).toLocaleString('en-US') + u;
    const c = col(e.color || 'accent'); let g = '';
    if (kind === 'bar' || kind === 'line') {
      const top = fs * 1.9, bot = fs * 1.9, ph = H - top - bot, sw = W / Math.max(1, data.length), bw = Math.min(sw * .58, 150);
      g += `<line x1="0" y1="${H - bot}" x2="${W}" y2="${H - bot}" stroke="var(--line)" stroke-width="2"/>`;
      const pts = data.map((d, i) => [sw * i + sw / 2, H - bot - ph * d[1] / max]);
      if (kind === 'line') g += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${c}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`;
      data.forEach((d, i) => {
        const [x, y] = pts[i];
        g += kind === 'bar' ? `<rect x="${x - bw / 2}" y="${y}" width="${bw}" height="${Math.max(0, H - bot - y)}" rx="8" fill="${c}"/>` : `<circle cx="${x}" cy="${y}" r="9" fill="var(--bg)" stroke="${c}" stroke-width="5"/>`;
        if (e.values !== false) g += `<text x="${x}" y="${y - fs * .55}" text-anchor="middle" font-size="${fs}" font-weight="600" fill="var(--title)">${fmt(d[1])}</text>`;
        g += `<text x="${x}" y="${H - bot + fs * 1.35}" text-anchor="middle" font-size="${fs * .86}" fill="var(--muted)">${E(d[0])}</text>`;
      });
    } else if (kind === 'hbar') {
      const lw = Math.min(W * .34, fs * 9), rh = H / Math.max(1, data.length), bh = Math.min(rh * .56, 64), pw = W - lw - fs * 4.5;
      data.forEach((d, i) => {
        const y = rh * i + rh / 2; const w = Math.max(2, pw * d[1] / max);
        g += `<text x="${lw - 16}" y="${y + fs * .34}" text-anchor="end" font-size="${fs * .92}" fill="var(--fg)">${E(d[0])}</text><rect x="${lw}" y="${y - bh / 2}" width="${w}" height="${bh}" rx="8" fill="${c}"/>`;
        if (e.values !== false) g += `<text x="${lw + w + 14}" y="${y + fs * .34}" font-size="${fs}" font-weight="600" fill="var(--title)">${fmt(d[1])}</text>`;
      });
    } else {
      const sum = data.reduce((a, d) => a + d[1], 0) || 1, r = Math.min(H, W * .56) / 2 - 6, cx = r + 6, cy = H / 2, ir = kind === 'donut' ? r * .58 : 0; let a0 = -Math.PI / 2;
      const op = [1, .72, .5, .34, .22, .14, .6, .42, .28, .18, .1, .08];
      data.forEach((d, i) => {
        const a1 = a0 + Math.PI * 2 * d[1] / sum, big = a1 - a0 > Math.PI ? 1 : 0, p = (a, q) => `${cx + q * Math.cos(a)},${cy + q * Math.sin(a)}`;
        g += data.length === 1 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"/>` : `<path d="M${p(a0, r)} A${r},${r} 0 ${big} 1 ${p(a1, r)} L${p(a1, ir)} ${ir ? `A${ir},${ir} 0 ${big} 0 ${p(a0, ir)}` : ''}Z" fill="${c}" opacity="${op[i]}" stroke="var(--bg)" stroke-width="3"/>`;
        const ly = cy - (data.length - 1) * fs * .8 + i * fs * 1.6;
        g += `<rect x="${cx + r + 40}" y="${ly - fs * .62}" width="${fs * .8}" height="${fs * .8}" rx="5" fill="${c}" opacity="${op[i]}"/><text x="${cx + r + 40 + fs * 1.2}" y="${ly + fs * .1}" font-size="${fs * .92}" fill="var(--fg)">${E(d[0])}${e.values !== false ? ` <tspan font-weight="600" fill="var(--title)">${fmt(d[1])}${e.pct ? ` (${Math.round(d[1] / sum * 100)}%)` : ''}</tspan>` : ''}</text>`; a0 = a1;
      });
      if (ir && data.length === 1) g += `<circle cx="${cx}" cy="${cy}" r="${ir}" fill="var(--bg)"/>`;
    }
    return `<svg class="ts-chart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%">${g}</svg>`;
  }
  function elInner(e) {
    if (e.type === 'text') {
      const st = `font-size:${+e.fs || 32}px;color:${col(e.color || 'fg')};text-align:${E(e.align || 'left')};line-height:${+e.lh || 1.4};font-weight:${+e.weight || 400};${e.font === 'mono' ? 'font-family:var(--mono);' : ''}${e.ls ? `letter-spacing:${+e.ls}em;` : ''}${e.outline ? `-webkit-text-stroke:3px ${col(e.color || 'accent')};color:transparent;` : ''}justify-content:${{ middle: 'center', bottom: 'flex-end' }[e.valign] || 'flex-start'};${e.fill ? `background:${col(e.fill)};padding:${+e.pad || 0}px;border-radius:${+e.radius || 0}px;` : ''}`;
      return `<div class="tx" style="${st}"><div class="tx-in">${clean(e.html)}</div></div>`;
    }
    if (e.type === 'image') {
      const m = e.mask || 'none'; const r = m === 'round' ? `border-radius:${e.radius == null ? 24 : +e.radius}px;` : MASK_CSS[m] || '';
      return `<div class="ts-imgbox" style="${r}">${e.src ? imgInner(e) : '<span class="ts-ph">그림을 넣으세요</span>'}${e.stroke && +e.sw && !/clip-path/.test(r) ? `<i style="position:absolute;inset:0;border:${+e.sw}px solid ${col(e.stroke)};border-radius:inherit;pointer-events:none"></i>` : ''}</div>`;
    }
    if (e.type === 'shape') {
      const sh = SHAPES[e.shape] ? e.shape : 'rect';
      const tx = `<div class="tx sh-tx" style="font-size:${+e.fs || 30}px;color:${col(e.color || 'title')};text-align:${E(e.align || 'center')};font-weight:${+e.weight || 600};line-height:${+e.lh || 1.35}"><div class="tx-in">${clean(e.html)}</div></div>`;
      if (POLY[sh]) return `<svg class="ts-shp" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="${POLY[sh]}" fill="${col(e.fill || 'accent')}" stroke="${col(e.stroke)}" stroke-width="${+e.sw || 0}" vector-effect="non-scaling-stroke" stroke-linejoin="round"${e.op != null ? ` opacity="${+e.op}"` : ''}/></svg>${tx}`;
      const rad = sh === 'ellipse' ? '50%' : sh === 'rect' ? '0' : `${e.radius == null ? 22 : +e.radius}px`;
      return `<div class="ts-shp${sh === 'card' ? ' ts-card' : ''}" style="border-radius:${rad};${sh === 'card' ? '' : `background:${col(e.fill || 'accent')};`}${e.stroke && +e.sw ? `border:${+e.sw}px ${e.dash ? 'dashed' : 'solid'} ${col(e.stroke)};` : sh === 'card' ? '' : 'border:0;'}${e.op != null ? `opacity:${+e.op};` : ''}"></div>${tx}`;
    }
    if (e.type === 'line') {
      const w = Math.max(0, e.w), h = Math.max(0, e.h), sw = +e.sw || 4, c = col(e.stroke || 'accent');
      const a0 = e.flip ? [0, h, w, 0] : [0, 0, w, h]; const a = e.rev ? [a0[2], a0[3], a0[0], a0[1]] : a0; const ang = Math.atan2(a[3] - a[1], a[2] - a[0]); const hd = Math.max(14, sw * 4.2);
      const tip = (x, y, dir) => { const b = ang + (dir ? Math.PI : 0); const q = t => `${x - hd * Math.cos(b + t)},${y - hd * Math.sin(b + t)}`; return `<polygon points="${x},${y} ${q(.42)} ${q(-.42)}" fill="${c}"/>`; };
      const cut = (x, y, k) => [x - k * hd * .7 * Math.cos(ang), y - k * hd * .7 * Math.sin(ang)];
      const end = e.arrow === 'end' || e.arrow === 'both'; const p2 = end ? cut(a[2], a[3], 1) : [a[2], a[3]], p1 = e.arrow === 'both' ? cut(a[0], a[1], -1) : [a[0], a[1]];
      return `<svg class="ts-line" xmlns="http://www.w3.org/2000/svg" width="${Math.max(1, w)}" height="${Math.max(1, h)}" style="overflow:visible"><line class="hit" x1="${a[0]}" y1="${a[1]}" x2="${a[2]}" y2="${a[3]}" stroke="transparent" stroke-width="${Math.max(26, sw)}"/><line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"${e.dash ? ` stroke-dasharray="${sw * 2.4} ${sw * 2.2}"` : ''}/>${end ? tip(a[2], a[3], 0) : ''}${e.arrow === 'both' ? tip(a[0], a[1], 1) : ''}</svg>`;
    }
    if (e.type === 'icon') return `<svg class="ts-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${col(e.color || 'accent')}" stroke-width="${+e.sw || 1.75}" stroke-linecap="round" stroke-linejoin="round">${(typeof TS_ICONS !== 'undefined' && TS_ICONS[e.name]) || ''}</svg>`;
    if (e.type === 'table') {
      const rows = Array.isArray(e.rows) ? e.rows : [];
      return `<table class="ts-tbl${e.head !== false ? ' head' : ''}${e.stripe ? ' stripe' : ''}${e.plain ? '' : ' ts-card'}" style="font-size:${+e.fs || 28}px"><tbody>${rows.map((r, ri) => `<tr>${r.map((v, ci) => `<td data-c="${ri},${ci}">${F(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    if (e.type === 'chart') return chartSvg(e);
    return '';
  }
  const elStyle = e => `left:${+e.x || 0}px;top:${+e.y || 0}px;width:${Math.max(0, +e.w || 0)}px;height:${Math.max(0, +e.h || 0)}px;${e.rot ? `rotate:${+e.rot}deg;` : ''}${e.shadow ? 'filter:drop-shadow(0 18px 34px rgba(0,0,0,.45));' : ''}`;
  function elHtml(e, c, opts) {
    if (e.hide && !(opts && opts.edit)) return '';
    const step = Math.max(0, Math.round(+e.step || 0)); const an = ANIMS[e.anim] ? e.anim : 'rise';
    const at = `${step ? ` data-step="${step}"` : ''} data-anim="${an}"${EMPHS[e.emph] ? ` data-emph="${e.emph}"${+e.emphAt > step ? ` data-emph-at="${Math.round(+e.emphAt)}"` : ''}` : ''}${+e.exit > step ? ` data-exit="${Math.round(+e.exit)}" data-exit-anim="${EXITS[e.exitAnim] ? e.exitAnim : 'fade'}"` : ''}`;
    return `<div class="ts-el ts-el-${E(e.type)}${step ? '' : ' in'}${e.hide ? ' is-hidden' : ''}${e.lock ? ' is-locked' : ''}" data-el="${E(e.id)}"${at} style="${elStyle(e)}--dur:${+e.dur > 0 ? +e.dur : .8}s;--delay:${+e.delay > 0 ? +e.delay : 0}s;--i:${c.i++}">${elInner(e)}</div>`;
  }

  function slideEl(deck, s, i, total, opts) {
    const lay = R[s.layout] ? s.layout : 'bullets'; const L = LAYOUTS[lay];
    const el = document.createElement('section');
    const hasImg = !!((s.bg && s.bg.src) || (deck.bg && deck.bg.src && !(s.bg && s.bg.off)));
    el.className = `ts-slide L-${lay} T-${themeOf(deck)}${hasImg ? ' has-img' : ''}${lay === 'split' && s.side === 'left' ? ' side-left' : ''}`;
    el.dataset.id = s.id || ''; el.dataset.index = i; el.dataset.tr = trOf(deck, s);
    if (deck.accent) el.style.setProperty('--accent', deck.accent);
    const c = { i: 0 };
    el.innerHTML = bgHtml(s, L, deck) + `<div class="ts-body">${R[lay](s, c, deck, L)}</div>`
      + `<div class="ts-els">${(Array.isArray(s.els) ? s.els : []).map(e => elHtml(e, c, opts)).join('')}</div>`
      + (s.source ? `<div class="ts-source"${A('source')}>${F(s.source)}</div>` : '')
      + `<footer class="ts-foot"><span class="ts-mark">${MARK}</span><span class="ts-foot-t">${E(deck.footer || deck.title || '')}</span><span class="ts-foot-n">${pad(i + 1)}<b>/</b>${pad(total)}</span></footer><div class="ts-prog" style="width:${(i + 1) / total * 100}%"></div>`;
    return el;
  }
  /* 내용이 넘치면 본문만 줄여서 한 장 안에 넣는다 (화면에 붙은 뒤에 불러야 함) */
  function fit(el) {
    const main = el.querySelector('.ts-main'), box = el.querySelector('.ts-fit'); if (!main || !box) return;
    box.style.zoom = ''; let z = 1;
    while (z > .56 && box.scrollHeight * z > main.clientHeight + 2) { z -= .04; box.style.zoom = z; if (box.offsetHeight <= main.clientHeight + 2) break; }
  }
  /* 작은 그림 한 장 (목록 · 편집 미리보기용). host 안의 다른 것(편집 덧층)은 건드리지 않는다 */
  function thumb(deck, s, i, total, host, opts) {
    host.classList.add('ts-thumb'); host.querySelectorAll(':scope > .ts-slide').forEach(x => x.remove());
    const el = slideEl(deck, s, i, total, opts); host.prepend(el);
    const apply = () => { const x = host.querySelector(':scope > .ts-slide'); const w = host.clientWidth; if (x && w) x.style.transform = `scale(${w / 1920})`; if (host._onResize) host._onResize(); };
    apply(); fit(el);
    if (window.ResizeObserver && !host._ro) { host._ro = new ResizeObserver(apply); host._ro.observe(host); }
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
  const trOf = (deck, s) => TRANSITIONS[s && s.tr] ? s.tr : TRANSITIONS[deck && deck.transition] ? deck.transition : 'fade';
  /* 한 장의 클릭 단계를 다룬다 (발표 화면과 편집 화면의 미리 재생이 함께 씀)
     data-step = 그 클릭에 나타남 · data-emph-at = 그 클릭에 강조 · data-exit = 그 클릭에 사라짐
     .done = 등장이 끝난 요소(그대로 보임) · .em = 강조 중 · .out = 사라짐 */
  function live(el) {
    if (el._live) return el._live;
    const q = s => [...el.querySelectorAll(s)]; const nums = (sel, k) => q(sel).map(x => +x.dataset[k] || 0);
    const total = Math.max(0, ...nums('[data-step]', 'step'), ...nums('[data-emph-at]', 'emphAt'), ...nums('[data-exit]', 'exit'));
    let step = 0; const still = () => !!el.closest('.no-motion');
    el.addEventListener('animationend', ev => { const x = ev.target; if (!x.classList || !x.classList.contains('ts-el') || ev.target !== x) return;
      if (/^(a-|ts-rise|ts-pop)/.test(ev.animationName)) { x.classList.add('done'); if (x.dataset.emph && !x.dataset.emphAt) x.classList.add('em'); } else if (/^e-/.test(ev.animationName)) x.classList.remove('em'); });
    const apply = (n, quick) => { q(`[data-step="${n}"]`).forEach(x => { x.classList.add('on'); if (quick || still()) x.classList.add('quick', 'done'); countUp(x); });
      q(`[data-emph-at="${n}"]`).forEach(x => { if (quick) return; x.classList.remove('em'); void x.offsetWidth; x.classList.add('done', 'em'); });
      q(`[data-exit="${n}"]`).forEach(x => { x.classList.add('out'); if (quick || still()) x.classList.add('quick'); }); };
    const undo = n => { q(`[data-step="${n}"]`).forEach(x => x.classList.remove('on', 'quick', 'done', 'em')); q(`[data-emph-at="${n}"]`).forEach(x => x.classList.remove('em')); q(`[data-exit="${n}"]`).forEach(x => x.classList.remove('out', 'quick')); };
    return (el._live = { total, get step() { return step; },
      reset(all) { q('[data-step]').forEach(x => x.classList.remove('on', 'quick')); q('.ts-el').forEach(x => x.classList.remove('done', 'em', 'out', 'quick')); q('[data-count]').forEach(x => { x._done = false; }); step = 0;
        if (still()) q('.ts-el.in').forEach(x => x.classList.add('done')); if (all) { q('.ts-el.in').forEach(x => x.classList.add('done')); for (let n = 1; n <= total; n++) apply(n, true); step = total; } },
      next() { if (step >= total) return false; step++; apply(step); return true; }, prev() { if (step <= 0) return false; undo(step); step--; return true; } });
  }
  /* 모핑: 앞 장(a)과 지금 장(b)에 같은 요소(같은 id)가 있으면 앞 장의 자리 · 크기 · 기울기에서 지금 자리로 부드럽게 옮긴다 */
  function morph(a, b) {
    const pairs = [];
    b.querySelectorAll('.ts-el.in, .ts-el.on').forEach(y => { const x = a.querySelector(`.ts-el[data-el="${y.dataset.el}"]`); if (!x || !y.offsetWidth || !y.offsetHeight || getComputedStyle(x).opacity === '0' || x.classList.contains('out')) return;
      const dx = (x.offsetLeft + x.offsetWidth / 2) - (y.offsetLeft + y.offsetWidth / 2), dy = (x.offsetTop + x.offsetHeight / 2) - (y.offsetTop + y.offsetHeight / 2);
      pairs.push({ y, from: { transform: `translate(${dx}px, ${dy}px) scale(${x.offsetWidth / y.offsetWidth}, ${x.offsetHeight / y.offsetHeight})`, rotate: x.style.rotate || '0deg' }, to: { transform: 'translate(0px, 0px) scale(1, 1)', rotate: y.style.rotate || '0deg' } }); });
    return { count: pairs.length, run(ms) { pairs.forEach(p => { p.y.classList.add('done'); if (p.y.animate) p.y.animate([p.from, p.to], { duration: ms || 900, easing: 'cubic-bezier(.3, .7, .2, 1)' }); }); } };
  }
  const uid = () => Math.random().toString(36).slice(2, 10);
  const blank = (layout) => {
    const L = LAYOUTS[layout] || LAYOUTS.bullets; const s = { id: uid(), layout: LAYOUTS[layout] ? layout : 'bullets', notes: '' };
    if (s.layout !== 'free') s.title = '제목을 입력하세요';
    if (L.it) s.items = Array.from({ length: Math.min(3, L.max || 3) }, (_, i) => { const o = {}; L.it.forEach(k => o[k] = k === 't' ? '항목 ' + (i + 1) : k === 'v' ? '0' : ''); return o; });
    return s;
  };
  /* 새 요소의 기본값 */
  function newEl(type, x, y, w, h, more) {
    const D = {
      text: { w: 640, h: 80, html: '글을 입력하세요', fs: 36, color: 'fg', align: 'left', lh: 1.4, weight: 400 },
      image: { w: 640, h: 400, mask: 'round', radius: 24 }, shape: { w: 320, h: 220, shape: 'round', fill: 'accent', color: 'ink', fs: 30, html: '' },
      line: { w: 400, h: 0, stroke: 'accent', sw: 5, arrow: 'none' }, icon: { w: 140, h: 140, name: '불', color: 'accent' },
      table: { w: 1000, h: 300, rows: [['구분', '내용', '비고'], ['', '', ''], ['', '', '']], head: true, fs: 28 },
      chart: { w: 860, h: 460, kind: 'bar', data: [['가', 12], ['나', 19], ['다', 27]], fs: 24, color: 'accent' },
    }[type] || {};
    const e = Object.assign({ id: uid(), type }, D, more || {}); if (w > 12 || h > 12) { e.w = Math.round(w); e.h = Math.round(h); }
    e.x = Math.round(x); e.y = Math.round(y); return e;
  }

  /* ---------- 장 유형으로 그린 장을 요소 단위로 풀기 (PPTX 내보내기도 이것을 쓴다) ----------
     화면 밖에 그려 본 뒤 글 · 카드 · 그림 · 선의 자리와 모양을 재서 자유 요소로 옮긴다. */
  function explode(deck, s, i, total) {
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-99999px;top:0;width:1920px;height:1080px;overflow:hidden'; document.body.appendChild(host);
    const el = slideEl(deck, Object.assign({}, s, { els: [] }), i, total); el.style.transform = 'none'; host.appendChild(el); fit(el);
    const o = el.getBoundingClientRect(); const pal = palette(deck); const out = [];
    const rgba = c => (String(c).match(/[\d.]+/g) || []).map(Number);
    const token = c => { const m = rgba(c); if (m.length < 3 || m[3] === 0) return 'none'; const h = '#' + m.slice(0, 3).map(v => (v | 0).toString(16).padStart(2, '0')).join('').toUpperCase(); const solid = m[3] == null || m[3] > .95; const k = solid && Object.keys(pal).find(k => typeof pal[k] === 'string' && pal[k].toUpperCase() === h); return k || (solid ? h : `rgba(${m.slice(0, 4).join(',')})`); };
    const alpha = c => { const m = rgba(c); return m.length < 3 ? 0 : m[3] == null ? 1 : m[3]; };
    const box = n => { const r = n.getBoundingClientRect(); return { x: Math.round(r.left - o.left), y: Math.round(r.top - o.top), w: Math.round(r.width), h: Math.round(r.height) }; };
    const zoomOf = n => { const f = n.closest('.ts-fit'); return f ? parseFloat(f.style.zoom) || 1 : 1; };
    const INLINE = { EM: 1, B: 1, SPAN: 1, SMALL: 1, BR: 1, STRONG: 1, I: 1, U: 1 };
    const isLeaf = n => n.textContent.trim() && [...n.children].every(ch => INLINE[ch.tagName] && getComputedStyle(ch).display.startsWith('inline'));
    const ser = (n, base) => [...n.childNodes].map(ch => {
      if (ch.nodeType === 3) return E(ch.textContent); if (ch.nodeType !== 1) return ''; if (ch.tagName === 'BR') return '<br>';
      const cs = getComputedStyle(ch); const st = []; if (cs.color !== base.color) { const t = token(cs.color); st.push('color:' + (TOKENS[t] ? `var(${TOKENS[t]})` : t)); }
      const r = parseFloat(cs.fontSize) / parseFloat(base.fontSize); if (Math.abs(r - 1) > .04) st.push(`font-size:${Math.round(r * 100) / 100}em`);
      if (cs.fontWeight !== base.fontWeight) st.push('font-weight:' + cs.fontWeight);
      const inner = ser(ch, cs); return st.length ? `<span style="${st.join(';')}">${inner}</span>` : inner;
    }).join('');
    const visit = n => {
      if (n.nodeType !== 1 || n.classList.contains('ts-stairs') || n.classList.contains('ts-mark') || n.tagName.toLowerCase() === 'svg') return;
      const cs = getComputedStyle(n); if (cs.display === 'none') return; const b = box(n), z = zoomOf(n);
      const card = n.classList.contains('ts-card');
      if (n.classList.contains('ts-pic')) { const im = s.image || {}; if (im.src) out.push(Object.assign(newEl('image', b.x, b.y, b.w, b.h), { src: im.src, zoom: im.zoom, px: im.px, py: im.py, mask: 'round', radius: 26, shadow: true })); if (im.caption) out.push(Object.assign(newEl('text', b.x + 30, b.y + b.h - 56, b.w - 60, 40), { html: F(im.caption), fs: 22, color: '#FFFFFF' })); return; }
      if (n.tagName === 'TABLE') { out.push(Object.assign(newEl('table', b.x, b.y, b.w, b.h), { rows: [...n.rows].map(r => [...r.cells].map(c => c.textContent)), head: true, fs: Math.round(parseFloat(cs.fontSize) * z) })); return; }
      if (n.tagName === 'I') { if (b.w > 8 && alpha(cs.backgroundColor)) out.push(Object.assign(newEl('shape', b.x, b.y, b.w, b.h), { shape: 'rect', fill: token(cs.backgroundColor), html: '' })); return; }
      if (card) out.push(Object.assign(newEl('shape', b.x, b.y, b.w, b.h), { shape: 'card', radius: Math.round(parseFloat(cs.borderTopLeftRadius) * z), html: '' }, n.matches('.last, .b') ? { stroke: 'accent', sw: 2 } : {}, n.closest('[data-step]') ? { step: +n.closest('[data-step]').dataset.step, anim: 'rise' } : {}));
      else {
        if (parseFloat(cs.borderTopWidth) >= 1 && b.w > 40) out.push(Object.assign(newEl('line', b.x, b.y, b.w, 0), { h: 0, stroke: 'line', sw: 2 }));
        if (parseFloat(cs.borderBottomWidth) >= 1 && b.w > 40) out.push(Object.assign(newEl('line', b.x, b.y + b.h, b.w, 0), { h: 0, stroke: 'line', sw: 2 }));
      }
      if (isLeaf(n)) {
        const al = cs.textAlign === 'center' ? 'center' : cs.textAlign === 'right' || cs.textAlign === 'end' ? 'right' : 'left'; const fs = parseFloat(cs.fontSize) * z;
        const outline = parseFloat(cs.webkitTextStrokeWidth) > 0; const pl = card ? parseFloat(cs.paddingLeft) * z : 0, pt = card ? parseFloat(cs.paddingTop) * z : 0;
        const e = Object.assign(newEl('text', b.x + pl, b.y + pt, b.w - pl * 2 + 12, b.h - pt * 2), { h: Math.max(10, Math.round(b.h - pt * 2)), html: (n.tagName === 'LI' ? '– ' : '') + ser(n, cs), fs: Math.round(fs * 10) / 10, color: outline ? 'accent' : token(cs.color), align: al, lh: Math.round(parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) * 100) / 100 || 1.4, weight: +cs.fontWeight || 400 });
        if (/mono/i.test(cs.fontFamily.split(',')[0])) e.font = 'mono'; const ls = parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize); if (ls && Math.abs(ls) > .005) e.ls = Math.round(ls * 1000) / 1000;
        if (outline) e.outline = true; const sp = n.closest('[data-step]'); if (sp) { e.step = +sp.dataset.step; e.anim = 'rise'; }
        if (cs.textTransform === 'uppercase') e.html = e.html.replace(/>[^<]+|^[^<]+/g, m => m.toUpperCase());
        if (!card && alpha(cs.backgroundColor) > .5) Object.assign(e, { fill: token(cs.backgroundColor), radius: Math.round(parseFloat(cs.borderTopLeftRadius) * z), valign: 'middle', align: 'center', x: b.x, w: b.w, lh: 1.2 });
        out.push(e); return;
      }
      [...n.children].forEach(visit);
    };
    visit(el.querySelector('.ts-body')); host.remove();
    return out;
  }
  return { E, F, pad, MARK, LAYOUTS, FIELD_LABEL, ITEM_LABEL, MOTIONS, TONES, THEMES, themeOf, ANIMS, EMPHS, EXITS, TRANSITIONS, trOf, live, morph, PALETTE, palette, TOKENS, col, SHAPES, MASKS, CHARTS, slideEl, fit, thumb, countUp, uid, blank, isVideo, newEl, elInner, elStyle, elHtml, clean, explode, bgOf, cssUrl };
})();
