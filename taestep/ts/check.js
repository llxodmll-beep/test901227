/* TAESTEP 디자인 점검 — 장마다 화면 밖에 그려 보고 문제를 찾는다
   넘침(내용이 많아 줄어듦 · 장 밖으로 나감 · 글상자보다 긴 글) / 대비(배경 사진 위 글자) / 작은 글자 / 여백(가장자리에 붙음 · 조금 어긋난 줄)
   고칠 수 있는 것은 fix() 를 함께 돌려준다 → "한 번에 고치기" */
'use strict';
const TSCheck = (() => {
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const ratio = (a, b) => { const x = Math.max(a, b), y = Math.min(a, b); return (x + .05) / (y + .05); };
  const rgb = c => { const m = (String(c).match(/[\d.]+/g) || []).map(Number); return m.length >= 3 ? m : [255, 255, 255]; };
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const NAME = { text: '글상자', image: '그림', shape: '도형', line: '선', icon: '아이콘', table: '표', chart: '차트' };
  const load = src => new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const MIN_RATIO = 3, K = .1;

  async function run(deck, say) {
    await load('ts/pptx.js'); const out = []; const N = deck.slides.length; const pal = TS.palette(deck);
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-99999px;top:0;width:1920px;height:1080px;overflow:hidden'; document.body.appendChild(host);
    for (let i = 0; i < N; i++) {
      const s = deck.slides[i]; if (say) say(`디자인 점검 중… ${i + 1} / ${N}`);
      const L = TS.LAYOUTS[s.layout] || TS.LAYOUTS.bullets; const el = TS.slideEl(deck, s, i, N); el.style.transform = 'none'; host.appendChild(el); TS.fit(el); const o = el.getBoundingClientRect();
      const add = (kind, msg, fix) => out.push({ slide: i, id: s.id, kind, msg, fix: fix || null });
      /* 넘침 */
      const box = el.querySelector('.ts-fit'), main = el.querySelector('.ts-main'); const z = box ? parseFloat(box.style.zoom) || 1 : 1;
      if (box && box.scrollHeight * z > main.clientHeight + 8) add('넘침', '내용이 장 밖으로 넘칩니다 — 항목이나 글을 줄여 주세요');
      else if (z < .8) add('넘침', `내용이 많아 ${Math.round(z * 100)}% 크기로 줄여 넣었습니다 — 뒷자리에서 글자가 작게 보입니다`);
      const body = el.querySelector('.ts-body'); if (!box && body && body.scrollHeight > 1086) add('넘침', '글이 길어 장 아래로 넘칩니다 — 제목이나 설명을 줄여 주세요');
      const title = el.querySelector('.ts-body .ts-title'); if (title) { const n = Math.round(title.offsetHeight / parseFloat(getComputedStyle(title).lineHeight)); if (n > 3) add('넘침', `제목이 ${n}줄입니다 — 2줄 안쪽이 읽기 좋습니다`); }
      const filled = (s.items || []).filter(x => x && (x.t || x.d || x.v || x.k)).length; if (L.max && filled > L.max) add('넘침', `항목 ${filled}개 가운데 ${L.max}개만 보입니다 — 장을 나누거나 유형을 바꿔 주세요`);
      if (s.layout !== 'free' && L.f.includes('title') && !String(s.title || '').trim()) add('내용', '제목이 비어 있습니다');
      /* 자유 요소 */
      const els = (s.els || []).filter(e => !e.hide);
      els.forEach(e => {
        const nm = NAME[e.type] || '요소'; const full = e.w >= 1880 || e.h >= 1040;
        if (!full && (e.x < -2 || e.y < -2 || e.x + e.w > 1922 || e.y + e.h > 1082)) add('넘침', `${nm}이(가) 장 밖으로 나갔습니다`, () => { e.x = Math.round(Math.max(0, Math.min(1920 - e.w, e.x))); e.y = Math.round(Math.max(0, Math.min(1080 - e.h, e.y))); });
        if (e.type === 'text') { const n = el.querySelector(`[data-el="${e.id}"] .tx-in`); const pad = e.fill ? (+e.pad || 0) * 2 : 0; const need = n ? Math.ceil(n.offsetHeight + pad) : 0; if (need > e.h + 8) add('넘침', '글상자의 글이 상자보다 깁니다', () => { e.h = need; });
          if ((+e.fs || 32) < 24) add('작은 글자', `글상자 글자가 ${+e.fs}px 입니다 — 24px 보다 작으면 뒷자리에서 안 보입니다`, () => { e.fs = 24; }); }
        if (e.type === 'table' && (+e.fs || 28) < 22) add('작은 글자', `표 글자가 ${+e.fs}px 입니다`, () => { e.fs = 22; });
        if (e.type === 'chart' && (+e.fs || 24) < 20) add('작은 글자', `차트 글자가 ${+e.fs}px 입니다`, () => { e.fs = 20; });
        const g = [e.x, e.y, 1920 - (e.x + e.w), 1080 - (e.y + e.h)];
        if (e.type !== 'line' && !full && g.some(v => v > .5 && v < 40)) add('여백', `${nm}이(가) 가장자리에 너무 붙어 있습니다`, () => { if (g[0] > .5 && g[0] < 40) e.x = 64; if (g[1] > .5 && g[1] < 40) e.y = 64; if (g[2] > .5 && g[2] < 40) e.x = 1920 - 64 - e.w; if (g[3] > .5 && g[3] < 40) e.y = 1080 - 64 - e.h; });
      });
      /* 조금 어긋난 줄 (왼쪽 · 위) */
      [['x', '왼쪽'], ['y', '위쪽']].forEach(([k, name]) => { const a = els.filter(e => e.type !== 'line').slice().sort((m, n) => m[k] - n[k]); const pairs = []; for (let j = 1; j < a.length; j++) { const d = a[j][k] - a[j - 1][k]; if (d > 0 && d <= 8) pairs.push([a[j - 1], a[j]]); }
        if (pairs.length) add('여백', `요소 ${pairs.length}쌍의 ${name} 줄이 조금(8px 이내) 어긋나 있습니다`, () => pairs.forEach(([m, n]) => { n[k] = m[k]; })); });
      /* 대비: 배경 사진 위의 글자 */
      const g = TS.bgOf(s, L, deck);
      const texts = [...el.querySelectorAll('.ts-body [data-f], .ts-body .ts-num, .ts-source')].filter(n => !n.closest('.ts-card, table, .ts-chip, .ts-pic') && n.textContent.trim() && getComputedStyle(n).webkitTextStrokeWidth === '0px');
      if (g.src && !TS.isVideo(g.src) && typeof TSPptx !== 'undefined' && TSPptx.bgCanvas) {
        let cv = null; try { cv = await TSPptx.bgCanvas(deck, s, K); } catch (e) { }
        if (cv) { const ctx = cv.getContext('2d', { willReadFrequently: true });
          const under = r => { const x = Math.max(0, Math.floor(r.x * K)), y = Math.max(0, Math.floor(r.y * K)), w = Math.max(1, Math.min(cv.width - x, Math.ceil(r.w * K))), h = Math.max(1, Math.min(cv.height - y, Math.ceil(r.h * K))); if (w < 1 || h < 1) return null; let d; try { d = ctx.getImageData(x, y, w, h).data; } catch (e) { return null; } let a = 0, b = 0, c = 0; for (let p = 0; p < d.length; p += 4) { a += d[p]; b += d[p + 1]; c += d[p + 2]; } const n = d.length / 4; return [a / n, b / n, c / n]; };
          let worst = 99; texts.forEach(n => { const r = n.getBoundingClientRect(); const u = under({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height }); if (u) worst = Math.min(worst, ratio(lum(rgb(getComputedStyle(n).color)), lum(u))); });
          if (worst < MIN_RATIO) add('대비', `배경 사진 위의 글자가 잘 안 읽힙니다 (밝기 차이 ${worst.toFixed(1)} : 1, 3 이상 권장)`, () => { if (s.bg && s.bg.src) { s.bg.dim = Math.max(L.dim, Math.min(.94, Math.round((g.dim + .15) * 100) / 100)); if (g.tone === 'none') delete s.bg.tone; } else if (deck.bg) deck.bg.dim = Math.min(.95, Math.round(((deck.bg.dim == null ? .86 : +deck.bg.dim) + .06) * 100) / 100); });
          els.filter(e => e.type === 'text' && !e.fill && !e.outline).forEach(e => { const n = el.querySelector(`[data-el="${e.id}"] .tx`); const u = n && under(e); if (!u) return; const r = ratio(lum(rgb(getComputedStyle(n).color)), lum(u)); if (r < MIN_RATIO) add('대비', `글상자의 글자가 배경 위에서 잘 안 읽힙니다 (${r.toFixed(1)} : 1)`, () => { const c = ['title', 'ink', 'fg'].map(k => [k, ratio(lum(hex(pal[k])), lum(u))]).sort((m, n2) => n2[1] - m[1])[0]; if (c[1] >= MIN_RATIO) e.color = c[0]; else { e.fill = 'bg2'; e.color = 'title'; e.pad = 18; e.radius = 12; } }); }); // 더 잘 보이는 테마 색으로, 그래도 안 되면 바탕을 깐다
        }
      } else if (!g.src) els.filter(e => e.type === 'text' && !e.fill && !e.outline).forEach(e => { const n = el.querySelector(`[data-el="${e.id}"] .tx`); if (!n) return; const r = ratio(lum(rgb(getComputedStyle(n).color)), lum(hex(pal.bg))); if (r < MIN_RATIO) add('대비', `글상자의 글자색이 바탕색과 비슷해 잘 안 보입니다 (${r.toFixed(1)} : 1)`, () => { e.color = 'fg'; }); });
      el.remove();
    }
    host.remove(); return out;
  }
  return { run };
})();
