/* TAESTEP → PowerPoint(PPTX) 내보내기  (PptxGenJS, MIT License — ts/vendor/pptxgen.bundle.js)
   글은 고칠 수 있는 글상자로, 카드 · 사각형 · 원 · 선 · 표는 PowerPoint 도형으로 옮긴다.
   배경(그림 + 어둡게 덮기), 자른 그림, 별 · 화살 같은 도형, 아이콘, 차트는 화면과 똑같이 그림으로 굽는다.
   장 유형으로 만든 장은 TS.explode 로 자리를 재서 옮긴다. PowerPoint 에 글꼴(Pretendard)이 없으면 기본 글꼴로 바뀌어 줄바꿈이 조금 달라질 수 있다. */
'use strict';
const TSPptx = (() => {
  const IN = 144; // 1920px = 13.333in
  const cache = {};
  const img = src => cache[src] || (cache[src] = new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }));
  const b64 = url => url.replace(/^data:/, '');
  function colorOf(v, pal) {
    if (!v || v === 'none' || v === 'transparent') return null;
    if (pal[v] && typeof pal[v] === 'string') return { c: pal[v].slice(1).toUpperCase(), t: 0 };
    if (v === 'card') return { c: pal.bg2.slice(1).toUpperCase(), t: 35 }; if (v === 'line') return { c: pal.fg.slice(1).toUpperCase(), t: 84 };
    const tk = String(v).match(/var\(--([\w-]+)\)/); if (tk) { const k = Object.keys(TS.TOKENS).find(k => TS.TOKENS[k] === '--' + tk[1]); return colorOf(k, pal); }
    let m = String(v).match(/^#([0-9a-f]{6})/i); if (m) return { c: m[1].toUpperCase(), t: 0 };
    m = String(v).match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i); if (m) return { c: (m[1] + m[1] + m[2] + m[2] + m[3] + m[3]).toUpperCase(), t: 0 };
    m = String(v).match(/[\d.]+/g); if (m && m.length >= 3) return { c: m.slice(0, 3).map(x => (+x | 0).toString(16).padStart(2, '0')).join('').toUpperCase(), t: m[3] == null ? 0 : Math.round((1 - +m[3]) * 100) };
    return null;
  }
  const cssColor = (v, pal) => { const c = colorOf(v, pal); return c ? `rgba(${parseInt(c.c.slice(0, 2), 16)},${parseInt(c.c.slice(2, 4), 16)},${parseInt(c.c.slice(4), 16)},${1 - c.t / 100})` : 'rgba(0,0,0,0)'; };
  const solve = (svg, pal) => svg.replace(/var\(--[\w-]+(?:,[^)]*)?\)/g, m => cssColor(m, pal)).replace(/currentColor/g, pal.title);

  /* 배경: 바탕색 → 그림(자르기 반영) → 어둡게 덮기 를 한 장으로 굽는다 */
  /* 배경 한 장을 그림으로 (scale = 축소 배율 · 디자인 점검이 글자 밑의 밝기를 잴 때도 쓴다) */
  async function bgCanvas(deck, s, scale) {
    const pal = TS.palette(deck); const L = TS.LAYOUTS[s.layout] || TS.LAYOUTS.bullets; const g = TS.bgOf(s, L, deck); const k = scale || 1;
    const c = document.createElement('canvas'); c.width = Math.round(1920 * k); c.height = Math.round(1080 * k); const x = c.getContext('2d'); x.scale(k, k);
    const gr = x.createLinearGradient(0, 0, 1920, 1080); gr.addColorStop(0, pal.bg2); gr.addColorStop(.62, pal.bg); x.fillStyle = gr; x.fillRect(0, 0, 1920, 1080);
    const im = g.src && !TS.isVideo(g.src) ? await img(g.src) : null;
    if (im) {
      const [px, py] = g.pos.split(' ').map(parseFloat); cover(x, im, 1920, 1080, g.zoom, px, py);
      const sh = a => `rgba(${pal.shade.join(',')},${Math.max(0, Math.min(1, a))})`; const d = g.dim; const paper = TS.themeOf(deck) === 'paper'; // engine.css 의 덮는 규칙과 같게
      if (g.tone === 'full') { x.fillStyle = sh(paper ? Math.max(d, .9) : d); x.fillRect(0, 0, 1920, 1080); }
      else if (g.tone !== 'none') {
        const v = g.tone === 'bottom'; const k = x.createLinearGradient(g.tone === 'left' ? 0 : g.tone === 'right' ? 1920 : 0, v ? 1080 : 0, g.tone === 'left' ? 1920 : g.tone === 'right' ? 0 : 0, 0);
        const stops = paper ? (v ? [[0, .98], [.3, .95], [.48, .55], [.74, 0], [1, 0]] : [[0, .98], [.46, .96], [.64, .62], [.86, .14], [1, 0]]) : (v ? [[0, d + .25], [.3, d], [.62, d * .2], [1, 0]] : [[0, d + .25], [.38, d], [.72, d * .25], [1, 0]]);
        stops.forEach(([o, a]) => k.addColorStop(o, sh(a))); x.fillStyle = k; x.fillRect(0, 0, 1920, 1080);
      }
    }
    return c;
  }
  const background = async (deck, s) => (await bgCanvas(deck, s, 1)).toDataURL('image/jpeg', .82);
  function cover(x, im, w, h, z, px, py) {
    const s0 = Math.max(w / im.width, h / im.height); const bw = im.width * s0, bh = im.height * s0; const bx = (w - bw) * px / 100, by = (h - bh) * py / 100; const ox = w * px / 100, oy = h * py / 100;
    x.drawImage(im, ox + (bx - ox) * z, oy + (by - oy) * z, bw * z, bh * z);
  }
  async function rasterImage(e, pal) {
    const im = await img(e.src); if (!im) return null; const k = 2; const c = document.createElement('canvas'); c.width = Math.max(2, e.w * k); c.height = Math.max(2, e.h * k); const x = c.getContext('2d'); x.scale(k, k);
    const w = e.w, h = e.h, m = e.mask || 'none'; x.beginPath();
    if (m === 'circle') x.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); else if (m === 'round') x.roundRect(0, 0, w, h, Math.min(e.radius == null ? 24 : +e.radius, w / 2, h / 2));
    else if (m === 'arch') x.roundRect(0, 0, w, h, [Math.min(w, h * 2) / 2, Math.min(w, h * 2) / 2, 0, 0]); else if (m === 'hexagon') [[.25, 0], [.75, 0], [1, .5], [.75, 1], [.25, 1], [0, .5]].forEach((p, i) => i ? x.lineTo(p[0] * w, p[1] * h) : x.moveTo(p[0] * w, p[1] * h));
    else if (m === 'diamond') [[.5, 0], [1, .5], [.5, 1], [0, .5]].forEach((p, i) => i ? x.lineTo(p[0] * w, p[1] * h) : x.moveTo(p[0] * w, p[1] * h)); else x.rect(0, 0, w, h);
    x.closePath(); x.save(); x.clip();
    x.filter = [e.br != null ? `brightness(${e.br}%)` : '', e.ct != null ? `contrast(${e.ct}%)` : '', e.sat != null ? `saturate(${e.sat}%)` : '', e.gray ? 'grayscale(1)' : ''].filter(Boolean).join(' ') || 'none';
    cover(x, im, w, h, Math.max(1, +e.zoom || 1), e.px == null ? 50 : +e.px, e.py == null ? 50 : +e.py); x.restore();
    if (e.stroke && +e.sw) { x.lineWidth = +e.sw * 2; x.strokeStyle = cssColor(e.stroke, pal); x.save(); x.clip(); x.stroke(); x.restore(); }
    return c.toDataURL('image/png');
  }
  async function rasterSvg(svg, w, h, pal) {
    let s = solve(svg, pal).replace(/width="100%" height="100%"/, '').replace(/^<svg /, `<svg width="${w}" height="${h}" `); if (!/xmlns=/.test(s)) s = s.replace(/^<svg /, '<svg xmlns="http://www.w3.org/2000/svg" ');
    const im = await img('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s)); if (!im) return null;
    const k = 2, c = document.createElement('canvas'); c.width = Math.max(2, w * k); c.height = Math.max(2, h * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/png');
  }
  /* 글상자 안의 서식 → PowerPoint 글 조각 */
  function runs(html, base, pal) {
    const t = document.createElement('template'); t.innerHTML = TS.clean(html); const out = [];
    const brk = () => { if (out.length) out[out.length - 1].options.breakLine = true; };
    const walk = (n, st) => [...n.childNodes].forEach(ch => {
      if (ch.nodeType === 3) { if (ch.textContent) out.push({ text: ch.textContent, options: Object.assign({}, st) }); return; }
      if (ch.nodeType !== 1) return; const tag = ch.tagName; if (tag === 'BR') { if (!out.length) out.push({ text: '', options: Object.assign({}, st) }); brk(); return; }
      const s2 = Object.assign({}, st); const cs = ch.style;
      if (tag === 'B' || tag === 'STRONG') s2.bold = true; if (tag === 'I') s2.italic = true; if (tag === 'U') s2.underline = { style: 'sng' }; if (tag === 'EM') s2.color = pal.accent.slice(1);
      if (tag === 'MARK') { s2.highlight = pal.accent.slice(1); s2.color = pal.ink.slice(1); }
      if (cs.color) { const c = colorOf(cs.color, pal); if (c) s2.color = c.c; } if (cs.backgroundColor) { const c = colorOf(cs.backgroundColor, pal); if (c) s2.highlight = c.c; }
      if (cs.fontSize) { const v = parseFloat(cs.fontSize); s2.fontSize = Math.round((/em$/.test(cs.fontSize) ? (st.fontSize || base) * v : v * .5) * 10) / 10; }
      if (cs.fontWeight) s2.bold = (+cs.fontWeight || (cs.fontWeight === 'bold' ? 700 : 400)) >= 600; if (cs.fontStyle === 'italic') s2.italic = true; if (/underline/.test(cs.textDecoration + cs.textDecorationLine)) s2.underline = { style: 'sng' };
      const block = /^(DIV|P|LI)$/.test(tag); if (block && out.length && !out[out.length - 1].options.breakLine) brk();
      if (tag === 'LI') s2.bullet = ch.parentNode.tagName === 'OL' ? { type: 'number' } : true;
      const n0 = out.length; walk(ch, s2); if (block && out.length > n0) brk();
    });
    walk(t.content, {}); if (out.length) delete out[out.length - 1].options.breakLine;
    return out.length ? out : [{ text: '', options: {} }];
  }
  async function addEl(p, sl, e, pal) {
    if (e.hide) return; const box = { x: e.x / IN, y: e.y / IN, w: Math.max(.02, e.w / IN), h: Math.max(.02, e.h / IN) }; if (e.rot) box.rotate = +e.rot;
    const text = (html, o) => {
      const fs = Math.round((+o.fs || 32) * .5 * 10) / 10; const c = colorOf(o.color || 'fg', pal) || { c: 'FFFFFF' }; const al = o.align || 'left'; const oneLine = e.h <= (+o.fs || 32) * (+o.lh || 1.4) * 1.6 && al === 'left'; const grow = al === 'left' && !oneLine ? e.w * .06 : 0; // 한 줄짜리는 줄바꿈 없이 그대로
      sl.addText(runs(html, fs, pal), Object.assign({}, box, { w: (e.w + grow) / IN, fontSize: fs, color: c.c, fontFace: o.font === 'mono' ? 'Consolas' : 'Pretendard', bold: (+o.weight || 400) >= 600, align: al === 'justify' ? 'justify' : al, valign: { middle: 'middle', bottom: 'bottom' }[o.valign] || 'top', margin: o.pad ? (+o.pad * .5) : 0, lineSpacingMultiple: Math.round((+o.lh || 1.4) / 1.2 * 100) / 100, fit: 'none', wrap: !oneLine }, o.ls ? { charSpacing: Math.round(o.ls * fs * 10) / 10 } : {}, o.fillc ? { fill: { color: o.fillc.c, transparency: o.fillc.t } } : {}));
    };
    if (e.type === 'text') return text(e.html, Object.assign({}, e, { fillc: colorOf(e.fill, pal) }));
    if (e.type === 'image') { if (!e.src) return; const d = await rasterImage(e, pal); if (d) sl.addImage(Object.assign({ data: b64(d) }, box)); return; }
    if (e.type === 'shape') {
      const sh = e.shape || 'rect';
      if (/^(rect|round|ellipse|card)$/.test(sh)) {
        const f = sh === 'card' ? colorOf('card', pal) : colorOf(e.fill || 'accent', pal); const ln = e.stroke && +e.sw ? colorOf(e.stroke, pal) : sh === 'card' ? { c: pal.fg.slice(1), t: 80 } : null; const op = e.op == null ? 1 : +e.op;
        sl.addShape(sh === 'ellipse' ? p.ShapeType.ellipse : sh === 'rect' ? p.ShapeType.rect : p.ShapeType.roundRect, Object.assign({}, box, { fill: f ? { color: f.c, transparency: Math.round(100 - (100 - f.t) * op) } : { type: 'none' }, line: ln ? { color: ln.c, width: Math.max(.5, (+e.sw || 1) * .5), transparency: ln.t || 0, dashType: e.dash ? 'dash' : 'solid' } : { type: 'none' } }, sh === 'rect' || sh === 'ellipse' ? {} : { rectRadius: Math.min(.5, (e.radius == null ? 22 : +e.radius) / Math.max(1, Math.min(e.w, e.h))) }));
      } else { const d = await rasterSvg(TS.elInner(Object.assign({}, e, { html: '' })).replace(/<div class="tx[\s\S]*$/, ''), e.w, e.h, pal); if (d) sl.addImage(Object.assign({ data: b64(d) }, box)); }
      if (e.html && e.html.replace(/<[^>]+>/g, '').trim()) text(e.html, { fs: e.fs || 30, color: e.color || 'title', align: e.align || 'center', weight: e.weight || 600, lh: e.lh || 1.35, valign: 'middle' });
      return;
    }
    if (e.type === 'line') { const c = colorOf(e.stroke || 'accent', pal) || { c: 'FFFFFF', t: 0 }; const end = e.arrow === 'end' || e.arrow === 'both', both = e.arrow === 'both';
      sl.addShape(p.ShapeType.line, { x: e.x / IN, y: e.y / IN, w: e.w / IN, h: e.h / IN, flipV: !!e.flip, line: { color: c.c, transparency: c.t, width: Math.max(.5, (+e.sw || 4) * .5), dashType: e.dash ? 'dash' : 'solid', beginArrowType: both || (end && e.rev) ? 'triangle' : 'none', endArrowType: both || (end && !e.rev) ? 'triangle' : 'none' } }); return; }
    if (e.type === 'icon' || e.type === 'chart') { const d = await rasterSvg(TS.elInner(e), e.w, e.h, pal); if (d) sl.addImage(Object.assign({ data: b64(d) }, box)); return; }
    if (e.type === 'table') {
      const rows = (e.rows || []).filter(r => r.length); if (!rows.length) return; const fs = Math.round((+e.fs || 28) * .5 * 10) / 10; const n = rows[0].length;
      sl.addTable(rows.map((r, ri) => r.map(v => ({ text: String(v == null ? '' : v).replace(/\*/g, ''), options: Object.assign({ color: pal.fg.slice(1), fill: { color: pal.bg2.slice(1), transparency: e.plain ? 100 : (e.stripe && ri % 2 ? 20 : 35) } }, e.head !== false && ri === 0 ? { bold: true, color: pal.accent.slice(1) } : {}) }))),
        { x: e.x / IN, y: e.y / IN, w: e.w / IN, colW: Array(n).fill(e.w / IN / n), rowH: e.h / IN / rows.length, fontSize: fs, fontFace: 'Pretendard', valign: 'middle', border: { type: 'solid', pt: .5, color: pal.muted.slice(1) } });
    }
  }
  async function build(deck, say) {
    const p = new PptxGenJS(); p.defineLayout({ name: 'TAESTEP', width: 1920 / IN, height: 1080 / IN }); p.layout = 'TAESTEP'; p.title = deck.title || ''; p.company = deck.org || '';
    const pal = TS.palette(deck); const N = deck.slides.length;
    for (let i = 0; i < N; i++) {
      const s = deck.slides[i]; if (say) say(`PPTX 를 만드는 중… ${i + 1} / ${N}`); const sl = p.addSlide();
      sl.background = { data: b64(await background(deck, s, pal)) };
      const list = [...(s.layout === 'free' ? [] : TS.explode(deck, s, i, N)), ...(Array.isArray(s.els) ? s.els : [])];
      for (const e of list) { try { await addEl(p, sl, e, pal); } catch (err) { console.warn('PPTX 요소 건너뜀', e.type, err); } }
      if (s.source) sl.addText(String(s.source).replace(/\*/g, ''), { x: 128 / IN, y: 978 / IN, w: 1664 / IN, h: 30 / IN, fontSize: 10.5, color: pal.muted.slice(1), fontFace: 'Pretendard', margin: 0 });
      if (s.layout !== 'cover') {
        sl.addText(deck.footer || deck.title || '', { x: 128 / IN, y: 1020 / IN, w: 1400 / IN, h: 30 / IN, fontSize: 9.5, color: pal.muted.slice(1), fontFace: 'Pretendard', margin: 0, valign: 'middle' });
        sl.addText(`${TS.pad(i + 1)} / ${TS.pad(N)}`, { x: 1592 / IN, y: 1020 / IN, w: 200 / IN, h: 30 / IN, fontSize: 9.5, bold: true, color: pal.fg.slice(1), fontFace: 'Consolas', align: 'right', margin: 0, valign: 'middle' });
        sl.addShape(p.ShapeType.rect, { x: 0, y: 1075 / IN, w: 1920 / IN * (i + 1) / N, h: 5 / IN, fill: { color: pal.accent.slice(1) }, line: { type: 'none' } });
      }
      if (s.notes) sl.addNotes(String(s.notes));
      if (s.hidden) sl.hidden = true;
    }
    return p;
  }
  return { build, bgCanvas, async save(deck, say) { const p = await build(deck, say); await p.writeFile({ fileName: (deck.id || deck.title || 'TAESTEP') + '.pptx' }); }, async blob(deck) { return (await build(deck)).write({ outputType: 'blob' }); } };
})();
