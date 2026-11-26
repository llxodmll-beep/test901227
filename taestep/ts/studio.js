/* TAESTEP 편집 화면 — 왼쪽 장 목록 · 가운데 미리보기(직접 편집) · 오른쪽 입력 칸
   장 유형을 고르고 칸만 채워도 되고, 화면 위에 글상자 · 그림 · 도형 · 표 · 차트를 얹어 직접 고쳐도 된다.
   고친 내용은 이 기기에 바로 보관되고, [저장] 을 누르면 GitHub 저장소에 올라간다. */
'use strict';
(async () => {
  const $ = id => document.getElementById(id);
  const E = TS.E;
  const q = new URLSearchParams(location.search); const id = q.get('deck') || '';
  let deck = id ? await TSStore.load(id) : null;
  if (!deck) { document.body.innerHTML = '<div class="empty-page"><h1>교안을 찾지 못했습니다</h1><p><a href="./">목록으로 돌아가기</a></p></div>'; return; }
  deck.id = id; deck.slides = Array.isArray(deck.slides) && deck.slides.length ? deck.slides : [TS.blank('cover')];
  deck.slides.forEach(s => { if (!s.id) s.id = TS.uid(); });
  let cur = Math.min(deck.slides.length - 1, Math.max(0, (parseInt(location.hash.slice(1), 10) || 1) - 1));
  let tab = 'content', dirty = false;
  let hist = [JSON.stringify(deck)], hi = 0, histT = 0, draftT = 0, viewT = 0, railT = 0;
  const S = () => deck.slides[cur];

  /* ---------- 알림 · 창 ---------- */
  let toastT = 0;
  const toast = (t, bad) => { const o = $('toast'); o.textContent = t; o.className = 'toast' + (bad ? ' bad' : ''); o.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { o.hidden = true; }, 3600); };
  const modal = (html, cls) => { const m = $('modal'); m.innerHTML = `<div class="sheet ${cls || ''}">${html}</div>`; m.hidden = false; m.onclick = e => { if (e.target === m) closeModal(); }; return m.firstChild; };
  const closeModal = () => { $('modal').hidden = true; $('modal').innerHTML = ''; };

  /* ---------- 바뀜 처리 · 되돌리기 ---------- */
  const state = () => { $('state').textContent = dirty ? '저장 안 된 변경 있음 (이 기기에 보관 중)' : '저장됨'; $('state').classList.toggle('warn', dirty); };
  function mark() {
    dirty = true; deck.modified = new Date().toISOString(); state();
    clearTimeout(draftT); draftT = setTimeout(() => TSStore.draftPut(deck), 500);
    clearTimeout(histT); histT = setTimeout(snapshot, 450);
  }
  function snapshot() { clearTimeout(histT); const j = JSON.stringify(deck); if (j === hist[hi]) return; hist = hist.slice(0, hi + 1); hist.push(j); if (hist.length > 80) hist.shift(); hi = hist.length - 1; }
  function changed(structure) { mark(); if (structure) { rail(); view(); } else { clearTimeout(viewT); viewT = setTimeout(() => { view(); railOne(cur); }, 120); } }
  function restore(n) { hi = n; deck = JSON.parse(hist[hi]); deck.id = id; cur = Math.min(cur, deck.slides.length - 1); dirty = true; state(); TSStore.draftPut(deck); $('deckTitle').value = deck.title || ''; TSEdit.select([]); rail(); view(); panel(); }
  function undo() { snapshot(); if (hi < 1) { toast('되돌릴 내용이 없습니다'); return; } restore(hi - 1); }
  function redo() { if (hi >= hist.length - 1) { toast('다시 실행할 내용이 없습니다'); return; } restore(hi + 1); }

  /* ---------- 그리기 ---------- */
  function view() { const el = TS.thumb(deck, S(), cur, deck.slides.length, $('view'), { edit: true }); TSEdit.refresh(); return el; }
  function railOne(i) { const host = $('rail').children[i]; if (host) { TS.thumb(deck, deck.slides[i], i, deck.slides.length, host.querySelector('.pic')); host.querySelector('.lay').textContent = (TS.LAYOUTS[deck.slides[i].layout] || {}).name || ''; } }
  function rail() {
    const r = $('rail'); r.innerHTML = '';
    deck.slides.forEach((s, i) => {
      const d = document.createElement('div'); d.className = 'rail-item' + (i === cur ? ' cur' : ''); d.draggable = true;
      d.innerHTML = `<span class="no">${i + 1}</span><div class="pic"></div><span class="lay"></span>`;
      d.onclick = () => select(i);
      d.ondragstart = e => { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; };
      d.ondragover = e => { e.preventDefault(); d.classList.add('over'); }; d.ondragleave = () => d.classList.remove('over');
      d.ondrop = e => { e.preventDefault(); d.classList.remove('over'); const from = +e.dataTransfer.getData('text/plain'); if (isNaN(from) || from === i) return; const [m] = deck.slides.splice(from, 1); deck.slides.splice(i, 0, m); cur = i; changed(true); panel(); };
      r.appendChild(d); railOne(i);
    });
    const c = r.querySelector('.cur'); if (c) c.scrollIntoView({ block: 'nearest' });
  }
  function select(i) { cur = Math.max(0, Math.min(deck.slides.length - 1, i)); TSEdit.select([]); [...$('rail').children].forEach((d, k) => d.classList.toggle('cur', k === cur)); const c = $('rail').children[cur]; if (c) c.scrollIntoView({ block: 'nearest' }); view(); panel(); try { history.replaceState(null, '', '#' + (cur + 1)); } catch (e) { } }

  /* ---------- 그림 고르기 ---------- */
  const shrink = file => new Promise((res, rej) => { const im = new Image(); const u = URL.createObjectURL(file); im.onload = () => { const k = Math.min(1, 1920 / im.width); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); const png = /png|svg|gif|webp/.test(file.type); const x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res({ src: png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', .86), w: c.width, h: c.height }); }; im.onerror = rej; im.src = u; });
  async function pickImage(done) {
    const sh = modal(`<h3>그림 고르기</h3><div class="row"><button id="upBtn" class="btn pri">내 그림 올리기</button><input id="upFile" type="file" accept="image/*" hidden><span class="muted">가로 1920 으로 줄여 넣습니다. 저장할 때 저장소에 올라갑니다.</span></div><div id="lib" class="lib"><p class="muted">불러오는 중…</p></div><div class="row end"><button class="btn ghost" id="mClose">닫기</button></div>`, 'wide');
    sh.querySelector('#mClose').onclick = closeModal; sh.querySelector('#upBtn').onclick = () => sh.querySelector('#upFile').click();
    sh.querySelector('#upFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const r = await shrink(f); closeModal(); done(r.src, r); } catch (err) { toast('그림을 읽지 못했습니다', true); } };
    const used = [...new Set(deck.slides.flatMap(s => [s.bg && s.bg.src, s.image && s.image.src, ...(s.els || []).map(e => e.src)]).filter(x => x && !TS.isVideo(x)))];
    const lib = await TSStore.media(); const all = [...new Set([...used, ...lib.map(x => x.src)])];
    const box = sh.querySelector('#lib'); if (!box) return;
    box.innerHTML = all.length ? all.map(src => `<button class="lib-item" data-src="${E(src)}" style="background-image:url('${src.replace(/'/g, '%27')}')"></button>`).join('') : '<p class="muted">아직 그림이 없습니다. 내 그림을 올려 주세요.</p>';
    box.onclick = e => { const b = e.target.closest('.lib-item'); if (b) { closeModal(); done(b.dataset.src); } };
  }
  const addImage = (src, size, at) => { const w = size ? Math.min(900, size.w) : 760, h = size ? Math.round(w * size.h / size.w) : 480; TSEdit.add([TS.newEl('image', at ? at.x - w / 2 : (1920 - w) / 2, at ? at.y - h / 2 : (1080 - h) / 2, w, h, { src, mask: 'round', radius: 20 })]); };

  /* ---------- 오른쪽 칸: 내용 · 요소 · 배경 · 노트 ---------- */
  const HINT = { title: '*별표 사이* 는 강조색으로 나옵니다 · 화면의 글을 더블클릭해도 고칠 수 있습니다', meta: '한 줄에 하나 · "교수요원: 김태의" 처럼 쓰면 라벨과 값으로 나뉩니다', source: '예: 출처 · 소방청 통계연보(2025)' };
  const ROWS = { title: 2, subtitle: 2, body: 6, meta: 3, kicker: 1, k: 1, source: 1 };
  const ta = (key, val, rows, ph) => rows > 1 ? `<textarea data-k="${key}" rows="${rows}" placeholder="${E(ph || '')}">${E(val || '')}</textarea>` : `<input data-k="${key}" value="${E(val || '')}" placeholder="${E(ph || '')}">`;
  const range = (attr, label, v, min, max, step, unit) => `<label class="f"><span>${label} <small>${v}${unit || ''}</small></span><input type="range" ${attr} min="${min}" max="${max}" step="${step || 1}" value="${v}"></label>`;
  const cropUi = (attr, o) => range(`${attr}="zoom"`, '확대', Math.round((+o.zoom || 1) * 100), 100, 400, 5, '%') + `<div class="grid2">${range(`${attr}="px"`, '좌우 위치', o.px == null ? 50 : +o.px, 0, 100)}${range(`${attr}="py"`, '위아래 위치', o.py == null ? 50 : +o.py, 0, 100)}</div>`;
  function panel() {
    const picked = TSEdit.picked(); const show = picked.length ? 'el' : tab;
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === show));
    const p = $('panel'); const s = S(); const L = TS.LAYOUTS[s.layout] || TS.LAYOUTS.bullets;
    if (show === 'el') { p.innerHTML = picked.length ? elPanel(picked) : listPanel(); return; }
    if (show === 'content') {
      let h = `<label class="f"><span>장 유형</span><select id="fLayout">${Object.entries(TS.LAYOUTS).map(([k, v]) => `<option value="${k}"${k === s.layout ? ' selected' : ''}>${v.name}</option>`).join('')}</select></label>`;
      if (s.layout === 'free') h += '<p class="muted small">빈 장입니다. 위의 도구(글상자 · 그림 · 도형 …)로 넣고, 화면에서 직접 옮기고 고칩니다.</p>';
      L.f.forEach(k => {
        if (k === 'items') {
          h += `<div class="f"><span>${s.layout === 'compare' ? '비교 대상 (2개)' : '항목'} <small>최대 ${L.max}개</small></span><div id="items">${(s.items || []).map((x, i) => `<div class="item" data-i="${i}"><div class="item-h"><b>${i + 1}</b><span class="sp"></span><button data-act="up" title="위로">↑</button><button data-act="down" title="아래로">↓</button><button data-act="del" title="지우기">✕</button></div>${L.it.map(f => f === 'd' ? `<textarea data-f="${f}" rows="${s.layout === 'compare' ? 4 : 2}" placeholder="${TS.ITEM_LABEL[f]}${s.layout === 'compare' ? ' (한 줄에 하나씩)' : ''}">${E(x[f] || '')}</textarea>` : `<input data-f="${f}" value="${E(x[f] || '')}" placeholder="${TS.ITEM_LABEL[f]}">`).join('')}</div>`).join('')}</div>${(s.items || []).length < L.max ? '<button id="itemAdd" class="btn ghost wide">+ 항목 추가</button>' : ''}</div>`;
          if (L.build) h += `<label class="chk"><input type="checkbox" id="fBuild"${s.build !== false ? ' checked' : ''}> 클릭할 때마다 하나씩 등장</label>`;
        } else if (k === 'image') {
          const im = s.image || {};
          h += `<div class="f"><span>그림</span><div class="pick"><div class="pick-pic" style="${im.src ? `background-image:url('${im.src.replace(/'/g, '%27')}')` : ''}"></div><div class="pick-btn"><button class="btn ghost" data-pick="image">그림 고르기</button>${im.src ? '<button class="btn ghost" data-clear="image">없애기</button>' : ''}</div></div><input data-img="caption" value="${E(im.caption || '')}" placeholder="그림 설명 (선택)"></div>${im.src ? '<div class="sub-h">그림 자르기</div>' + cropUi('data-imgn', im) : ''}`;
        } else if (k === 'side') {
          h += `<label class="f"><span>그림 위치</span><select data-k="side"><option value="right"${s.side !== 'left' ? ' selected' : ''}>오른쪽</option><option value="left"${s.side === 'left' ? ' selected' : ''}>왼쪽</option></select></label>`;
        } else {
          const ph = k === 'body' && s.layout === 'table' ? '첫 줄은 머리글 · 칸은 | 로 나눕니다\n구분 | 내용 | 비고' : '';
          h += `<label class="f"><span>${TS.FIELD_LABEL[k]}</span>${ta(k, s[k], k === 'body' && s.layout === 'table' ? 8 : ROWS[k] || 1, ph)}${HINT[k] ? `<small>${HINT[k]}</small>` : ''}</label>`;
        }
      });
      p.innerHTML = h;
    } else if (show === 'bg') {
      const b = s.bg || {};
      p.innerHTML = `<div class="f"><span>전면 배경</span><div class="pick big"><div class="pick-pic" style="${b.src ? `background-image:url('${b.src.replace(/'/g, '%27')}')` : ''}">${b.src ? '' : '<i>배경 그림 없음<br>(빛 · 격자 배경으로 나옵니다)</i>'}</div></div><div class="pick-btn"><button class="btn ghost" data-pick="bg">그림 고르기</button>${b.src ? '<button class="btn ghost" data-clear="bg">없애기</button>' : ''}</div></div>
        ${b.src ? '<div class="sub-h">배경 자르기 (보여 줄 곳)</div>' + cropUi('data-bgn', b) : ''}
        <label class="f"><span>배경 움직임</span><select data-bg="motion">${Object.entries(TS.MOTIONS).map(([k, v]) => `<option value="${k}"${(b.motion || 'zoom-in') === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="f"><span>글자가 읽히게 덮는 방식</span><select data-bg="tone">${Object.entries(TS.TONES).map(([k, v]) => `<option value="${k}"${(b.tone || L.tone) === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        ${range('data-bgn="dim"', '덮는 세기', Math.round((b.dim == null ? L.dim : b.dim) * 100), 0, 95, 1, '%')}
        ${!b.src && deck.bg && deck.bg.src ? `<label class="chk"><input type="checkbox" id="bgOff"${b.off ? ' checked' : ''}> 이 장에는 교안 기본 배경도 깔지 않음</label>` : ''}
        <p class="muted small">그림을 고르지 않은 장에는 [교안 설정] 의 기본 배경이 어둡게 깔립니다.</p>`;
    } else {
      p.innerHTML = `<label class="f"><span>이 장의 시간</span><input data-k="time" value="${E(s.time || '')}" placeholder="예: 3분"></label>
        <label class="f grow"><span>발표 노트</span><textarea data-k="notes" rows="18" placeholder="말할 내용 · 출처 · 클릭 순서를 적어 둡니다. 발표자 화면(P)에 보입니다.">${E(s.notes || '')}</textarea></label>`;
    }
  }
  /* 요소 칸 */
  const TYPE = { text: '글상자', image: '그림', shape: '도형', line: '선', icon: '아이콘', table: '표', chart: '차트' };
  const pal = () => TS.palette(deck);
  const swatch = (key, label, val, none) => `<div class="f"><span>${label}</span><div class="sws" data-ck="${key}">${none ? `<button data-cv="" class="none${!val || val === 'none' ? ' on' : ''}" title="없음"></button>` : ''}${['title', 'fg', 'muted', 'accent', 'ink', 'bg2'].map(t => `<button data-cv="${t}" class="${val === t ? 'on' : ''}" style="background:${pal()[t]}" title="테마 색 (테마를 바꾸면 함께 바뀜)"></button>`).join('')}${['#FF5A5F', '#FFC56B', '#3DDC97'].map(c => `<button data-cv="${c}" class="${val === c ? 'on' : ''}" style="background:${c}"></button>`).join('')}<input type="color" data-cc="${key}" value="${/^#[0-9a-f]{6}$/i.test(val || '') ? val : '#4DEBFF'}" title="직접 고르기"></div></div>`;
  const numIn = (k, label, v, step) => `<label class="f"><span>${label}</span><input type="number" data-p="${k}" step="${step || 1}" value="${v}"></label>`;
  const sel = (k, label, opts, v) => `<label class="f"><span>${label}</span><select data-ps="${k}">${Object.entries(opts).map(([a, b]) => `<option value="${a}"${String(v) === a ? ' selected' : ''}>${b}</option>`).join('')}</select></label>`;
  const chk = (k, label, v) => `<label class="chk"><input type="checkbox" data-pb="${k}"${v ? ' checked' : ''}> ${label}</label>`;
  const btns = list => `<div class="bar">${list.map(([a, t, tip]) => `<button class="tb" data-op="${a}" title="${tip || t}">${t}</button>`).join('')}</div>`;
  function elPanel(list) {
    const e = list[0]; const one = list.length === 1; const t = e.type; const same = list.every(x => x.type === t);
    let h = `<div class="el-head"><b>${one ? TYPE[t] : `요소 ${list.length}개`}</b><span class="sp"></span><button class="tb" data-op="dup" title="복제 (Ctrl+D)">복제</button><button class="tb danger" data-op="del" title="지우기 (Delete)">지우기</button></div>`;
    if (same && (t === 'text' || t === 'shape')) {
      h += `<div class="sub-h">글</div><div class="bar fmt"><button class="tb" data-fmt="bold" title="굵게 (Ctrl+B)"><b>가</b></button><button class="tb" data-fmt="italic" title="기울임 (Ctrl+I)"><i>가</i></button><button class="tb" data-fmt="underline" title="밑줄 (Ctrl+U)"><u>가</u></button><button class="tb" data-fmt="hilite" title="형광펜">형광</button><button class="tb" data-fmt="accent" title="강조색으로">강조</button><button class="tb" data-fmt="insertUnorderedList" title="글머리">•</button><button class="tb" data-fmt="insertOrderedList" title="번호">1.</button><button class="tb" data-fmt="removeFormat" title="서식 지우기">지움</button></div>
        <p class="muted small">글을 더블클릭해 고치는 중에는 고른 글자에만, 아니면 전체에 적용됩니다.</p>
        <div class="grid2">${numIn('fs', '글자 크기', e.fs || 32)}${sel('weight', '굵기', { 400: '보통', 500: '중간', 600: '굵게', 700: '아주 굵게' }, e.weight || (t === 'shape' ? 600 : 400))}
        ${sel('align', '정렬', { left: '왼쪽', center: '가운데', right: '오른쪽', justify: '양쪽' }, e.align || (t === 'shape' ? 'center' : 'left'))}${numIn('lh', '줄간격', e.lh || 1.4, .05)}</div>${swatch('color', '글자색', e.color || 'fg')}`;
      if (t === 'text') h += `<div class="grid2">${sel('valign', '세로 위치', { top: '위', middle: '가운데', bottom: '아래' }, e.valign || 'top')}${sel('font', '글꼴', { body: '기본', mono: '고정폭(숫자 · 영문)' }, e.font || 'body')}</div>${swatch('fill', '글상자 배경', e.fill, true)}${e.fill ? `<div class="grid2">${numIn('pad', '안쪽 여백', e.pad || 0)}${numIn('radius', '모서리', e.radius || 0)}</div>` : ''}`;
    }
    if (same && t === 'shape') h += `<div class="sub-h">도형</div>${sel('shape', '모양', TS.SHAPES, e.shape)}${swatch('fill', '채우기', e.fill || 'accent', true)}${swatch('stroke', '테두리 색', e.stroke, true)}<div class="grid2">${numIn('sw', '테두리 굵기', e.sw || 0)}${numIn('radius', '모서리', e.radius == null ? 22 : e.radius)}</div>${range('data-pn="op"', '불투명도', Math.round((e.op == null ? 1 : e.op) * 100), 10, 100, 5, '%')}${chk('dash', '점선 테두리', e.dash)}${chk('shadow', '그림자', e.shadow)}`;
    if (same && t === 'image') h += `<div class="sub-h">그림</div><div class="row"><button class="btn ghost" data-op="imgPick">그림 바꾸기</button><button class="btn ${TSEdit.cropping() ? 'pri' : 'ghost'}" data-op="crop">${TSEdit.cropping() ? '자르기 끝' : '자르기'}</button></div><p class="muted small">자르기: 그림을 더블클릭해도 됩니다. 끌어서 보여 줄 곳을 옮기고, 테두리 점으로 틀 크기를 바꿉니다.</p>${cropUi('data-pn', e)}${sel('mask', '모양 틀', TS.MASKS, e.mask || 'none')}${(e.mask || 'none') === 'round' ? numIn('radius', '모서리', e.radius == null ? 24 : e.radius) : ''}
      <div class="sub-h">보정</div>${range('data-pn="br"', '밝기', e.br == null ? 100 : e.br, 30, 170, 1, '%')}${range('data-pn="ct"', '대비', e.ct == null ? 100 : e.ct, 30, 170, 1, '%')}${range('data-pn="sat"', '채도', e.sat == null ? 100 : e.sat, 0, 200, 1, '%')}${chk('gray', '흑백', e.gray)}${swatch('stroke', '테두리 색', e.stroke, true)}${numIn('sw', '테두리 굵기', e.sw || 0)}${chk('shadow', '그림자', e.shadow)}`;
    if (same && t === 'line') h += `<div class="sub-h">선</div>${swatch('stroke', '선 색', e.stroke || 'accent')}<div class="grid2">${numIn('sw', '굵기', e.sw || 4)}${sel('arrow', '화살표', { none: '없음', end: '끝', both: '양쪽' }, e.arrow || 'none')}</div>${chk('dash', '점선', e.dash)}`;
    if (same && t === 'icon') h += `<div class="sub-h">아이콘</div><div class="row"><button class="btn ghost" data-op="iconPick">아이콘 바꾸기</button></div>${swatch('color', '색', e.color || 'accent')}${numIn('sw', '선 굵기', e.sw || 1.75, .25)}`;
    if (one && t === 'table') h += `<div class="sub-h">표</div><p class="muted small">칸을 더블클릭해 고치고 Tab 으로 다음 칸으로 갑니다. 엑셀 · 한글 표를 복사해 Ctrl+V 하면 표로 들어옵니다.</p>${btns([['rowAdd', '+ 줄'], ['rowDel', '− 줄'], ['colAdd', '+ 칸'], ['colDel', '− 칸']])}${numIn('fs', '글자 크기', e.fs || 28)}${chk('head', '첫 줄을 머리글로 강조', e.head !== false)}${chk('stripe', '줄무늬', e.stripe)}${chk('plain', '바탕(카드) 없애기', e.plain)}`;
    if (one && t === 'chart') h += `<div class="sub-h">차트</div>${sel('kind', '종류', TS.CHARTS, e.kind || 'bar')}<label class="f"><span>자료 <small>한 줄에 "항목, 값" · 엑셀에서 복사해 붙여도 됩니다</small></span><textarea data-chart rows="6">${E((e.data || []).map(r => r.join(', ')).join('\n'))}</textarea></label><div class="grid2"><label class="f"><span>단위</span><input data-pt="unit" value="${E(e.unit || '')}" placeholder="대 · % · 명"></label>${numIn('fs', '글자 크기', e.fs || 24)}</div>${swatch('color', '색', e.color || 'accent')}${chk('values', '값 표시', e.values !== false)}${/pie|donut/.test(e.kind) ? chk('pct', '비율(%) 함께 표시', e.pct) : ''}`;
    h += `<div class="sub-h">자리 · 크기</div><div class="grid4">${numIn('x', '가로', e.x)}${numIn('y', '세로', e.y)}${numIn('w', '너비', e.w)}${numIn('h', '높이', e.h)}</div>${one && t !== 'line' ? numIn('rot', '회전(도)', e.rot || 0) : ''}
      <div class="sub-h">정렬 <small>${one ? '화면 기준' : '고른 것끼리'}</small></div>${btns([['al:l', '왼쪽'], ['al:c', '가운데'], ['al:r', '오른쪽'], ['al:t', '위'], ['al:m', '중간'], ['al:b', '아래']])}
      ${list.length > 2 ? btns([['di:h', '가로 등간격'], ['di:v', '세로 등간격']]) : ''}${list.length > 1 ? btns([['sm:w', '같은 너비'], ['sm:h', '같은 높이'], ['group', '묶기', 'Ctrl+G'], ['ungroup', '풀기', 'Ctrl+Shift+G']]) : (e.g ? btns([['ungroup', '묶음 풀기']]) : '')}
      <div class="sub-h">순서 · 잠금</div>${btns([['front', '맨 앞'], ['forward', '앞으로'], ['backward', '뒤로'], ['back', '맨 뒤']])}${btns([['lock', list.every(x => x.lock) ? '잠금 풀기' : '잠금'], ['hide', list.every(x => x.hide) ? '보이기' : '숨기기']])}`;
    return h;
  }
  function listPanel() {
    const a = TSEdit.els();
    return `<div class="sub-h" style="margin-top:0">이 장의 요소 <small>${a.length}개 · 위가 앞쪽</small></div>${a.length ? `<div class="olist">${[...a].reverse().map(e => `<div class="orow${e.hide ? ' off' : ''}" data-id="${e.id}"><button class="oname">${TYPE[e.type] || e.type} <small>${E(String(e.type === 'text' || e.type === 'shape' ? (new DOMParser().parseFromString(e.html || '', 'text/html').body.textContent || '') : e.name || e.kind || '').slice(0, 18))}</small></button><button class="tb" data-o="hide" title="숨기기/보이기">${e.hide ? '숨김' : '보임'}</button><button class="tb" data-o="lock" title="잠금/풀기">${e.lock ? '잠김' : '잠금'}</button></div>`).join('')}</div>` : '<p class="muted small">아직 없습니다. 미리보기 위의 도구로 글상자 · 그림 · 도형 · 선 · 아이콘 · 표 · 차트를 넣으세요.</p>'}
      <p class="muted small">요소를 클릭해 고르고 끌어서 옮깁니다. 여러 개는 Shift+클릭 또는 빈 곳에서 끌어 고릅니다. 단축키는 F1.</p>`;
  }
  const P = $('panel');
  P.addEventListener('mousedown', e => { if (e.target.closest('[data-fmt]')) e.preventDefault(); }); // 글 고치는 중에 누르면 고른 글자가 풀리지 않게
  P.addEventListener('input', e => {
    const t = e.target, s = S(); const lab = t.closest('.f') && t.closest('.f').querySelector('span small');
    if (t.dataset.k) { s[t.dataset.k] = t.value; changed(); }
    else if (t.dataset.f) { const i = +t.closest('.item').dataset.i; s.items[i][t.dataset.f] = t.value; changed(); }
    else if (t.dataset.img) { s.image = s.image || {}; s.image[t.dataset.img] = t.value; changed(); }
    else if (t.dataset.imgn) { s.image = s.image || {}; s.image[t.dataset.imgn] = t.dataset.imgn === 'zoom' ? t.value / 100 : +t.value; if (lab) lab.textContent = t.value + (t.dataset.imgn === 'zoom' ? '%' : ''); changed(); }
    else if (t.dataset.bg) { s.bg = s.bg || {}; s.bg[t.dataset.bg] = t.value; changed(); }
    else if (t.dataset.bgn) { s.bg = s.bg || {}; const k = t.dataset.bgn; s.bg[k] = k === 'dim' || k === 'zoom' ? t.value / 100 : +t.value; if (lab) lab.textContent = t.value + (k === 'px' || k === 'py' ? '' : '%'); changed(); }
    else if (t.dataset.p) { if (t.value === '' || isNaN(+t.value)) return; TSEdit.setProp({ [t.dataset.p]: +t.value }); }
    else if (t.dataset.pn) { const k = t.dataset.pn; TSEdit.setProp({ [k]: k === 'zoom' || k === 'op' ? t.value / 100 : +t.value }); if (lab) lab.textContent = t.value + (k === 'px' || k === 'py' ? '' : '%'); }
    else if (t.dataset.pt) TSEdit.setProp({ [t.dataset.pt]: t.value });
    else if (t.dataset.cc) { TSEdit.setProp({ [t.dataset.cc]: t.value }); }
    else if (t.dataset.chart != null) TSEdit.setProp({ data: t.value.split('\n').map(l => l.split(/\t|,(?=[^,]*$)/).map(x => x.trim())).filter(r => r[0] || r[1]).map(r => [r[0], +String(r[1] || 0).replace(/,/g, '') || 0]) });
  });
  P.addEventListener('change', e => {
    const t = e.target, s = S();
    if (t.id === 'fLayout') { s.layout = t.value; const L = TS.LAYOUTS[s.layout]; if (L.it && !(s.items || []).length) s.items = TS.blank(s.layout).items; if (s.layout !== 'free' && !s.title && L.f.includes('title')) s.title = '제목을 입력하세요'; if (L.max && (s.items || []).length > L.max) toast(`이 유형은 항목을 ${L.max}개까지만 보여 줍니다 (나머지는 그대로 보관)`); if (s.bg) { delete s.bg.tone; delete s.bg.dim; } changed(true); panel(); }
    else if (t.id === 'fBuild') { s.build = t.checked; changed(); }
    else if (t.id === 'bgOff') { s.bg = s.bg || {}; if (t.checked) s.bg.off = true; else delete s.bg.off; changed(); }
    else if (t.dataset.ps) { const k = t.dataset.ps; TSEdit.setProp({ [k]: k === 'weight' ? +t.value : t.value }); panel(); }
    else if (t.dataset.pb) { const k = t.dataset.pb; TSEdit.setProp({ [k]: ['head', 'values'].includes(k) ? t.checked : (t.checked ? true : undefined) }); panel(); }
    else if (t.dataset.cc) panel();
  });
  P.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return; const s = S(); const one = TSEdit.picked()[0];
    if (t.id === 'itemAdd') { const L = TS.LAYOUTS[s.layout]; const o = {}; L.it.forEach(k => o[k] = ''); o.t = '새 항목'; (s.items = s.items || []).push(o); changed(); panel(); }
    else if (t.dataset.act) { const i = +t.closest('.item').dataset.i; const a = s.items; if (t.dataset.act === 'del') a.splice(i, 1); else { const j = i + (t.dataset.act === 'up' ? -1 : 1); if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; } changed(); panel(); }
    else if (t.dataset.pick) pickImage(src => { const k = t.dataset.pick; s[k] = Object.assign({}, s[k], { src }); changed(); panel(); });
    else if (t.dataset.clear) { const k = t.dataset.clear; if (s[k]) delete s[k].src; changed(); panel(); }
    else if (t.dataset.cv != null) { TSEdit.setProp({ [t.closest('.sws').dataset.ck]: t.dataset.cv || undefined }); panel(); }
    else if (t.dataset.fmt) { const f = t.dataset.fmt; if (f === 'hilite') TSEdit.fmt('hiliteColor', pal().accent); else if (f === 'accent') TSEdit.fmt('foreColor', pal().accent); else TSEdit.fmt(f); }
    else if (t.dataset.o) { const x = TSEdit.byId(t.closest('.orow').dataset.id); if (!x) return; if (x[t.dataset.o]) delete x[t.dataset.o]; else x[t.dataset.o] = true; commit(true); panel(); }
    else if (t.classList.contains('oname')) { const x = TSEdit.byId(t.closest('.orow').dataset.id); if (x) { delete x.lock; delete x.hide; view(); TSEdit.select([x.id]); } }
    else if (t.dataset.op) {
      const op = t.dataset.op; const [a, b] = op.split(':');
      if (a === 'al') TSEdit.align(b); else if (a === 'di') TSEdit.distribute(b); else if (a === 'sm') TSEdit.same(b);
      else if (op === 'imgPick') return pickImage(src => { TSEdit.setProp({ src }); panel(); });
      else if (op === 'crop') TSEdit.crop(!TSEdit.cropping());
      else if (op === 'iconPick') return pickIcon(name => { TSEdit.setProp({ name }); panel(); });
      else if (/^(row|col)(Add|Del)$/.test(op) && one) { const r = one.rows; if (op === 'rowAdd') r.push(r[0].map(() => '')); if (op === 'rowDel' && r.length > 1) r.pop(); if (op === 'colAdd') r.forEach(x => x.push('')); if (op === 'colDel' && r[0].length > 1) r.forEach(x => x.pop()); commit(true); }
      else if (TSEdit.OPS[op]) TSEdit.OPS[op]();
      panel();
    }
  });
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.tab; TSEdit.select([]); panel(); });

  /* ---------- 화면 위 편집 연결 ---------- */
  function commit(render, soft) { mark(); if (!soft) snapshot(); if (render) view(); clearTimeout(railT); railT = setTimeout(() => railOne(cur), 200); if (!P.contains(document.activeElement)) panel(); }
  TSEdit.init($('view'), {
    slide: S, commit, render: view, onSelect: () => { markTools(); if (!P.contains(document.activeElement) || !TSEdit.picked().length) panel(); }, pickImage,
    focusField(path) { tab = 'content'; TSEdit.select([]); panel(); const m = path.match(/^items\.(\d+)\.(\w+)$/); const n = m ? P.querySelector(`.item[data-i="${m[1]}"] [data-f="${m[2]}"]`) : path === 'image' ? P.querySelector('[data-pick="image"]') : P.querySelector(`[data-k="${path}"]`); if (n) { n.focus(); n.scrollIntoView({ block: 'center' }); } },
  });
  function pickIcon(done) {
    const sh = modal(`<h3>아이콘</h3><div class="ico-grid">${Object.keys(TS_ICONS).map(k => `<button data-n="${E(k)}" title="${E(k)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${TS_ICONS[k]}</svg><span>${E(k)}</span></button>`).join('')}</div><div class="row end"><button class="btn ghost" id="mClose">닫기</button></div>`, 'wide');
    sh.querySelector('#mClose').onclick = closeModal; sh.querySelector('.ico-grid').onclick = e => { const b = e.target.closest('button'); if (b) { closeModal(); done(b.dataset.n); } };
  }
  function pickShape(done) {
    const c = { i: 0 };
    const sh = modal(`<h3>도형</h3><div class="ico-grid shp">${Object.entries(TS.SHAPES).map(([k, v]) => `<button data-n="${k}"><div class="ts-slide T-${deck.theme || 'midnight'}" style="position:relative;width:96px;height:64px;background:none;font-size:10px"><div class="ts-el ts-el-shape" style="left:8px;top:6px;width:80px;height:52px">${TS.elInner({ type: 'shape', shape: k, fill: 'accent', html: '' })}</div></div><span>${v}</span></button>`).join('')}</div><div class="row end"><button class="btn ghost" id="mClose">닫기</button></div>`, 'wide');
    sh.querySelector('#mClose').onclick = closeModal; sh.querySelector('.ico-grid').onclick = e => { const b = e.target.closest('button'); if (b) { closeModal(); done(b.dataset.n); } };
  }
  const markTools = () => { const t = TSEdit.tool(); document.querySelectorAll('#tools [data-tool]').forEach(b => b.classList.toggle('on', !!t && (b.dataset.tool === t.type + (t.more && t.more.arrow === 'end' ? ':arrow' : '')))); $('tGrid').classList.toggle('on', TSEdit.grid); $('tSnap').classList.toggle('on', TSEdit.snap); };
  $('tools').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const t = b.dataset.tool;
    if (t === 'text') TSEdit.setTool('text'); else if (t === 'line') TSEdit.setTool('line'); else if (t === 'line:arrow') TSEdit.setTool('line', { arrow: 'end' });
    else if (t === 'table') TSEdit.setTool('table'); else if (t === 'chart') TSEdit.setTool('chart');
    else if (t === 'shape') pickShape(shape => { TSEdit.setTool('shape', shape === 'card' ? { shape, fill: undefined, color: 'title' } : { shape }); markTools(); });
    else if (t === 'icon') pickIcon(name => { TSEdit.setTool('icon', { name }); markTools(); });
    else if (t === 'image') pickImage((src, size) => addImage(src, size));
    else if (b.id === 'tGrid') TSEdit.grid = !TSEdit.grid; else if (b.id === 'tSnap') TSEdit.snap = !TSEdit.snap;
    else if (b.id === 'tExplode') explode(); else if (b.id === 'tHelp') help();
    markTools();
  });
  function explode() {
    const s = S(); if (s.layout === 'free') { toast('이미 자유 배치 장입니다'); return; }
    const sh = modal(`<h3>이 장을 요소로 풀기</h3><p>지금 보이는 글 · 카드 · 그림 · 선을 하나하나 따로 움직일 수 있는 요소로 바꿉니다.</p><p class="muted">풀고 나면 오른쪽 [내용] 칸 대신 화면에서 직접 고칩니다. 클릭마다 하나씩 나오던 순서는 없어집니다(모션 순서는 2단계에서 요소별로 지정). [되돌리기] 로 되돌릴 수 있습니다.</p><div class="row end"><button class="btn ghost" id="mClose">취소</button><button class="btn pri" id="mOk">요소로 풀기</button></div>`);
    sh.querySelector('#mClose').onclick = closeModal;
    sh.querySelector('#mOk').onclick = () => { const out = TS.explode(deck, s, cur, deck.slides.length); const keep = { id: s.id, layout: 'free', bg: s.bg, notes: s.notes, time: s.time, source: s.source, els: [...out, ...(s.els || [])] }; Object.keys(keep).forEach(k => keep[k] === undefined && delete keep[k]); deck.slides[cur] = keep; closeModal(); changed(true); panel(); toast(`요소 ${out.length}개로 풀었습니다`); };
  }
  /* 붙여넣기: 그림 → 그림 요소, 엑셀·한글 표 → 표, 복사해 둔 요소·장 → 그대로, 글 → 글상자 */
  const typing = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '') || TSEdit.editing();
  addEventListener('paste', async e => {
    if (typing(e) || !$('modal').hidden) return; const cd = e.clipboardData; if (!cd) return;
    const f = [...cd.files].find(x => /^image\//.test(x.type));
    if (f) { e.preventDefault(); try { const r = await shrink(f); addImage(r.src, r); } catch (err) { toast('그림을 읽지 못했습니다', true); } return; }
    const html = cd.getData('text/html'), text = cd.getData('text/plain'); let rows = null;
    if (/<table/i.test(html)) { const d = new DOMParser().parseFromString(html, 'text/html'); const tb = d.querySelector('table'); if (tb) rows = [...tb.rows].map(r => [...r.cells].map(c => c.textContent.trim())); }
    else if (/\t/.test(text) && text.trim().includes('\n')) rows = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(l => l.split('\t'));
    e.preventDefault();
    if (rows && rows.length) { const n = Math.max(...rows.map(r => r.length)); rows = rows.map(r => Array.from({ length: n }, (_, i) => r[i] || '')); TSEdit.add([TS.newEl('table', 160, 300, Math.min(1600, 260 * n), 70 * rows.length + 10, { rows })]); return; }
    if (!text || text === 'taestep-clip') { if (TSEdit.OPS.paste()) return; let c = null; try { c = JSON.parse(localStorage.getItem('taestep:slide') || 'null'); } catch (err) { } if (c && c.slide) { const s = JSON.parse(JSON.stringify(c.slide)); s.id = TS.uid(); deck.slides.splice(cur + 1, 0, s); cur++; changed(true); panel(); toast('장을 붙여넣었습니다'); } return; }
    TSEdit.add([TS.newEl('text', 200, 300, 1200, 0, { html: E(text).replace(/\n/g, '<br>') })]);
  });
  $('view').addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  $('view').addEventListener('drop', async e => { const f = [...e.dataTransfer.files].find(x => /^image\//.test(x.type)); if (!f) return; e.preventDefault(); const r = $('view').getBoundingClientRect(); const k = $('view').clientWidth / 1920; try { const im = await shrink(f); addImage(im.src, im, { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }); } catch (err) { toast('그림을 읽지 못했습니다', true); } });

  /* ---------- 장 추가 · 복제 · 삭제 · 순서 ---------- */
  const addSlide = () => {
    const sh = modal(`<h3>장 추가</h3><p class="muted">유형을 고르면 지금 장 바로 뒤에 들어갑니다.</p><div class="lay-grid">${Object.entries(TS.LAYOUTS).map(([k, v]) => `<button class="lay-item" data-l="${k}"><div class="pic"></div><span>${v.name}</span></button>`).join('')}</div><div class="row end"><button class="btn ghost" id="mClose">닫기</button></div>`, 'wide');
    sh.querySelector('#mClose').onclick = closeModal;
    sh.querySelectorAll('.lay-item').forEach(b => { TS.thumb(deck, SAMPLE(b.dataset.l), 0, 1, b.querySelector('.pic')); b.onclick = () => { const s = TS.blank(b.dataset.l); deck.slides.splice(cur + 1, 0, s); cur++; closeModal(); TSEdit.select([]); changed(true); panel(); }; });
  };
  $('btAdd').onclick = addSlide;
  const SAMPLE = l => l === 'free' ? Object.assign(TS.blank(l), { els: [TS.newEl('text', 160, 200, 1300, 150, { html: '빈 장', fs: 120, color: 'title', weight: 600 }), TS.newEl('text', 160, 400, 1500, 80, { html: '글상자 · 그림 · 도형을 자유롭게', fs: 56, color: 'muted' })] }) : Object.assign(TS.blank(l), { kicker: 'KICKER', title: l === 'quote' ? '기억에 남길 한 문장' : (TS.LAYOUTS[l].name + ' *제목*'), subtitle: '부제 · 설명', k: '01', body: l === 'table' ? '구분 | 내용 | 비고\n가 | 내용 | -\n나 | 내용 | -' : '본문', items: (TS.blank(l).items || []).map((x, i) => Object.assign(x, { k: l === 'agenda' ? '10분' : 'A' + (i + 1), v: String((i + 1) * 12), u: '건', d: '설명' })) });
  const dupSlide = () => { const c = JSON.parse(JSON.stringify(S())); c.id = TS.uid(); deck.slides.splice(cur + 1, 0, c); cur++; changed(true); panel(); };
  const delSlide = () => { if (deck.slides.length < 2) { toast('마지막 한 장은 지울 수 없습니다'); return; } deck.slides.splice(cur, 1); cur = Math.min(cur, deck.slides.length - 1); TSEdit.select([]); changed(true); panel(); toast('지웠습니다 — [되돌리기] 로 되살릴 수 있습니다'); };
  $('btDup').onclick = dupSlide; $('btDel').onclick = delSlide;
  const move = d => { const j = cur + d; if (j < 0 || j >= deck.slides.length) return; const a = deck.slides;[a[cur], a[j]] = [a[j], a[cur]]; cur = j; changed(true); };
  $('btUp').onclick = () => move(-1); $('btDown').onclick = () => move(1);
  $('btMotion').onclick = () => {
    TSEdit.select([]); const host = $('view'); const el = view(); host.classList.add('ts-live'); void el.offsetWidth; el.classList.add('is-active');
    setTimeout(() => TS.countUp({ querySelectorAll: s => [...el.querySelectorAll(s)].filter(x => !x.closest('[data-step]')) }), 450);
    const st = [...el.querySelectorAll('[data-step]')]; st.forEach((x, i) => setTimeout(() => { x.classList.add('on'); TS.countUp(x); }, 1300 + i * 650));
    clearTimeout(host._mt); host._mt = setTimeout(() => { host.classList.remove('ts-live'); view(); }, 9000 + st.length * 650);
  };

  /* ---------- 도움말 (단축키) ---------- */
  function help() {
    const rows = [['저장 · PDF 인쇄 · 도움말', 'Ctrl+S · Ctrl+P · F1'], ['발표 (지금 장부터)', 'F5'], ['새 장 · 장 복제 · 장 지우기', 'Ctrl+M · Ctrl+Shift+D · Ctrl+Delete'], ['장 이동', 'PageUp · PageDown'], ['요소 고르기', '클릭 · Shift+클릭 · 빈 곳에서 끌기 · Tab · Ctrl+A · Esc 해제'], ['요소 옮기기', '끌기 · 화살표 10 · Ctrl+화살표 1 · Shift+화살표 50'], ['끌 때', 'Shift 한 방향 · Ctrl 복제 · Alt 자석 끄기'], ['크기 · 회전', '테두리 점(Shift 비율 유지) · 위쪽 둥근 점(Shift 15도씩)'], ['복제 · 지우기', 'Ctrl+D · Delete'], ['복사 · 잘라내기 · 붙여넣기', 'Ctrl+C · Ctrl+X · Ctrl+V (다른 교안 탭에도)'], ['서식 복사 · 붙여넣기', 'Ctrl+Shift+C · Ctrl+Shift+V'], ['앞으로 · 뒤로 / 맨 앞 · 맨 뒤', 'Ctrl+] · Ctrl+[ / Ctrl+Shift+] · Ctrl+Shift+['], ['묶기 · 풀기', 'Ctrl+G · Ctrl+Shift+G'], ['글 고치기 시작 · 끝', '더블클릭 · Enter · F2 / Esc'], ['글 서식', 'Ctrl+B · Ctrl+I · Ctrl+U'], ['표', '칸 더블클릭 · Tab 다음 칸 · 엑셀/한글 표 Ctrl+V'], ['그림', 'Ctrl+V · 화면에 끌어다 놓기 · 더블클릭 자르기(휠 확대)'], ['되돌리기 · 다시 실행', 'Ctrl+Z · Ctrl+Y']];
    const sh = modal(`<h3>단축키 (PowerPoint 와 같은 배치)</h3><table class="keys">${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table><div class="row end"><button class="btn pri" id="mClose">닫기</button></div>`, 'wide');
    sh.querySelector('#mClose').onclick = closeModal;
  }

  /* ---------- 교안 설정 · 내보내기 ---------- */
  const loadScript = src => new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  async function exportPptx() {
    toast('PPTX 를 만드는 중…');
    try { await loadScript('ts/vendor/pptxgen.bundle.js'); await loadScript('ts/pptx.js'); await TSPptx.save(deck, t => toast(t)); toast('PPTX 를 내려받았습니다'); }
    catch (e) { console.error(e); toast('PPTX 를 만들지 못했습니다: ' + (e.message || e), true); }
  }
  const printPdf = async () => { await TSStore.draftPut(deck); window.open(`play.html?deck=${encodeURIComponent(id)}&print=1`, '_blank'); };
  $('btMore').onclick = () => {
    const sh = modal(`<h3>교안 설정</h3>
      <div class="grid2"><label class="f"><span>테마</span><select id="sTheme">${Object.entries(TS.THEMES).map(([k, v]) => `<option value="${k}"${(deck.theme || 'midnight') === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="f"><span>장 넘김</span><select id="sTr">${[['fade', '부드럽게 겹치기'], ['slide', '옆에서 들어오기'], ['zoom', '다가오며 나타나기'], ['none', '효과 없음']].map(([k, v]) => `<option value="${k}"${(deck.transition || 'fade') === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="f"><span>강조색 <small>비우면 테마 색</small></span><input id="sAccent" value="${E(deck.accent || '')}" placeholder="#4DEBFF"></label>
      <label class="f"><span>기관 이름 (표지 왼쪽 위)</span><input id="sOrg" value="${E(deck.org || '')}"></label>
      <label class="f"><span>대상</span><input id="sAud" value="${E(deck.audience || '')}" placeholder="예: 현장지휘관(소방령)"></label>
      <label class="f"><span>강의 시간(분)</span><input id="sMin" type="number" min="0" value="${+deck.minutes || ''}"></label></div>
      <label class="f"><span>아래 줄 문구 <small>비우면 교안 제목</small></span><input id="sFoot" value="${E(deck.footer || '')}"></label>
      <div class="f"><span>기본 배경 <small>그림을 고르지 않은 장 전체에 어둡게 깔립니다</small></span><div class="pick"><div class="pick-pic" style="${deck.bg && deck.bg.src ? `background-image:url('${deck.bg.src.replace(/'/g, '%27')}')` : ''}"></div><div class="pick-btn"><button class="btn ghost" id="sBg">그림 고르기</button>${deck.bg && deck.bg.src ? '<button class="btn ghost" id="sBgX">없애기</button>' : ''}</div></div></div>
      <div class="sub-h">내보내기</div><div class="row"><button class="btn ghost" id="xPptx">PowerPoint(PPTX)</button><button class="btn ghost" id="xPdf">PDF 로 인쇄</button><button class="btn ghost" id="xJson">교안 파일</button><button class="btn ghost" id="xImp">파일에서 가져오기</button><input id="xFile" type="file" accept=".json,application/json" hidden></div>
      <div class="row end"><button class="btn pri" id="mOk">확인</button></div>`);
    const set = (k, v) => { if ((deck[k] || '') !== v) { if (v === '' || v === 0) delete deck[k]; else deck[k] = v; changed(true); } };
    sh.querySelector('#sTheme').onchange = e => { set('theme', e.target.value); panel(); }; sh.querySelector('#sTr').onchange = e => set('transition', e.target.value);
    sh.querySelector('#mOk').onclick = () => {
      const a = sh.querySelector('#sAccent').value.trim(); set('accent', /^#[0-9a-f]{3,8}$/i.test(a) ? a : '');
      set('org', sh.querySelector('#sOrg').value.trim()); set('audience', sh.querySelector('#sAud').value.trim()); set('minutes', +sh.querySelector('#sMin').value || 0); set('footer', sh.querySelector('#sFoot').value.trim()); closeModal(); panel();
    };
    sh.querySelector('#sBg').onclick = () => pickImage(src => { deck.bg = Object.assign({ motion: 'zoom-in', dim: .86 }, deck.bg, { src }); changed(true); panel(); toast('기본 배경을 바꿨습니다'); });
    const bx = sh.querySelector('#sBgX'); if (bx) bx.onclick = () => { delete deck.bg; closeModal(); changed(true); panel(); };
    sh.querySelector('#xPptx').onclick = () => { closeModal(); exportPptx(); };
    sh.querySelector('#xPdf').onclick = printPdf;
    sh.querySelector('#xJson').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(deck, null, 1)], { type: 'application/json' })); a.download = id + '.taestep.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); };
    sh.querySelector('#xImp').onclick = () => sh.querySelector('#xFile').click();
    sh.querySelector('#xFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const d = JSON.parse(await f.text()); if (!Array.isArray(d.slides)) throw 0; d.id = id; deck = d; cur = 0; $('deckTitle').value = deck.title || ''; closeModal(); changed(true); panel(); toast('가져왔습니다 — 이 교안의 내용이 바뀌었습니다 ([되돌리기] 가능)'); } catch (err) { toast('TAESTEP 교안 파일이 아닙니다', true); } };
  };

  /* ---------- 저장 · 발표 ---------- */
  function askToken(then) {
    const sh = modal(`<h3>GitHub 연결</h3><p class="muted">[저장] 은 교안을 GitHub 저장소에 올립니다. 이 기기에서 처음이면 토큰을 한 번 넣어 주세요. 토큰은 이 기기에만 보관됩니다.</p>
      <label class="f"><span>토큰</span><input id="tk" type="password" placeholder="github_pat_…" autocomplete="off"></label>
      <p class="muted small">만드는 곳: github.com/settings/personal-access-tokens/new → 저장소 <b>${E(TSStore.repo().repo)}</b> 선택 → Repository permissions 의 <b>Contents: Read and write</b></p>
      <div class="row end"><button class="btn ghost" id="mClose">취소</button><button class="btn pri" id="mOk">연결하고 저장</button></div>`);
    sh.querySelector('#mClose').onclick = closeModal;
    sh.querySelector('#mOk').onclick = () => { const v = sh.querySelector('#tk').value.trim(); if (!v) return; TSStore.setToken(v); closeModal(); then(); };
  }
  let saving = false;
  async function save() {
    if (saving) return; saving = true; $('btSave').disabled = true;
    try { await TSStore.save(deck, t => { $('state').textContent = t; }); dirty = false; state(); view(); panel(); toast('저장했습니다 — 다른 기기에는 1~2분 뒤(배포 후) 보입니다'); }
    catch (e) { state(); if (e.code === 'notoken' || e.status === 401) { if (e.status === 401) TSStore.setToken(''); askToken(save); } else toast(e.message || '저장하지 못했습니다', true); }
    saving = false; $('btSave').disabled = false;
  }
  $('btSave').onclick = save; $('btUndo').onclick = undo; $('btRedo').onclick = redo;
  const play = async () => { await TSStore.draftPut(deck); location.href = `play.html?deck=${encodeURIComponent(id)}&from=studio#${cur + 1}`; };
  $('btPlay').onclick = play;
  $('deckTitle').value = deck.title || ''; $('deckTitle').oninput = e => { deck.title = e.target.value; document.title = deck.title + ' — TAESTEP 편집'; changed(); };
  addEventListener('keydown', e => {
    const c = e.ctrlKey || e.metaKey, k = e.key.toLowerCase(), ty = typing(e);
    if (!$('modal').hidden) { if (e.key === 'Escape') closeModal(); return; }
    if (c && k === 's') { e.preventDefault(); return save(); }
    if (c && k === 'p') { e.preventDefault(); return printPdf(); }
    if (e.key === 'F5') { e.preventDefault(); return play(); }
    if (e.key === 'F1') { e.preventDefault(); return help(); }
    if (ty) return;
    if (c && k === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
    if (c && k === 'y') { e.preventDefault(); return redo(); }
    if (c && k === 'm') { e.preventDefault(); return addSlide(); }
    if (c && e.shiftKey && k === 'd') { e.preventDefault(); return dupSlide(); }
    if (c && e.key === 'Delete') { e.preventDefault(); return delSlide(); }
    if (c && k === 'v') return; // 붙여넣기는 paste 에서
    if (TSEdit.key(e)) { e.preventDefault(); return; }
    if (c && k === 'c') { try { localStorage.setItem('taestep:slide', JSON.stringify({ slide: S() })); localStorage.removeItem('taestep:clip'); navigator.clipboard.writeText('taestep-clip'); } catch (err) { } toast('이 장을 복사했습니다 — Ctrl+V 로 붙여넣기 (다른 교안에도)'); return; }
    if (e.key === 'PageDown') { e.preventDefault(); select(cur + 1); } else if (e.key === 'PageUp') { e.preventDefault(); select(cur - 1); }
  });
  addEventListener('beforeunload', () => { if (dirty) TSStore.draftPut(deck); });
  document.title = (deck.title || '') + ' — TAESTEP 편집';
  const d0 = await TSStore.draftGet(id); dirty = !!d0 && !(await TSStore.repoDeck(id).then(r => r && (r.modified || '') >= (d0.modified || '')));
  state(); rail(); view(); panel(); markTools();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { rail(); view(); });
})();
