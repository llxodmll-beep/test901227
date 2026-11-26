/* TAESTEP 편집 — 미리보기 화면 위에서 직접 고치기
   요소 고르기 · 옮기기 · 크기 · 회전 · 자석 붙임 · 그리기 · 글/표 그 자리 편집 · 그림 자르기 · 복사/붙여넣기 · 정렬/묶기/순서
   화면 좌표는 1920×1080 기준(K = 화면 배율). 끄는 동안에는 화면만 움직이고, 놓을 때 교안에 적는다. */
'use strict';
const TSEdit = (() => {
  let host, ov, api, sel = [], tool = null, mode = null, grid = false, snapOn = true, fmtClip = null;
  const K = () => host.clientWidth / 1920;
  const S = () => api.slide();
  const els = () => (Array.isArray(S().els) ? S().els : []);                 // 읽기만 — 보는 것만으로 교안이 바뀌면 안 된다
  const own = () => (S().els = Array.isArray(S().els) ? S().els : []);       // 요소를 넣을 때만 목록을 만든다
  const byId = id => els().find(e => e.id === id);
  const picked = () => sel.map(byId).filter(Boolean);
  const dom = id => host.querySelector(`.ts-el[data-el="${id}"]`);
  const pt = ev => { const r = host.getBoundingClientRect(); return { x: (ev.clientX - r.left) / K(), y: (ev.clientY - r.top) / K() }; };
  const withGroup = ids => { const g = new Set(ids.map(byId).filter(e => e && e.g).map(e => e.g)); return [...new Set([...ids, ...els().filter(e => e.g && g.has(e.g)).map(e => e.id)])]; };
  const bbox = list => { const x = Math.min(...list.map(e => e.x)), y = Math.min(...list.map(e => e.y)); return { x, y, w: Math.max(...list.map(e => e.x + e.w)) - x, h: Math.max(...list.map(e => e.y + e.h)) - y }; };
  const editing = () => !!(document.activeElement && document.activeElement.isContentEditable);

  /* ---------- 고른 것 표시 ---------- */
  function draw(guides) {
    if (!ov) return; const k = K(); const list = picked(); let h = '';
    if (grid) h += '<div class="ed-grid"></div>';
    list.forEach(e => {
      const one = list.length === 1 && !e.lock; const line = e.type === 'line';
      h += `<div class="ed-sel${e.lock ? ' lock' : ''}${mode === 'crop' ? ' crop' : ''}" style="left:${e.x * k}px;top:${e.y * k}px;width:${e.w * k}px;height:${e.h * k}px;transform:rotate(${+e.rot || 0}deg)">`
        + (one && mode !== 'crop' ? (line ? lineHandles(e, k) : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(d => `<i class="ed-h h-${d}" data-h="${d}"></i>`).join('') + '<i class="ed-h h-rot" data-h="rot" title="돌리기"></i>') : '') + '</div>';
    });
    if (list.length > 1) { const b = bbox(list); h += `<div class="ed-box" style="left:${b.x * k}px;top:${b.y * k}px;width:${b.w * k}px;height:${b.h * k}px"></div>`; }
    (guides || []).forEach(g => { h += g.v != null ? `<div class="ed-guide v" style="left:${g.v * k}px"></div>` : `<div class="ed-guide h" style="top:${g.h * k}px"></div>`; });
    if (mode === 'crop') h += '<div class="ed-tip">끌어서 보여 줄 곳을 옮기고, 마우스 휠로 확대합니다 · 테두리 점으로 틀 크기 · Esc 로 끝</div>';
    if (tool) h += `<div class="ed-tip">넣을 자리를 클릭하거나 끌어서 크기를 정하세요 · Esc 취소</div>`;
    ov.innerHTML = h; host.classList.toggle('drawing', !!tool);
  }
  const ends = e => { const a = e.flip ? [[e.x, e.y + e.h], [e.x + e.w, e.y]] : [[e.x, e.y], [e.x + e.w, e.y + e.h]]; return e.rev ? [a[1], a[0]] : a; };
  const lineHandles = (e, k) => ends(e).map((p, i) => `<i class="ed-h" data-h="p${i}" style="left:${(p[0] - e.x) * k}px;top:${(p[1] - e.y) * k}px"></i>`).join('');
  function setLine(e, a, b) { e.x = Math.round(Math.min(a[0], b[0])); e.y = Math.round(Math.min(a[1], b[1])); e.w = Math.round(Math.abs(a[0] - b[0])); e.h = Math.round(Math.abs(a[1] - b[1])); const up = (b[1] - a[1]) * (b[0] - a[0]) < 0; e.flip = up; e.rev = up ? (a[0] > b[0]) : (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])); }
  const paint = e => { const d = dom(e.id); if (!d) return; d.style.cssText = TS.elStyle(e); if (e.type === 'line' || e.type === 'chart') d.innerHTML = TS.elInner(e); };
  function select(ids, keep) { sel = withGroup(keep ? [...new Set([...sel, ...ids])] : ids).filter(byId); if (mode === 'crop') mode = null; draw(); api.onSelect(); }
  function refresh() { sel = sel.filter(byId); draw(); }

  /* ---------- 자석 붙임 ---------- */
  function snap(b, skip, ev) {
    const g = []; if (ev.altKey) return { dx: 0, dy: 0, g };
    if (grid) return { dx: Math.round(b.x / 20) * 20 - b.x, dy: Math.round(b.y / 20) * 20 - b.y, g };
    if (!snapOn) return { dx: 0, dy: 0, g };
    const xs = [128, 960, 1792], ys = [92, 540, 962];
    els().forEach(e => { if (skip.includes(e.id) || e.hide) return; xs.push(e.x, e.x + e.w / 2, e.x + e.w); ys.push(e.y, e.y + e.h / 2, e.y + e.h); });
    const th = 7 / K(); let dx = 0, dy = 0, bx = th, by = th;
    [b.x, b.x + b.w / 2, b.x + b.w].forEach(v => xs.forEach(t => { if (Math.abs(t - v) < bx) { bx = Math.abs(t - v); dx = t - v; g[0] = { v: t }; } }));
    [b.y, b.y + b.h / 2, b.y + b.h].forEach(v => ys.forEach(t => { if (Math.abs(t - v) < by) { by = Math.abs(t - v); dy = t - v; g[1] = { h: t }; } }));
    return { dx, dy, g: g.filter(Boolean) };
  }

  /* ---------- 마우스 ---------- */
  let tap = { t: 0, x: 0, y: 0 };
  function down(ev) {
    if (ev.button !== 0 || editing()) return;
    if (ev.pointerType === 'touch' || ev.pointerType === 'pen') { const now = Date.now(); if (now - tap.t < 380 && Math.hypot(ev.clientX - tap.x, ev.clientY - tap.y) < 28) { tap.t = 0; ev.preventDefault(); return dbl(ev); } tap = { t: now, x: ev.clientX, y: ev.clientY }; } // 터치는 두 번 톡 = 더블클릭
    const p0 = pt(ev);
    if (tool) { ev.preventDefault(); return drawNew(ev, p0); }
    const hd = ev.target.closest('.ed-h'); const one = picked()[0];
    if (hd && one) { ev.preventDefault(); return hd.dataset.h === 'rot' ? rotate(ev, one) : resize(ev, one, hd.dataset.h, p0); }
    const t = ev.target.closest('.ts-el'); const e = t && byId(t.dataset.el);
    if (mode === 'crop' && one && e === one) { ev.preventDefault(); return pan(ev, one, p0); }
    if (e && !e.lock) {
      if (ev.shiftKey) { if (sel.includes(e.id)) { const drop = withGroup([e.id]); sel = sel.filter(i => !drop.includes(i)); draw(); api.onSelect(); } else select([e.id], true); return; }
      if (!sel.includes(e.id)) select([e.id]);
      return move(ev, p0);
    }
    if (ev.target.closest('[data-f], [data-fp]') && !sel.length) return; // 장 유형의 글 — 더블클릭으로 고침
    marquee(ev, p0);
  }
  function track(onMove, onUp) {
    const mv = e => onMove(e), up = e => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); onUp(e); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }
  function move(ev, p0) {
    const list = picked(); const st = list.map(e => ({ e, x: e.x, y: e.y })); const b0 = bbox(list); let moved = false, dup = false;
    track(m => {
      const p = pt(m); let dx = p.x - p0.x, dy = p.y - p0.y; if (!moved && Math.hypot(dx, dy) * K() < 3) return;
      if (!moved && m.ctrlKey) { dup = true; const cp = list.map(e => Object.assign(JSON.parse(JSON.stringify(e)), { id: TS.uid() })); own().push(...cp); api.render(); } // Ctrl+끌기 = 복제해 두고 원본을 옮김
      moved = true; if (m.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      const s = snap({ x: b0.x + dx, y: b0.y + dy, w: b0.w, h: b0.h }, sel, m); dx += s.dx; dy += s.dy;
      st.forEach(o => { o.e.x = Math.round(o.x + dx); o.e.y = Math.round(o.y + dy); paint(o.e); }); draw(s.g);
    }, () => { draw(); if (moved || dup) api.commit(); });
  }
  function resize(ev, e, h, p0) {
    const o = { x: e.x, y: e.y, w: e.w, h: e.h }; const rad = -(+e.rot || 0) * Math.PI / 180; const ratio = o.w / Math.max(1, o.h);
    if (h[0] === 'p') { const en = ends(e); const i = +h[1];
      return track(m => { const p = pt(m); let q = [p.x, p.y]; const other = en[1 - i]; if (m.shiftKey) { if (Math.abs(q[0] - other[0]) > Math.abs(q[1] - other[1])) q[1] = other[1]; else q[0] = other[0]; }
        const s = snap({ x: q[0], y: q[1], w: 0, h: 0 }, [e.id], m); q = [q[0] + s.dx, q[1] + s.dy]; i ? setLine(e, other, q) : setLine(e, q, other); paint(e); draw(s.g); }, () => { draw(); api.commit(); }); }
    track(m => {
      const p = pt(m); const gx = p.x - p0.x, gy = p.y - p0.y; const dx = gx * Math.cos(rad) - gy * Math.sin(rad), dy = gx * Math.sin(rad) + gy * Math.cos(rad);
      let x = o.x, y = o.y, w = o.w, hh = o.h;
      if (h.includes('e')) w = o.w + dx; if (h.includes('s')) hh = o.h + dy; if (h.includes('w')) { w = o.w - dx; x = o.x + dx; } if (h.includes('n')) { hh = o.h - dy; y = o.y + dy; }
      if (m.shiftKey && h.length === 2) { if (w / ratio > hh) { const nh = w / ratio; if (h.includes('n')) y -= nh - hh; hh = nh; } else { const nw = hh * ratio; if (h.includes('w')) x -= nw - w; w = nw; } }
      if (grid) { w = Math.round(w / 20) * 20; hh = Math.round(hh / 20) * 20; }
      if (w < 12) { if (h.includes('w')) x = o.x + o.w - 12; w = 12; } if (hh < 12) { if (h.includes('n')) y = o.y + o.h - 12; hh = 12; }
      Object.assign(e, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(hh) }); paint(e); draw();
    }, () => { api.commit(); });
  }
  function rotate(ev, e) {
    const r = host.getBoundingClientRect(); const cx = r.left + (e.x + e.w / 2) * K(), cy = r.top + (e.y + e.h / 2) * K();
    track(m => { let a = Math.atan2(m.clientY - cy, m.clientX - cx) * 180 / Math.PI + 90; if (m.shiftKey) a = Math.round(a / 15) * 15; else if (Math.abs(((a % 90) + 90) % 90) < 3 || Math.abs(((a % 90) + 90) % 90 - 90) < 3) a = Math.round(a / 90) * 90; e.rot = Math.round(((a % 360) + 360) % 360); paint(e); draw(); }, () => api.commit());
  }
  function pan(ev, e, p0) {
    const o = { px: e.px == null ? 50 : +e.px, py: e.py == null ? 50 : +e.py }; const z = Math.max(1, +e.zoom || 1);
    track(m => { const p = pt(m); const f = 100 / Math.max(.35, z - .4); e.px = Math.max(0, Math.min(100, Math.round(o.px - (p.x - p0.x) / e.w * f))); e.py = Math.max(0, Math.min(100, Math.round(o.py - (p.y - p0.y) / e.h * f))); const d = dom(e.id); if (d) d.innerHTML = TS.elInner(e); }, () => api.commit());
  }
  function marquee(ev, p0) {
    if (!ev.shiftKey && sel.length) { sel = []; mode = null; draw(); api.onSelect(); }
    const box = document.createElement('div'); box.className = 'ed-marq'; let on = false;
    track(m => { const p = pt(m); if (!on && Math.hypot(p.x - p0.x, p.y - p0.y) * K() < 4) return; if (!on) { on = true; ov.appendChild(box); } const k = K(); box.style.cssText = `left:${Math.min(p.x, p0.x) * k}px;top:${Math.min(p.y, p0.y) * k}px;width:${Math.abs(p.x - p0.x) * k}px;height:${Math.abs(p.y - p0.y) * k}px`; },
      m => { if (!on) return; const p = pt(m); const x1 = Math.min(p.x, p0.x), x2 = Math.max(p.x, p0.x), y1 = Math.min(p.y, p0.y), y2 = Math.max(p.y, p0.y); select(els().filter(e => !e.lock && !e.hide && e.x < x2 && e.x + e.w > x1 && e.y < y2 && e.y + e.h > y1).map(e => e.id), m.shiftKey); });
  }
  function drawNew(ev, p0) {
    const t = tool; const box = document.createElement('div'); box.className = 'ed-marq'; ov.appendChild(box); let last = p0;
    track(m => { last = pt(m); const k = K(); box.style.cssText = `left:${Math.min(last.x, p0.x) * k}px;top:${Math.min(last.y, p0.y) * k}px;width:${Math.abs(last.x - p0.x) * k}px;height:${Math.abs(last.y - p0.y) * k}px`; }, () => {
      const w = Math.abs(last.x - p0.x), h = Math.abs(last.y - p0.y); const big = w > 12 || h > 12; let e;
      if (t.type === 'line') { e = TS.newEl('line', p0.x, p0.y, 0, 0, t.more); setLine(e, [p0.x, p0.y], big ? [last.x, last.y] : [p0.x + 400, p0.y]); }
      else e = TS.newEl(t.type, big ? Math.min(last.x, p0.x) : p0.x, big ? Math.min(last.y, p0.y) : p0.y, big ? w : 0, big ? Math.max(h, 12) : 0, t.more);
      tool = null; add([e]); if (e.type === 'text') setTimeout(() => editText(e.id, true), 30);
    });
  }
  function add(list, keepPos) { own().push(...list); sel = list.map(e => e.id); api.commit(true); draw(); api.onSelect(); return list; }
  const setTool = (type, more) => { tool = type ? { type, more } : null; if (tool) sel = []; draw(); api.onSelect(); };

  /* ---------- 그 자리에서 글 고치기 ---------- */
  function dbl(ev) {
    if (editing()) return;
    const t = ev.target.closest('.ts-el'); const e = t && byId(t.dataset.el);
    if (e && !e.lock) {
      const td = ev.target.closest('td[data-c]'); if (e.type === 'table' && td) return editCell(e, td);
      if (e.type === 'text' || e.type === 'shape') return editText(e.id);
      if (e.type === 'image') { if (!e.src) return api.pickImage(src => { e.src = src; api.commit(true); }); select([e.id]); mode = 'crop'; draw(); return; }
      return;
    }
    const f = ev.target.closest('[data-f]'); if (f) return editField(f);
    const fp = ev.target.closest('[data-fp]'); if (fp) api.focusField(fp.dataset.fp);
  }
  function caretAll(n) { const r = document.createRange(); r.selectNodeContents(n); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  function editText(id, all) {
    const e = byId(id), d = dom(id); if (!e || !d) return; const n = d.querySelector('.tx-in'); if (!n) return;
    select([id]); n.contentEditable = 'true'; d.classList.add('editing'); n.focus(); if (all || !n.textContent.trim()) caretAll(n); else { const r = document.createRange(); r.selectNodeContents(n); r.collapse(false); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); } // 커서는 글 끝에
    const done = () => { n.removeEventListener('blur', done); n.contentEditable = 'false'; d.classList.remove('editing'); const html = TS.clean(n.innerHTML); const hh = Math.ceil(n.offsetHeight + (e.fill ? (+e.pad || 0) * 2 : 0));
      if (html !== e.html || (e.type === 'text' && hh > e.h)) { e.html = html; if (e.type === 'text' && hh > e.h) e.h = hh; api.commit(true); } else draw(); api.onSelect(); };
    n.addEventListener('blur', done);
    n.onkeydown = k => { if (k.key === 'Escape') { k.preventDefault(); n.blur(); } k.stopPropagation(); };
    api.onSelect();
  }
  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); const t = ks.reduce((a, k) => a[k], o); t[last] = v; };
  function editField(n) {
    const path = n.dataset.f; const raw = getPath(S(), path); if (raw == null) return;
    n.textContent = raw; n.contentEditable = 'plaintext-only'; if (n.contentEditable !== 'plaintext-only') n.contentEditable = 'true';
    n.classList.add('ed-field'); n.focus(); caretAll(n); let cancel = false;
    const done = () => { n.removeEventListener('blur', done); const v = n.innerText.replace(/\n$/, ''); if (!cancel && v !== raw) { setPath(S(), path, v); api.commit(true, true); } else api.render(); };
    n.addEventListener('blur', done);
    n.onkeydown = k => { if (k.key === 'Escape') { cancel = true; n.blur(); } else if (k.key === 'Enter' && !k.shiftKey && !/title|subtitle|body|meta|\.d$/.test(path)) { k.preventDefault(); n.blur(); } k.stopPropagation(); };
  }
  function editCell(e, td) {
    const [r, c] = td.dataset.c.split(',').map(Number); td.textContent = e.rows[r][c] || ''; td.contentEditable = 'plaintext-only'; if (td.contentEditable !== 'plaintext-only') td.contentEditable = 'true'; td.focus(); caretAll(td);
    let next = null; const done = () => { td.removeEventListener('blur', done); const v = td.innerText.replace(/\n$/, ''); const ch = v !== (e.rows[r][c] || ''); e.rows[r][c] = v; if (ch) api.commit(true); else api.render();
      if (next) setTimeout(() => { const d = dom(e.id); const t = d && d.querySelector(`td[data-c="${next}"]`); if (t) editCell(e, t); }, 20); };
    td.addEventListener('blur', done);
    td.onkeydown = k => { k.stopPropagation(); if (k.key === 'Escape') { k.preventDefault(); td.blur(); } else if (k.key === 'Tab') { k.preventDefault(); let nc = c + (k.shiftKey ? -1 : 1), nr = r; if (nc >= e.rows[r].length) { nc = 0; nr++; } if (nc < 0) { nr--; nc = e.rows[r].length - 1; } if (nr >= 0 && nr < e.rows.length) next = `${nr},${nc}`; td.blur(); } };
  }
  /* 글 서식: 편집 중이면 고른 글자에, 아니면 글상자 전체에 */
  function fmt(cmd, val) {
    const list = picked().filter(e => e.type === 'text' || e.type === 'shape'); if (!list.length) return;
    const run = () => { document.execCommand('styleWithCSS', false, true); document.execCommand(cmd, false, val); };
    if (editing()) return run();
    list.forEach(e => { const d = dom(e.id); const n = d && d.querySelector('.tx-in'); if (!n) return; n.contentEditable = 'true'; n.focus(); caretAll(n); run(); e.html = TS.clean(n.innerHTML); n.contentEditable = 'false'; });
    getSelection().removeAllRanges(); api.commit(true);
  }
  const setProp = (o, types) => { picked().filter(e => !types || types.includes(e.type)).forEach(e => Object.keys(o).forEach(k => { if (o[k] === undefined) delete e[k]; else e[k] = o[k]; })); api.commit(true, true); };

  /* ---------- 정렬 · 순서 · 묶기 · 복사 ---------- */
  const OPS = {
    del() { if (!sel.length) return; S().els = els().filter(e => !sel.includes(e.id)); sel = []; api.commit(true); },
    dup() { const cp = picked().map(e => Object.assign(JSON.parse(JSON.stringify(e)), { id: TS.uid(), x: e.x + 30, y: e.y + 30 })); regroup(cp); if (cp.length) add(cp); },
    front() { const p = picked(); S().els = [...els().filter(e => !sel.includes(e.id)), ...p]; api.commit(true); },
    back() { const p = picked(); S().els = [...p, ...els().filter(e => !sel.includes(e.id))]; api.commit(true); },
    forward() { const a = els(); for (let i = a.length - 2; i >= 0; i--) if (sel.includes(a[i].id) && !sel.includes(a[i + 1].id)) [a[i], a[i + 1]] = [a[i + 1], a[i]]; api.commit(true); },
    backward() { const a = els(); for (let i = 1; i < a.length; i++) if (sel.includes(a[i].id) && !sel.includes(a[i - 1].id)) [a[i], a[i - 1]] = [a[i - 1], a[i]]; api.commit(true); },
    group() { const p = picked(); if (p.length < 2) return; const g = TS.uid(); p.forEach(e => e.g = g); api.commit(true); },
    ungroup() { picked().forEach(e => delete e.g); api.commit(true); },
    lock() { const p = picked(); const on = !p.every(e => e.lock); p.forEach(e => on ? e.lock = true : delete e.lock); api.commit(true); },
    hide() { const p = picked(); const on = !p.every(e => e.hide); p.forEach(e => on ? e.hide = true : delete e.hide); api.commit(true); },
    all() { select(els().filter(e => !e.lock && !e.hide).map(e => e.id)); },
    copy() { const p = picked(); if (!p.length) return false; try { localStorage.setItem('taestep:clip', JSON.stringify({ t: Date.now(), els: p })); localStorage.removeItem('taestep:slide'); } catch (e) { } try { navigator.clipboard.writeText('taestep-clip').catch(() => { }); } catch (e) { } return true; },
    cut() { if (OPS.copy()) OPS.del(); },
    paste() { let c = null; try { c = JSON.parse(localStorage.getItem('taestep:clip') || 'null'); } catch (e) { } if (!c || !c.els || !c.els.length) return false; const same = c.els.some(e => byId(e.id)); const cp = c.els.map(e => Object.assign(JSON.parse(JSON.stringify(e)), { id: TS.uid(), x: e.x + (same ? 30 : 0), y: e.y + (same ? 30 : 0) })); regroup(cp); add(cp); try { localStorage.setItem('taestep:clip', JSON.stringify({ t: c.t, els: cp })); } catch (e) { } return true; },
    fmtCopy() { const e = picked()[0]; if (e) { fmtClip = {}; ['fs', 'color', 'align', 'lh', 'weight', 'font', 'fill', 'stroke', 'sw', 'radius', 'shadow', 'dash', 'op', 'mask', 'br', 'ct', 'sat', 'gray'].forEach(k => { if (e[k] !== undefined) fmtClip[k] = e[k]; }); fmtClip._t = e.type; } },
    fmtPaste() { if (!fmtClip) return; picked().forEach(e => Object.keys(fmtClip).forEach(k => { if (k !== '_t' && (e.type === fmtClip._t || ['color', 'stroke', 'sw', 'shadow', 'fs', 'weight'].includes(k))) e[k] = fmtClip[k]; })); api.commit(true); },
  };
  const regroup = cp => { const m = {}; cp.forEach(e => { if (e.g) e.g = m[e.g] || (m[e.g] = TS.uid()); }); };
  function align(how) {
    const p = picked(); if (!p.length) return; const b = p.length > 1 ? bbox(p) : { x: 0, y: 0, w: 1920, h: 1080 };
    p.forEach(e => { if (how === 'l') e.x = b.x; if (how === 'c') e.x = Math.round(b.x + b.w / 2 - e.w / 2); if (how === 'r') e.x = b.x + b.w - e.w; if (how === 't') e.y = b.y; if (how === 'm') e.y = Math.round(b.y + b.h / 2 - e.h / 2); if (how === 'b') e.y = b.y + b.h - e.h; });
    api.commit(true);
  }
  function distribute(ax) {
    const p = picked(); if (p.length < 3) return; const k = ax === 'h' ? 'x' : 'y', d = ax === 'h' ? 'w' : 'h'; const a = [...p].sort((m, n) => m[k] - n[k]);
    const total = a[a.length - 1][k] + a[a.length - 1][d] - a[0][k]; const gap = (total - a.reduce((s, e) => s + e[d], 0)) / (a.length - 1); let pos = a[0][k];
    a.forEach(e => { e[k] = Math.round(pos); pos += e[d] + gap; }); api.commit(true);
  }
  function same(d) { const p = picked(); if (p.length < 2) return; p.slice(1).forEach(e => { if (d !== 'h') e.w = p[0].w; if (d !== 'w') e.h = p[0].h; }); api.commit(true); }
  function nudge(dx, dy) { const p = picked().filter(e => !e.lock); if (!p.length) return false; p.forEach(e => { e.x += dx; e.y += dy; paint(e); }); draw(); api.commit(); return true; }

  /* ---------- 단축키 (PowerPoint 배치) — 처리했으면 true ---------- */
  function key(e) {
    if (editing()) return false; const c = e.ctrlKey || e.metaKey, k = e.key, has = sel.length > 0;
    if (k === 'Escape') { if (tool) { setTool(null); return true; } if (mode === 'crop') { mode = null; draw(); return true; } if (has) { select([]); return true; } return false; }
    if (c && k.toLowerCase() === 'a') { OPS.all(); return true; }
    if (c && e.shiftKey && k.toLowerCase() === 'c' && has) { OPS.fmtCopy(); return true; }
    if (c && e.shiftKey && k.toLowerCase() === 'v' && has) { OPS.fmtPaste(); return true; }
    if (c && k.toLowerCase() === 'c' && has) { OPS.copy(); return true; }
    if (c && k.toLowerCase() === 'x' && has) { OPS.cut(); return true; }
    if (k === 'Tab') { const a = els().filter(x => !x.lock && !x.hide); if (!a.length) return false; const i = a.findIndex(x => x.id === sel[0]); select([a[(i + (e.shiftKey ? -1 : 1) + a.length) % a.length].id]); return true; }
    if (!has) return false;
    if (k === 'Delete' || k === 'Backspace') { OPS.del(); return true; }
    if (c && k.toLowerCase() === 'd' && !e.shiftKey) { OPS.dup(); return true; }
    if (c && k.toLowerCase() === 'g') { e.shiftKey ? OPS.ungroup() : OPS.group(); return true; }
    if (c && k === ']') { e.shiftKey ? OPS.front() : OPS.forward(); return true; }
    if (c && k === '[') { e.shiftKey ? OPS.back() : OPS.backward(); return true; }
    if (c && 'biu'.includes(k.toLowerCase()) && k.length === 1) { fmt({ b: 'bold', i: 'italic', u: 'underline' }[k.toLowerCase()]); return true; }
    if (k === 'Enter' || k === 'F2') { const x = picked()[0]; if (x && (x.type === 'text' || x.type === 'shape')) { editText(x.id); return true; } return false; }
    const st = c ? 1 : e.shiftKey ? 50 : 10;
    if (k === 'ArrowLeft') return nudge(-st, 0); if (k === 'ArrowRight') return nudge(st, 0); if (k === 'ArrowUp') return nudge(0, -st); if (k === 'ArrowDown') return nudge(0, st);
    return false;
  }
  function wheel(ev) { const e = picked()[0]; if (mode !== 'crop' || !e) return; ev.preventDefault(); e.zoom = Math.max(1, Math.min(5, Math.round(((+e.zoom || 1) - ev.deltaY / 600) * 100) / 100)); const d = dom(e.id); if (d) d.innerHTML = TS.elInner(e); clearTimeout(wheel.t); wheel.t = setTimeout(() => api.commit(false, true), 300); }

  function init(h, a) {
    host = h; api = a; ov = document.createElement('div'); ov.className = 'ed-ov'; host.appendChild(ov);
    host.addEventListener('pointerdown', down); host.addEventListener('dblclick', dbl); host.addEventListener('wheel', wheel, { passive: false }); host._onResize = () => draw();
  }
  return { init, refresh, select, picked, setTool, tool: () => tool, add, fmt, setProp, OPS, align, distribute, same, key, editing, editText, byId, els,
    crop(on) { mode = on ? 'crop' : null; draw(); }, cropping: () => mode === 'crop',
    get grid() { return grid; }, set grid(v) { grid = v; draw(); }, get snap() { return snapOn; }, set snap(v) { snapOn = v; } };
})();
