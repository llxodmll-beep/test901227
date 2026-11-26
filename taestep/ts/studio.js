/* TAESTEP 편집 화면 — 왼쪽 장 목록 · 가운데 미리보기(직접 편집) · 오른쪽 입력 칸
   장 유형을 고르고 칸만 채워도 되고, 화면 위에 글상자 · 그림 · 도형 · 표 · 차트를 얹어 직접 고쳐도 된다.
   고친 내용은 이 기기에 바로 보관되고, [저장] 을 누르면 GitHub 저장소에 올라간다. */
'use strict';
(async () => {
  const $ = id => document.getElementById(id);
  const E = TS.E;
  const q = new URLSearchParams(location.search); const id = q.get('deck') || '';
  /* ---------- 알림 · 창 ---------- */
  let toastT = 0;
  const toast = (t, bad, ms) => { const o = $('toast'); o.textContent = t; o.className = 'toast' + (bad ? ' bad' : ''); o.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { o.hidden = true; }, ms || 3600); };
  let sticky = false; // 꼭 골라야 하는 창은 바깥을 눌러도 · Esc 로도 닫히지 않음
  const modal = (html, cls, keep) => { const m = $('modal'); sticky = !!keep; m.innerHTML = `<div class="sheet ${cls || ''}">${html}</div>`; m.hidden = false; m.onclick = e => { if (e.target === m && !sticky) closeModal(); }; return m.firstChild; };
  const closeModal = () => { sticky = false; $('modal').hidden = true; $('modal').innerHTML = ''; };
  const whenFull = iso => { const d = new Date(iso); return !iso || isNaN(d) ? '알 수 없음' : d.toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
  const whenShort = iso => { const d = new Date(iso); if (!iso || isNaN(d)) return ''; return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }); };

  /* ---------- 열기: 저장 안 한 작업본이 남아 있으면 어느 쪽으로 열지 묻는다 (고르지 않은 쪽은 보관함에 30일) ---------- */
  const opened = id ? await TSStore.open(id) : { repo: null, draft: null };
  if (!opened.repo && !opened.draft) { document.body.innerHTML = '<div class="empty-page"><h1>교안을 찾지 못했습니다</h1><p><a href="./">목록으로 돌아가기</a></p></div>'; return; }
  const chooseCopy = (repo, draft) => new Promise(done => {
    const newer = (draft.modified || '') > (repo.modified || ''); const n = TSStore.diff(repo, draft); const foreign = draft._base !== undefined && (draft._base || '') !== (repo.modified || '');
    const card = (k, name, sub, lab, t, cnt, btn, rec) => `<div class="cp-card${rec ? ' rec' : ''}"><div class="cp-name">${name}${rec ? '<span>더 최근</span>' : ''}</div><div class="cp-sub">${sub}</div><div class="cp-row"><span>${lab}</span><b>${whenFull(t)}</b></div><div class="cp-row"><span>장 수</span><b>${cnt}장</b></div><div class="cp-pic" data-pic="${k}"></div><button class="btn ${rec ? 'pri' : 'ghost'} wide" data-pick="${k}">${btn}</button></div>`;
    const sh = modal(`<h3>저장하지 않은 작업본이 이 기기에 남아 있습니다</h3><p>지난번에 이 교안을 고친 뒤 저장하지 않고 나갔습니다. 어느 쪽으로 열지 골라 주세요. <b>어느 쪽을 골라도 다른 쪽은 지워지지 않습니다.</b></p>
      <div class="cp-cards">${card('draft', '저장하지 않은 작업본', '이 기기에만 있습니다', '마지막으로 고친 때', draft.modified, (draft.slides || []).length, '이 작업본 이어서 하기', newer)}${card('repo', '저장된 교안', 'GitHub 저장소', '저장한 때', repo.modified, (repo.slides || []).length, '저장된 교안으로 열기', !newer)}</div>
      <p class="muted">두 교안은 <b>${n}장</b>이 다릅니다.${foreign ? ' <b class="warn-t">이 작업본을 만든 뒤에 저장된 교안이 다른 곳에서 바뀌었습니다 — 작업본을 이어서 하고 저장하면 그쪽 내용을 덮어쓸지 다시 묻습니다.</b>' : ''}</p>
      <p class="muted small">고르지 않은 작업본은 [내보내기] → [저장 이력 · 보관된 작업본] 에 30일 동안 남습니다.</p>`, 'wide', true);
    [['draft', draft], ['repo', repo]].forEach(([k, d]) => { const h = sh.querySelector(`[data-pic="${k}"]`); const diffAt = (d.slides || []).findIndex((x, i) => JSON.stringify(x) !== JSON.stringify(((k === 'draft' ? repo : draft).slides || [])[i])); const i = Math.max(0, diffAt); if (d.slides && d.slides[i]) TS.thumb(d, d.slides[i], i, d.slides.length, h); });
    sh.onclick = e => { const b = e.target.closest('[data-pick]'); if (b) { closeModal(); done(b.dataset.pick); } };
  });
  let deck, startDirty = false, openNote = '';
  { const { repo, draft } = opened;
    if (!draft) deck = repo;
    else if (!repo) { deck = draft; startDirty = !draft._synced; }
    else if (draft._synced) deck = draft; // 저장했고 배포를 기다리는 사본
    else if ((await chooseCopy(repo, draft)) === 'draft') { deck = draft; startDirty = true; if (deck._base === undefined) deck._base = (draft.modified || '') > (repo.modified || '') ? (repo.modified || '') : ''; openNote = '저장하지 않은 작업본을 불러왔습니다 — 확인한 뒤 [저장] 을 눌러 주세요'; }
    else { await TSStore.keepPut(draft, '다시 열 때 저장된 교안을 고름'); await TSStore.draftDel(id); deck = repo; openNote = '저장된 교안으로 열었습니다 · 작업본은 [내보내기] → [저장 이력 · 보관된 작업본] 에 30일 남습니다'; }
  }
  let base = deck._base !== undefined ? deck._base : (opened.repo ? (deck === opened.repo ? opened.repo.modified || '' : deck.modified || '') : ''); // 내가 불러온(마지막으로 저장한) 저장본의 저장 시각
  if (deck._synced) base = deck.modified || base;
  const neverSaved = () => !base;
  deck.id = id; deck.slides = Array.isArray(deck.slides) && deck.slides.length ? deck.slides : [TS.blank('cover')];
  deck.slides.forEach(s => { if (!s.id) s.id = TS.uid(); });
  let cur = Math.min(deck.slides.length - 1, Math.max(0, (parseInt(location.hash.slice(1), 10) || 1) - 1));
  let tab = 'content', dirty = false, rev = 0, saving = null, leaving = false, quotaWarned = false, offlinePending = false, autoT = 0;
  const snapOf = () => JSON.stringify(Object.assign({}, deck, { modified: '' })); // 되돌리기 기록은 내용만 본다 (고친 시각만 다른 것은 같은 것)
  let hist = [snapOf()], hi = 0, histT = 0, draftT = 0, viewT = 0, railT = 0;
  const S = () => deck.slides[cur];
  const autoOn = () => { try { return localStorage.getItem('taestep:autosave') === '1'; } catch (e) { return false; } };

  /* ---------- 바뀜 처리 · 되돌리기 ---------- */
  function state() {
    const el = $('state'); const c = TSStore.repo();
    el.textContent = saving ? '저장 중…' : dirty ? (neverSaved() ? '저장 안 됨 · 이 기기에만 있음' : '저장 안 됨') : base ? '저장됨 · ' + whenShort(base) : '저장됨';
    el.title = dirty ? `저장하지 않은 변경이 있습니다 — [저장] 또는 Ctrl+S\n고친 내용은 이 기기에 작업본으로 보관 중입니다.${base ? `\n마지막 저장: ${whenFull(base)}` : ''}` : `마지막 저장: ${whenFull(base)}\n저장 위치: GitHub 저장소 ${c.owner}/${c.repo} (taestep/decks)`;
    el.className = 'state' + (saving ? ' busy' : dirty ? ' warn' : ''); $('btSave').classList.toggle('need', dirty && !saving);
    document.title = (dirty ? '● ' : '') + (deck.title || '') + ' — TAESTEP 편집';
  }
  /* 작업본을 이 기기에 남김. 공간이 모자라면 한 번 알림 */
  const putDraft = () => TSStore.draftPut(deck).then(ok => { if (!ok && !quotaWarned) { quotaWarned = true; toast('이 기기의 보관 공간이 부족해 작업본을 남기지 못했습니다 — 창을 닫기 전에 꼭 [저장] 하거나 [내보내기] → [교안 파일] 로 내려받아 주세요', true, 10000); } return ok; });
  function mark() {
    dirty = true; rev++; delete deck._synced; deck._base = base; deck.modified = new Date().toISOString(); state();
    clearTimeout(draftT); draftT = setTimeout(putDraft, 500);
    clearTimeout(histT); histT = setTimeout(snapshot, 450);
    clearTimeout(autoT); if (autoOn()) autoT = setTimeout(() => { if (dirty && !saving && TSStore.repo().token && navigator.onLine !== false && !TSEdit.editing() && $('modal').hidden) save({ quiet: true }); }, 30000);
  }
  function snapshot() { clearTimeout(histT); const j = snapOf(); if (j === hist[hi]) return; hist = hist.slice(0, hi + 1); hist.push(j); if (hist.length > 80) hist.shift(); hi = hist.length - 1; }
  function changed(structure) { mark(); if (structure) { rail(); view(); } else { clearTimeout(viewT); viewT = setTimeout(() => { view(); railOne(cur); }, 120); } }
  function restore(n) { hi = n; deck = JSON.parse(hist[hi]); deck.id = id; delete deck._synced; deck._base = base; deck.modified = new Date().toISOString(); cur = Math.min(cur, deck.slides.length - 1); dirty = true; rev++; state(); putDraft(); $('deckTitle').value = deck.title || ''; TSEdit.select([]); rail(); view(); panel(); }
  function undo() { snapshot(); if (hi < 1) { toast('되돌릴 내용이 없습니다'); return; } restore(hi - 1); }
  function redo() { if (hi >= hist.length - 1) { toast('다시 실행할 내용이 없습니다'); return; } restore(hi + 1); }

  /* ---------- 그리기 ---------- */
  function view() { if (typeof pv !== 'undefined' && pv) stopPreview(true); if (typeof trPv !== 'undefined' && trPv) stopTr(); const el = TS.thumb(deck, S(), cur, deck.slides.length, $('view'), { edit: true }); TSEdit.refresh(); return el; }
  let issues = [], folded = new Set(); // 디자인 점검 결과 · 접어 둔 구역(이 화면에서만)
  const railItem = i => $('rail').querySelector(`.rail-item[data-i="${i}"]`);
  function railOne(i) { const host = railItem(i); if (!host) return; const s = deck.slides[i]; TS.thumb(deck, s, i, deck.slides.length, host.querySelector('.pic')); host.querySelector('.lay').textContent = (TS.LAYOUTS[s.layout] || {}).name || ''; host.classList.toggle('hid', !!s.hidden);
    const n = issues.filter(x => x.id === s.id).length; host.querySelector('.flags').innerHTML = (s.hidden ? '<b class="f-h">숨김</b>' : '') + (s.memo ? '<b class="f-m" title="메모 있음">메모</b>' : '') + (n ? `<b class="f-w" title="디자인 점검에서 찾은 것">점검 ${n}</b>` : ''); }
  function rail() {
    const r = $('rail'); r.innerHTML = ''; let sec = null;
    deck.slides.forEach((s, i) => {
      if (s.section) { sec = s.id; const h = document.createElement('button'); h.className = 'rail-sec' + (folded.has(sec) ? ' folded' : ''); const cnt = (() => { let n = 1; for (let k = i + 1; k < deck.slides.length && !deck.slides[k].section; k++) n++; return n; })(); h.innerHTML = `<span>${folded.has(sec) ? '▸' : '▾'} ${E(s.section)}</span><small>${cnt}장</small>`; h.title = '눌러서 접기 · 펴기'; const key = sec; h.onclick = () => { if (folded.has(key)) folded.delete(key); else folded.add(key); rail(); }; r.appendChild(h); }
      const d = document.createElement('div'); d.className = 'rail-item' + (i === cur ? ' cur' : ''); d.draggable = true; d.dataset.i = i; if (sec && folded.has(sec) && i !== cur) d.hidden = true;
      d.innerHTML = `<span class="no">${i + 1}</span><div class="pic"></div><span class="flags"></span><span class="lay"></span>`;
      d.onclick = () => select(i);
      d.ondragstart = e => { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; };
      d.ondragover = e => { e.preventDefault(); d.classList.add('over'); }; d.ondragleave = () => d.classList.remove('over');
      d.ondrop = e => { e.preventDefault(); d.classList.remove('over'); const from = +e.dataTransfer.getData('text/plain'); if (isNaN(from) || from === i) return; const [m] = deck.slides.splice(from, 1); deck.slides.splice(i, 0, m); cur = i; changed(true); panel(); };
      r.appendChild(d); if (!d.hidden) railOne(i);
    });
    const c = r.querySelector('.cur'); if (c) c.scrollIntoView({ block: 'nearest' }); markBar();
  }
  const markBar = () => { const s = S(); $('btHide').textContent = s.hidden ? '숨김 풀기' : '숨기기'; $('btHide').classList.toggle('on', !!s.hidden); $('btSec').classList.toggle('on', !!s.section); };
  function select(i) { cur = Math.max(0, Math.min(deck.slides.length - 1, i)); TSEdit.select([]); const it = railItem(cur); if (it && it.hidden) { rail(); } else { $('rail').querySelectorAll('.rail-item').forEach(d => d.classList.toggle('cur', +d.dataset.i === cur)); if (it) it.scrollIntoView({ block: 'nearest' }); } markBar(); view(); panel(); try { history.replaceState(null, '', '#' + (cur + 1)); } catch (e) { } }

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
    const picked = TSEdit.picked(); const show = tab === 'motion' ? 'motion' : picked.length ? 'el' : tab;
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === show));
    const p = $('panel'); const s = S(); const L = TS.LAYOUTS[s.layout] || TS.LAYOUTS.bullets;
    if (show === 'el') { p.innerHTML = picked.length ? elPanel(picked) : listPanel(); return; }
    if (show === 'motion') { p.innerHTML = motionPanel(picked); return; }
    if (show === 'content') {
      let h = `<label class="f"><span>장 유형</span><select id="fLayout">${Object.entries(TS.LAYOUTS).map(([k, v]) => `<option value="${k}"${k === s.layout ? ' selected' : ''}>${v.name}</option>`).join('')}</select></label>`;
      if (s.layout !== 'free') h += '<button id="fSwap" class="btn ghost wide" style="margin:-4px 0 14px">같은 내용, 다른 유형으로 보기</button>';
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
          if (k === 'title') h += range('data-ksz="titleScale"', '제목 글자 크기', Math.round((+s.titleScale > .3 && +s.titleScale < 1 ? +s.titleScale : 1) * 100), 50, 100, 5, '%');
        }
      });
      p.innerHTML = h;
    } else if (show === 'bg') {
      const b = s.bg || {};
      p.innerHTML = `<div class="f"><span>전면 배경</span><div class="pick big"><div class="pick-pic" style="${b.src ? `background-image:url('${b.src.replace(/'/g, '%27')}')` : ''}">${b.src ? '' : '<i>배경 그림 없음<br>(빛 · 격자 배경으로 나옵니다)</i>'}</div></div><div class="pick-btn"><button class="btn ghost" data-pick="bg">그림 고르기</button>${b.src ? '<button class="btn ghost" data-clear="bg">없애기</button>' : ''}</div></div>
        ${b.src ? '<div class="sub-h">배경 자르기 (보여 줄 곳)</div>' + cropUi('data-bgn', b) : ''}
        <label class="f"><span>배경 움직임</span><select data-bg="motion">${Object.entries(TS.MOTIONS).map(([k, v]) => `<option value="${k}"${(b.motion || 'zoom-in') === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        ${b.src && (b.motion || 'zoom-in') !== 'none' ? `<div class="grid2">${range('data-bgn="speed"', '움직임 속도', Math.round((+b.speed || 1) * 100), 25, 300, 5, '%')}${range('data-bgn="amt"', '움직임 크기', Math.round((+b.amt || 1) * 100), 20, 250, 5, '%')}</div>` : ''}
        <label class="f"><span>글자가 읽히게 덮는 방식</span><select data-bg="tone">${Object.entries(TS.TONES).map(([k, v]) => `<option value="${k}"${(b.tone || L.tone) === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        ${range('data-bgn="dim"', '덮는 세기', Math.round((b.dim == null ? L.dim : b.dim) * 100), 0, 95, 1, '%')}
        ${!b.src && deck.bg && deck.bg.src ? `<label class="chk"><input type="checkbox" id="bgOff"${b.off ? ' checked' : ''}> 이 장에는 교안 기본 배경도 깔지 않음</label>` : ''}
        <p class="muted small">그림을 고르지 않은 장에는 [교안 설정] 의 기본 배경이 어둡게 깔립니다.</p>`;
    } else {
      p.innerHTML = `<label class="f"><span>이 장의 시간</span><input data-k="time" value="${E(s.time || '')}" placeholder="예: 3분"></label>
        <label class="f grow"><span>발표 노트</span><textarea data-k="notes" rows="12" placeholder="말할 내용 · 출처 · 클릭 순서를 적어 둡니다. 발표자 화면(P)에 보입니다.">${E(s.notes || '')}</textarea></label>
        <label class="f"><span>장 메모 <small>나만 보는 메모 · 발표 화면과 유인물에는 나오지 않습니다</small></span><textarea data-k="memo" rows="4" placeholder="고칠 것 · 확인할 것 · 출처를 찾아야 하는 것">${E(s.memo || '')}</textarea></label>`;
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
      h += `<div class="sub-h">글</div>${one ? '<button class="btn ghost wide" data-op="editText" style="margin-bottom:8px">글 고치기 (더블클릭 · 두 번 톡)</button>' : ''}<div class="bar fmt"><button class="tb" data-fmt="bold" title="굵게 (Ctrl+B)"><b>가</b></button><button class="tb" data-fmt="italic" title="기울임 (Ctrl+I)"><i>가</i></button><button class="tb" data-fmt="underline" title="밑줄 (Ctrl+U)"><u>가</u></button><button class="tb" data-fmt="hilite" title="형광펜">형광</button><button class="tb" data-fmt="accent" title="강조색으로">강조</button><button class="tb" data-fmt="insertUnorderedList" title="글머리">•</button><button class="tb" data-fmt="insertOrderedList" title="번호">1.</button><button class="tb" data-fmt="removeFormat" title="서식 지우기">지움</button></div>
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
  /* ---------- 모션: 등장 순서(타임라인) · 효과 · 장 넘김 ---------- */
  const layoutSteps = () => { const el = $('view').querySelector(':scope > .ts-slide'); return el ? Math.max(0, ...[...el.querySelectorAll('[data-step]:not(.ts-el)')].map(x => +x.dataset.step)) : 0; };
  const maxStep = () => Math.max(layoutSteps(), 0, ...TSEdit.els().flatMap(e => [+e.step || 0, +e.emphAt || 0, +e.exit || 0]));
  /* 빈 클릭 번호를 없애고(1, 2, 4 → 1, 2, 3), 등장보다 앞선 강조 · 사라짐은 지운다 */
  function normSteps() {
    const a = TSEdit.els(); const used = new Set(); for (let i = 1; i <= layoutSteps(); i++) used.add(i);
    a.forEach(e => ['step', 'emphAt', 'exit'].forEach(k => { if (+e[k] > 0) used.add(Math.round(+e[k])); }));
    const map = {}; [...used].sort((x, y) => x - y).forEach((v, i) => { map[v] = i + 1; });
    a.forEach(e => { ['step', 'emphAt', 'exit'].forEach(k => { if (+e[k] > 0) e[k] = map[Math.round(+e[k])]; else delete e[k]; }); if (e.exit && e.exit <= (e.step || 0)) delete e.exit; if (e.emphAt && e.emphAt <= (e.step || 0)) delete e.emphAt; });
  }
  const elName = e => `${TYPE[e.type] || e.type}${e.type === 'text' || e.type === 'shape' ? ' · ' + E(String(new DOMParser().parseFromString(e.html || '', 'text/html').body.textContent || '').slice(0, 14)) : e.name ? ' · ' + E(e.name) : ''}`;
  function motionPanel(picked) {
    const s = S(); const a = TSEdit.els(); const n = layoutSteps(); const max = maxStep(); const one = picked[0];
    const row = (e, kind) => `<div class="tl-r k-${kind}${picked.includes(e) ? ' cur' : ''}" draggable="true" data-id="${e.id}" data-kind="${kind}"><b>${kind === 'in' ? '등장' : kind === 'em' ? '강조' : '사라짐'}</b><span>${elName(e)}</span><small>${kind === 'in' ? TS.ANIMS[TS.ANIMS[e.anim] ? e.anim : 'rise'] : kind === 'em' ? TS.EMPHS[e.emph] : TS.EXITS[TS.EXITS[e.exitAnim] ? e.exitAnim : 'fade']}</small></div>`;
    let h = `<label class="f"><span>이 장으로 넘어올 때 (장 넘김)</span><select id="mTr"><option value="">교안 기본값 — ${TS.TRANSITIONS[TS.trOf(deck, {})]}</option>${Object.entries(TS.TRANSITIONS).map(([k, v]) => `<option value="${k}"${s.tr === k ? ' selected' : ''}>${v}</option>`).join('')}</select><small>모핑: 장을 복제(Ctrl+Shift+D)한 뒤 요소를 옮기거나 크기를 바꾸면, 넘어올 때 같은 요소가 부드럽게 이동합니다. 발표(▶)에서 확인하세요.</small></label>
      <div class="bar"><button class="tb" data-mp="play">▶ 처음부터 재생</button><button class="tb" data-mp="step">한 단계 ▶</button><button class="tb" data-mp="stop">■ 멈춤</button><button class="tb" data-mp="tr" title="앞 장에서 이 장으로 넘어오는 모습을 그 자리에서 봅니다">장 넘김 보기</button></div>
      <div class="sub-h">등장 순서 <small>줄을 끌어 다른 클릭으로 옮깁니다 · 같은 클릭 안의 것은 함께 나옵니다</small></div><div id="tl" class="tl">`;
    for (let st = 0; st <= max; st++) {
      h += `<div class="tl-g" data-st="${st}"><div class="tl-h">${st ? '클릭 ' + st : '장이 열릴 때'}</div>${st && st <= n ? `<div class="tl-r fixed"><b>등장</b><span>장 유형의 항목 ${st}</span><small>내용 칸의 항목</small></div>` : ''}`
        + a.filter(e => (+e.step || 0) === st).map(e => row(e, 'in')).join('') + a.filter(e => +e.emphAt === st && TS.EMPHS[e.emph]).map(e => row(e, 'em')).join('') + a.filter(e => +e.exit === st).map(e => row(e, 'out')).join('')
        + (st === 0 && !a.some(e => !(+e.step)) ? '<div class="tl-e">제목 등 장 유형의 글은 장이 열릴 때 차례로 나옵니다</div>' : '') + '</div>';
    }
    h += `<div class="tl-g new" data-st="${max + 1}"><div class="tl-h">+ 새 클릭 — 여기로 끌어다 놓기</div></div></div>`;
    if (!a.length) h += '<p class="muted small">글상자 · 그림 · 도형 같은 요소를 넣으면 여기에 줄이 생깁니다. 장 유형의 항목은 [내용] 탭의 "클릭할 때마다 하나씩 등장"으로 켜고 끕니다.</p>';
    if (one) {
      const st = +one.step || 0; const opts = (from, first) => `<option value="">${first}</option>` + Array.from({ length: Math.max(0, max + 1 - from + 1) }, (_, i) => from + i).map(v => `<option value="${v}">클릭 ${v}${v === max + 1 ? ' (새로)' : ''}</option>`).join('');
      const pick = (html, v) => html.replace(`value="${v}"`, `value="${v}" selected`);
      h += `<div class="sub-h">고른 요소의 모션 <small>${picked.length > 1 ? picked.length + '개에 함께 적용' : elName(one)}</small></div>
        <div class="grid2"><label class="f"><span>등장 시점</span><select data-ps="step">${pick(`<option value="0">장이 열릴 때</option>` + Array.from({ length: max + 1 }, (_, i) => `<option value="${i + 1}">클릭 ${i + 1}${i === max ? ' (새로)' : ''}</option>`).join(''), st)}</select></label>
        <label class="f"><span>등장 효과</span><select data-ps="anim">${Object.entries(TS.ANIMS).map(([k, v]) => `<option value="${k}"${(TS.ANIMS[one.anim] ? one.anim : 'rise') === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="f"><span>속도 (초)</span><input type="number" data-p="dur" min="0.1" max="6" step="0.1" value="${+one.dur > 0 ? +one.dur : .8}"></label><label class="f"><span>지연 (초)</span><input type="number" data-p="delay" min="0" max="10" step="0.1" value="${+one.delay || 0}"></label>
        <label class="f"><span>강조</span><select data-ps="emph"><option value="">없음</option>${Object.entries(TS.EMPHS).map(([k, v]) => `<option value="${k}"${one.emph === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="f"><span>강조 시점</span><select data-ps="emphAt"${one.emph ? '' : ' disabled'}>${pick(opts(st + 1, '등장 직후'), +one.emphAt || '')}</select></label>
        <label class="f"><span>사라지기</span><select data-ps="exit">${pick(opts(st + 1, '사라지지 않음'), +one.exit || '')}</select></label>
        <label class="f"><span>사라지는 효과</span><select data-ps="exitAnim"${one.exit ? '' : ' disabled'}>${Object.entries(TS.EXITS).map(([k, v]) => `<option value="${k}"${(TS.EXITS[one.exitAnim] ? one.exitAnim : 'fade') === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label></div>`;
    } else if (a.length) h += '<p class="muted small">줄이나 화면의 요소를 누르면 효과 · 속도 · 지연 · 강조 · 사라지기를 정할 수 있습니다.</p>';
    return h;
  }
  /* 그 자리에서 미리 재생 */
  let pv = null;
  function stopPreview(quiet) { if (!pv) return; clearTimeout(pv.t); pv = null; $('view').classList.remove('ts-live'); if (!quiet) view(); }
  function startPreview(auto) {
    if (!pv) { const host = $('view'); const el = view(); el.dataset.tr = 'none'; host.classList.add('ts-live'); const c = TS.live(el); c.reset(false); void el.offsetWidth; el.classList.add('is-active'); pv = { el, c, t: 0 };
      setTimeout(() => pv && TS.countUp({ querySelectorAll: q2 => [...el.querySelectorAll(q2)].filter(x => !x.closest('[data-step]')) }), 450); if (!auto) return; }
    else if (!auto) { clearTimeout(pv.t); if (!pv.c.next()) stopPreview(); return; }
    const tick = () => { if (!pv) return; if (pv.c.next()) pv.t = setTimeout(tick, 1400); else pv.t = setTimeout(() => stopPreview(), 3000); };
    clearTimeout(pv.t); pv.t = setTimeout(tick, 1700);
  }
  /* 장 넘김을 그 자리에서: 미리보기 위에 작은 무대를 얹어 앞 장 → 지금 장을 실제 발표와 같은 방식으로 넘긴다 */
  let trPv = null;
  function stopTr() { if (!trPv) return; clearTimeout(trPv.t); trPv.st.remove(); trPv = null; }
  function previewTr() {
    if (cur < 1) { toast('첫 장은 앞 장이 없어 넘김 효과가 없습니다'); return; } stopPreview(true); stopTr(); TSEdit.select([]);
    const host = $('view'); const N = deck.slides.length; const st = document.createElement('div'); st.className = 'ts-stage ts-live tr-stage'; st.style.cssText = `position:absolute;left:0;top:0;transform:scale(${host.clientWidth / 1920});transform-origin:0 0;z-index:6`;
    const a = TS.slideEl(deck, deck.slides[cur - 1], cur - 1, N), b2 = TS.slideEl(deck, S(), cur, N); st.append(a, b2); host.appendChild(st); TS.fit(a); TS.fit(b2);
    a.dataset.tr = 'none'; TS.live(a).reset(true); a.classList.add('is-active'); const tr = TS.trOf(deck, S());
    trPv = { st, t: setTimeout(() => { a.classList.remove('is-active'); a.dataset.leave = tr; a.classList.add('is-leaving'); b2.dataset.tr = tr; TS.live(b2).reset(false); const mo = tr === 'morph' ? TS.morph(a, b2) : null; b2.classList.toggle('morphing', !!mo); void b2.offsetWidth; b2.classList.add('is-active'); if (mo) mo.run(); trPv.t = setTimeout(stopTr, 2800); }, 900) };
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
    if (t.dataset.ksz) { const v = t.value / 100; if (v >= 1) delete s[t.dataset.ksz]; else s[t.dataset.ksz] = v; if (lab) lab.textContent = t.value + '%'; changed(); }
    else if (t.dataset.k) { s[t.dataset.k] = t.value; changed(); }
    else if (t.dataset.f) { const i = +t.closest('.item').dataset.i; s.items[i][t.dataset.f] = t.value; changed(); }
    else if (t.dataset.img) { s.image = s.image || {}; s.image[t.dataset.img] = t.value; changed(); }
    else if (t.dataset.imgn) { s.image = s.image || {}; s.image[t.dataset.imgn] = t.dataset.imgn === 'zoom' ? t.value / 100 : +t.value; if (lab) lab.textContent = t.value + (t.dataset.imgn === 'zoom' ? '%' : ''); changed(); }
    else if (t.dataset.bg) { s.bg = s.bg || {}; s.bg[t.dataset.bg] = t.value; changed(); if (t.dataset.bg === 'motion') setTimeout(panel, 0); }
    else if (t.dataset.bgn) { s.bg = s.bg || {}; const k = t.dataset.bgn; s.bg[k] = /^(dim|zoom|speed|amt)$/.test(k) ? t.value / 100 : +t.value; if (lab) lab.textContent = t.value + (k === 'px' || k === 'py' ? '' : '%'); changed(); }
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
    else if (t.id === 'mTr') { if (t.value) s.tr = t.value; else delete s.tr; changed(); }
    else if (t.dataset.ps) { const k = t.dataset.ps; const num = /^(weight|step|emphAt|exit)$/.test(k); TSEdit.setProp({ [k]: t.value === '' ? undefined : num ? +t.value : t.value }); if (/^(step|emphAt|exit)$/.test(k)) { normSteps(); commit(true); } panel(); }
    else if (t.dataset.pb) { const k = t.dataset.pb; TSEdit.setProp({ [k]: ['head', 'values'].includes(k) ? t.checked : (t.checked ? true : undefined) }); panel(); }
    else if (t.dataset.cc) panel();
  });
  P.addEventListener('click', e => {
    const tr = e.target.closest('.tl-r[data-id]'); if (tr) { TSEdit.select([tr.dataset.id]); return; }
    const t = e.target.closest('button'); if (!t) return; const s = S(); const one = TSEdit.picked()[0];
    if (t.dataset.mp === 'tr') return previewTr();
    if (t.dataset.mp) { stopTr(); if (t.dataset.mp === 'stop') stopPreview(); else { if (t.dataset.mp === 'play') stopPreview(true); startPreview(t.dataset.mp === 'play'); } return; }
    if (t.id === 'fSwap') return swapLayout();
    if (t.id === 'itemAdd') { const L = TS.LAYOUTS[s.layout]; const o = {}; L.it.forEach(k => o[k] = ''); o.t = '새 항목'; (s.items = s.items || []).push(o); changed(); panel(); }
    else if (t.dataset.act) { const i = +t.closest('.item').dataset.i; const a = s.items; if (t.dataset.act === 'del') a.splice(i, 1); else { const j = i + (t.dataset.act === 'up' ? -1 : 1); if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; } changed(); panel(); }
    else if (t.dataset.pick) pickImage(src => { const k = t.dataset.pick; s[k] = Object.assign({}, s[k], { src }); changed(); panel(); });
    else if (t.dataset.clear) { const k = t.dataset.clear; if (s[k]) delete s[k].src; changed(); panel(); }
    else if (t.dataset.cv != null) { TSEdit.setProp({ [t.closest('.sws').dataset.ck]: t.dataset.cv || undefined }); panel(); }
    else if (t.dataset.fmt) { const f = t.dataset.fmt; if (f === 'hilite') { TSEdit.fmt('hiliteColor', pal().accent); TSEdit.fmt('foreColor', pal().ink); } else if (f === 'accent') TSEdit.fmt('foreColor', pal().accent); else TSEdit.fmt(f); }
    else if (t.dataset.o) { const x = TSEdit.byId(t.closest('.orow').dataset.id); if (!x) return; if (x[t.dataset.o]) delete x[t.dataset.o]; else x[t.dataset.o] = true; commit(true); panel(); }
    else if (t.classList.contains('oname')) { const x = TSEdit.byId(t.closest('.orow').dataset.id); if (x) { delete x.lock; delete x.hide; view(); TSEdit.select([x.id]); } }
    else if (t.dataset.op) {
      const op = t.dataset.op; const [a, b] = op.split(':');
      if (a === 'al') TSEdit.align(b); else if (a === 'di') TSEdit.distribute(b); else if (a === 'sm') TSEdit.same(b);
      else if (op === 'imgPick') return pickImage(src => { TSEdit.setProp({ src }); panel(); });
      else if (op === 'crop') TSEdit.crop(!TSEdit.cropping());
      else if (op === 'editText' && one) { TSEdit.editText(one.id, true); return; }
      else if (op === 'iconPick') return pickIcon(name => { TSEdit.setProp({ name }); panel(); });
      else if (/^(row|col)(Add|Del)$/.test(op) && one) { const r = one.rows; if (op === 'rowAdd') r.push(r[0].map(() => '')); if (op === 'rowDel' && r.length > 1) r.pop(); if (op === 'colAdd') r.forEach(x => x.push('')); if (op === 'colDel' && r[0].length > 1) r.forEach(x => x.pop()); commit(true); }
      else if (TSEdit.OPS[op]) TSEdit.OPS[op]();
      panel();
    }
  });
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.tab; if (tab !== 'motion') TSEdit.select([]); panel(); });
  /* 타임라인: 줄을 끌어 다른 클릭으로 */
  let dragRow = null;
  P.addEventListener('dragstart', e => { const r = e.target.closest && e.target.closest('.tl-r[data-id]'); if (!r) return; dragRow = { id: r.dataset.id, kind: r.dataset.kind }; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', r.dataset.id); } catch (err) { } });
  P.addEventListener('dragover', e => { const g = dragRow && e.target.closest && e.target.closest('.tl-g'); if (!g) return; e.preventDefault(); P.querySelectorAll('.tl-g.over').forEach(x => x !== g && x.classList.remove('over')); g.classList.add('over'); });
  P.addEventListener('dragend', () => { dragRow = null; P.querySelectorAll('.tl-g.over').forEach(x => x.classList.remove('over')); });
  P.addEventListener('drop', e => { const g = dragRow && e.target.closest && e.target.closest('.tl-g'); if (!g) return; e.preventDefault(); moveRow(dragRow.id, dragRow.kind, +g.dataset.st); dragRow = null; });
  function moveRow(id2, kind, st) {
    const x = TSEdit.byId(id2); if (!x) return;
    if (kind === 'in') { if (st) x.step = st; else delete x.step; } else if (kind === 'em') { if (st > (+x.step || 0)) x.emphAt = st; else delete x.emphAt; } else { if (st > (+x.step || 0)) x.exit = st; else { toast('사라지는 시점은 등장한 뒤여야 합니다'); return; } }
    normSteps(); commit(true); panel();
  }

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
    const sh = modal(`<h3>도형</h3><div class="ico-grid shp">${Object.entries(TS.SHAPES).map(([k, v]) => `<button data-n="${k}"><div class="ts-slide T-${TS.themeOf(deck)}" style="position:relative;width:96px;height:64px;background:none;font-size:10px"><div class="ts-el ts-el-shape" style="left:8px;top:6px;width:80px;height:52px">${TS.elInner({ type: 'shape', shape: k, fill: 'accent', html: '' })}</div></div><span>${v}</span></button>`).join('')}</div><div class="row end"><button class="btn ghost" id="mClose">닫기</button></div>`, 'wide');
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
    else if (b.id === 'tExplode') explode(); else if (b.id === 'tHelp') help(); else if (/^t(Check|Outline|Find)$/.test(b.id)) return;
    markTools();
  });
  function explode() {
    const s = S(); if (s.layout === 'free') { toast('이미 자유 배치 장입니다'); return; }
    const sh = modal(`<h3>이 장을 요소로 풀기</h3><p>지금 보이는 글 · 카드 · 그림 · 선을 하나하나 따로 움직일 수 있는 요소로 바꿉니다.</p><p class="muted">풀고 나면 오른쪽 [내용] 칸 대신 화면에서 직접 고칩니다. 클릭마다 하나씩 나오던 순서는 요소의 등장 순서로 이어지고, [모션] 탭에서 바꿀 수 있습니다. [되돌리기] 로 되돌릴 수 있습니다.</p><div class="row end"><button class="btn ghost" id="mClose">취소</button><button class="btn pri" id="mOk">요소로 풀기</button></div>`);
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
  $('btMotion').onclick = () => { stopPreview(true); startPreview(true); };

  /* ---------- 터치로 장 순서 바꾸기: 장을 꾹 눌렀다가 끌어 놓는다 (터치에서는 브라우저의 끌어 놓기가 듣지 않아 따로 만든다) ---------- */
  { const R = $('rail'); let td = null, block = 0;
    const end = () => { if (!td) return; clearTimeout(td.timer); td.it.classList.remove('dragging'); td.it.style.transform = ''; R.querySelectorAll('.over').forEach(x => x.classList.remove('over')); td = null; };
    R.addEventListener('touchstart', e => { const it = e.target.closest('.rail-item'); if (!it || e.touches.length !== 1) return; const t = e.touches[0]; td = { it, i: +it.dataset.i, x: t.clientX, y: t.clientY, on: false, to: null, timer: setTimeout(() => { if (!td) return; td.on = true; it.classList.add('dragging'); try { navigator.vibrate && navigator.vibrate(12); } catch (err) { } toast('끌어서 놓을 자리로 옮기세요'); }, 380) }; }, { passive: true });
    R.addEventListener('touchmove', e => { if (!td) return; const t = e.touches[0]; if (!td.on) { if (Math.hypot(t.clientX - td.x, t.clientY - td.y) > 10) end(); return; } e.preventDefault(); td.it.style.transform = `translate(${t.clientX - td.x}px, ${t.clientY - td.y}px) scale(1.04)`;
      const o = document.elementFromPoint(t.clientX, t.clientY); const over = o && o.closest('.rail-item'); R.querySelectorAll('.over').forEach(x => x !== over && x.classList.remove('over')); if (over && over !== td.it) { over.classList.add('over'); td.to = +over.dataset.i; } else td.to = null;
      const r = R.getBoundingClientRect(); if (t.clientX > r.right - 40) R.scrollLeft += 12; else if (t.clientX < r.left + 40) R.scrollLeft -= 12; if (t.clientY > r.bottom - 40) R.scrollTop += 12; else if (t.clientY < r.top + 40) R.scrollTop -= 12; }, { passive: false });
    const drop = () => { if (!td) return; const { on, i, to } = td; end(); if (!on) return; block = Date.now(); if (to == null || to === i) return; const [m] = deck.slides.splice(i, 1); deck.slides.splice(to, 0, m); cur = to; changed(true); panel(); toast(`${i + 1}장을 ${to + 1}번째로 옮겼습니다`); };
    R.addEventListener('touchend', drop); R.addEventListener('touchcancel', end);
    R.addEventListener('click', e => { if (Date.now() - block < 500) { e.stopPropagation(); e.preventDefault(); } }, true); R.addEventListener('contextmenu', e => { if (td) e.preventDefault(); });
  }

  /* ---------- 숨긴 장 · 구역 ---------- */
  $('btHide').onclick = () => { const s = S(); if (s.hidden) delete s.hidden; else s.hidden = true; changed(); railOne(cur); markBar(); toast(s.hidden ? '이 장을 숨겼습니다 — 발표와 인쇄에서 건너뜁니다 (번호를 눌러 직접 갈 수는 있음)' : '숨김을 풀었습니다'); };
  $('btSec').onclick = () => {
    const s = S(); const sh = modal(`<h3>구역(챕터)</h3><p class="muted">이 장부터 다음 구역 전까지를 한 구역으로 묶습니다. 왼쪽 장 목록에 구역 이름이 생기고, 눌러서 접고 펼 수 있습니다.</p>
      <label class="f"><span>이 장에서 시작하는 구역 이름</span><input id="secName" value="${E(s.section || '')}" placeholder="예: 1장 · 개념과 법규"></label>
      <div class="row end"><button class="btn ghost" id="secAuto">장 구분 장마다 자동으로</button>${s.section ? '<button class="btn ghost danger" id="secDel">이 구역 없애기</button>' : ''}<button class="btn ghost" id="mClose">취소</button><button class="btn pri" id="mOk">확인</button></div>`);
    sh.querySelector('#mClose').onclick = closeModal;
    sh.querySelector('#mOk').onclick = () => { const v = sh.querySelector('#secName').value.trim(); if (v) s.section = v; else delete s.section; closeModal(); changed(true); };
    const del = sh.querySelector('#secDel'); if (del) del.onclick = () => { delete s.section; closeModal(); changed(true); };
    sh.querySelector('#secAuto').onclick = () => { let n = 0; deck.slides.forEach((x, i) => { if (x.layout === 'section') { x.section = String(x.title || '구역').replace(/\*/g, '').replace(/\n/g, ' '); n++; } else if (i === 0 && !x.section) x.section = '시작'; }); closeModal(); changed(true); toast(n ? `장 구분 ${n}곳을 구역으로 묶었습니다` : '장 구분 장이 없습니다 — [+ 장 추가] 에서 "장 구분"을 넣어 보세요'); };
  };

  /* ---------- 같은 내용, 다른 유형 ---------- */
  function swapLayout() {
    const s = S(); const n = (s.items || []).filter(x => x && (x.t || x.d || x.v || x.k)).length; const hasV = (s.items || []).some(x => x && String(x.v || '').trim());
    const c = n ? ['bullets', 'cards', 'steps', 'agenda', ...(n === 2 ? ['compare'] : []), ...(hasV ? ['stat'] : []), 'closing'] : ['statement', 'quote', 'photo', 'section', 'cover'];
    const list = c.filter(k => k !== s.layout).slice(0, 6);
    const sh = modal(`<h3>같은 내용, 다른 유형</h3><p class="muted">내용은 그대로 두고 유형만 바꾼 모습입니다. 마음에 드는 것을 누르면 바뀝니다 ([되돌리기] 가능).</p><div class="lay-grid swap">${[s.layout, ...list].map((k, i) => `<button class="lay-item${i ? '' : ' now'}" data-l="${k}"><div class="pic"></div><span>${TS.LAYOUTS[k].name}${i ? '' : ' · 지금'}${TS.LAYOUTS[k].max && n > TS.LAYOUTS[k].max ? ` <small class="warn-t">항목 ${n}개 중 ${TS.LAYOUTS[k].max}개만</small>` : ''}</span></button>`).join('')}</div><div class="row end"><button class="btn ghost" id="mClose">닫기</button></div>`, 'wide');
    sh.querySelector('#mClose').onclick = closeModal;
    sh.querySelectorAll('.lay-item').forEach(b => { const k = b.dataset.l; const t = Object.assign({}, s, { layout: k, bg: s.bg ? Object.assign({}, s.bg, { tone: undefined, dim: undefined }) : s.bg }); TS.thumb(deck, t, cur, deck.slides.length, b.querySelector('.pic')); b.onclick = () => { if (k !== s.layout) { s.layout = k; if (s.bg) { delete s.bg.tone; delete s.bg.dim; } changed(true); panel(); } closeModal(); }; });
  }

  /* ---------- 개요로 장 만들기 ---------- */
  function outlineModal() {
    const sh = modal(`<h3>개요로 장 만들기</h3><p class="muted">한글 · 워드 · 메모장에서 쓴 개요를 붙여넣으세요. 항목의 모양을 보고 장 유형을 고릅니다.</p>
      <p class="muted small"><b># 제목</b> 표지(둘째부터는 장 구분) · <b>## 장 제목</b> 한 장 · <b>- 항목</b> ("- 제목: 설명") · <b>&gt; 노트</b> · <b>| 가 | 나 |</b> 표</p>
      <textarea id="olText" rows="14" class="mono-ta" placeholder="${E(TSOutline.SAMPLE)}"></textarea><p id="olSum" class="muted small">&nbsp;</p>
      <label class="chk"><input type="radio" name="olMode" value="add" checked> 지금 장 뒤에 추가</label><label class="chk"><input type="radio" name="olMode" value="all"> 교안 전체를 이것으로 바꾸기 <small class="muted">(지금 교안은 보관함에 30일 남습니다)</small></label>
      <div class="row end"><button class="btn ghost" id="olSample">예시 넣기</button><button class="btn ghost" id="mClose">취소</button><button class="btn pri" id="mOk">만들기</button></div>`, 'wide');
    const ta = sh.querySelector('#olText'); let parsed = { slides: [] };
    const sum = () => { parsed = TSOutline.parse(ta.value); const m = {}; parsed.slides.forEach(x => { m[x.layout] = (m[x.layout] || 0) + 1; }); sh.querySelector('#olSum').textContent = parsed.slides.length ? `${parsed.slides.length}장이 만들어집니다 — ` + Object.entries(m).map(([k, v]) => `${TS.LAYOUTS[k].name} ${v}`).join(' · ') : ' '; };
    ta.oninput = sum; sh.querySelector('#olSample').onclick = () => { ta.value = TSOutline.SAMPLE; sum(); }; sh.querySelector('#mClose').onclick = closeModal;
    sh.querySelector('#mOk').onclick = async () => { sum(); if (!parsed.slides.length) { toast('만들 장이 없습니다 — "## 장 제목" 으로 시작하는 줄을 넣어 주세요', true); return; }
      if (sh.querySelector('[name="olMode"]:checked').value === 'all') { await TSStore.keepPut(deck, '개요로 교안 전체를 바꾸기 전 모습'); deck.slides = parsed.slides; if (parsed.title) { deck.title = parsed.title; $('deckTitle').value = deck.title; } cur = 0; }
      else { deck.slides.splice(cur + 1, 0, ...parsed.slides); cur++; }
      closeModal(); TSEdit.select([]); changed(true); snapshot(); panel(); toast(`${parsed.slides.length}장을 만들었습니다 — [되돌리기] 로 되돌릴 수 있습니다`, false, 6000); };
    setTimeout(() => ta.focus(), 50);
  }

  /* ---------- 찾기 · 바꾸기 (전체 장) ---------- */
  const WHERE = { kicker: '머리말', title: '제목', subtitle: '부제', body: '본문', meta: '아래 정보', source: '출처', notes: '발표 노트', memo: '메모', k: '번호' };
  /* 교안의 모든 글을 돈다: fn(글, 바꾸는 함수(정규식, 바꿀 말), 어디, 장 번호) */
  function eachText(fn) {
    deck.slides.forEach((s, i) => {
      const f = (o, k, where) => { if (typeof o[k] === 'string' && o[k]) fn(o[k], (re, to) => { o[k] = o[k].replace(re, to); }, where, i); };
      Object.keys(WHERE).forEach(k => f(s, k, WHERE[k])); (s.items || []).forEach((it, n) => it && ['k', 't', 'd', 'v', 'u'].forEach(k => f(it, k, `항목 ${n + 1}`))); if (s.image) f(s.image, 'caption', '그림 설명');
      (s.els || []).forEach(e => {
        if (typeof e.html === 'string' && e.html) { const txt = new DOMParser().parseFromString(e.html, 'text/html').body.textContent || ''; if (txt) fn(txt, (re, to) => { const t = document.createElement('template'); t.innerHTML = e.html; const w = document.createTreeWalker(t.content, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) n.nodeValue = n.nodeValue.replace(re, to); e.html = t.innerHTML; }, e.type === 'shape' ? '도형 글' : '글상자', i); }
        if (e.type === 'table') (e.rows || []).forEach((r, ri) => r.forEach((v, ci) => { if (v) fn(String(v), (re, to) => { r[ci] = String(r[ci]).replace(re, to); }, '표', i); }));
        if (e.type === 'chart') (e.data || []).forEach(r => { if (r[0]) fn(String(r[0]), (re, to) => { r[0] = String(r[0]).replace(re, to); }, '차트', i); });
      });
    });
  }
  function findModal(withReplace) {
    const sh = modal(`<h3>찾기 · 바꾸기</h3><div class="grid2"><label class="f"><span>찾을 말</span><input id="fq" autocomplete="off"></label><label class="f"><span>바꿀 말</span><input id="fr" autocomplete="off"></label></div>
      <div class="row"><label class="chk" style="margin:0"><input type="checkbox" id="fCase"> 대소문자 구분</label><span class="sp"></span><span id="fCount" class="muted small"></span></div>
      <div id="fList" class="flist"></div><div class="row end"><button class="btn ghost" id="mClose">닫기</button><button class="btn ghost" id="fOne">이 장에서만 바꾸기</button><button class="btn pri" id="fAll">모두 바꾸기</button></div>`, 'wide');
    const q = sh.querySelector('#fq'), r = sh.querySelector('#fr'); const reOf = () => { const v = q.value; if (!v) return null; return new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), sh.querySelector('#fCase').checked ? 'g' : 'gi'); };
    const scan = () => { const re = reOf(); const box = sh.querySelector('#fList'); if (!re) { box.innerHTML = ''; sh.querySelector('#fCount').textContent = ''; return; } const hits = []; let total = 0;
      eachText((txt, _, where, i) => { const m = txt.match(re); if (!m) return; total += m.length; const at = txt.search(re); const a = Math.max(0, at - 18); hits.push({ i, where, snip: (a ? '…' : '') + E(txt.slice(a, at)) + '<mark>' + E(txt.slice(at, at + m[0].length)) + '</mark>' + E(txt.slice(at + m[0].length, at + m[0].length + 30)).replace(/\n/g, ' ') }); });
      sh.querySelector('#fCount').textContent = total ? `${total}곳 (${new Set(hits.map(h => h.i)).size}장)` : '찾는 말이 없습니다';
      box.innerHTML = hits.slice(0, 200).map(h => `<button class="frow" data-i="${h.i}"><b>${h.i + 1}장</b><small>${h.where}</small><span>${h.snip}</span></button>`).join(''); };
    q.oninput = scan; sh.querySelector('#fCase').onchange = scan; sh.querySelector('#mClose').onclick = closeModal;
    sh.querySelector('#fList').onclick = e => { const b = e.target.closest('.frow'); if (b) { closeModal(); select(+b.dataset.i); } };
    const doRep = only => { const re = reOf(); if (!re) return; let n = 0; const to = r.value.replace(/\$/g, '$$$$'); eachText((txt, repl, where, i) => { if (only != null && i !== only) return; const m = txt.match(re); if (!m) return; n += m.length; repl(re, to); }); if (!n) { toast('바꿀 곳이 없습니다'); return; } $('deckTitle').value = deck.title || ''; changed(true); snapshot(); panel(); scan(); toast(`${n}곳을 바꿨습니다 — [되돌리기] 로 되돌릴 수 있습니다`, false, 6000); };
    sh.querySelector('#fAll').onclick = () => doRep(null); sh.querySelector('#fOne').onclick = () => doRep(cur);
    setTimeout(() => (withReplace && q.value ? r : q).focus(), 50);
  }

  /* ---------- 디자인 점검 ---------- */
  async function designCheck() {
    await flushEdit(); toast('디자인 점검 중…', false, 60000);
    try { issues = await TSCheck.run(deck, t => toast(t, false, 60000)); } catch (e) { console.error(e); toast('점검하지 못했습니다: ' + (e.message || e), true); return; }
    $('toast').hidden = true; rail(); const fixable = issues.filter(x => x.fix).length; const by = {}; issues.forEach((x, n) => { (by[x.slide] = by[x.slide] || []).push(Object.assign({ n }, x)); });
    const sh = modal(`<h3>디자인 점검</h3><p>${issues.length ? `<b>${Object.keys(by).length}장</b>에서 <b>${issues.length}건</b>을 찾았습니다. 이 가운데 <b>${fixable}건</b>은 자동으로 고칠 수 있습니다.` : '찾은 문제가 없습니다. 글자 넘침 · 사진 위 글자 대비 · 작은 글자 · 여백을 모두 살폈습니다.'}</p>
      <div class="clist">${Object.keys(by).map(i => `<div class="cgroup"><button class="chead" data-go="${i}"><b>${+i + 1}장</b><span>${E(String(deck.slides[i].title || (TS.LAYOUTS[deck.slides[i].layout] || {}).name || '').replace(/\*/g, '').replace(/\n/g, ' ').slice(0, 40))}</span><small>보러 가기</small></button>${by[i].map(x => `<div class="crow"><b class="k-${x.kind === '넘침' ? 'o' : x.kind === '대비' ? 'c' : x.kind === '작은 글자' ? 's' : 'm'}">${x.kind}</b><span>${E(x.msg)}</span>${x.fix ? `<button class="tb" data-fix="${x.n}">고치기</button>` : '<small>직접 고쳐야 함</small>'}</div>`).join('')}</div>`).join('')}</div>
      <div class="row end"><button class="btn ghost" id="mClose">닫기</button><button class="btn ghost" id="cAgain">다시 점검</button>${fixable ? `<button class="btn pri" id="cAll">한 번에 고치기 (${fixable}건)</button>` : ''}</div>`, 'wide');
    sh.querySelector('#mClose').onclick = closeModal; sh.querySelector('#cAgain').onclick = designCheck;
    const done = n => { changed(true); snapshot(); panel(); toast(`${n}건을 고쳤습니다 — [되돌리기] 로 되돌릴 수 있습니다`, false, 5000); designCheck(); };
    /* 한 번에 고치기: 하나를 고치면 다른 것의 조건이 바뀔 수 있어(배경을 덮으면 글자색이 다시 안 맞는 식), 고치고 다시 재는 것을 몇 번 되풀이한다 */
    const all = sh.querySelector('#cAll'); if (all) all.onclick = async () => { all.disabled = true; let n = 0; for (let round = 0; round < 4; round++) { const f = issues.filter(x => x.fix); if (!f.length) break; f.forEach(x => x.fix()); n += f.length; if (round < 3) issues = await TSCheck.run(deck, t => toast(t, false, 60000)); } done(n); };
    sh.querySelector('.clist').onclick = e => { const g = e.target.closest('[data-go]'); if (g) { closeModal(); select(+g.dataset.go); return; } const b = e.target.closest('[data-fix]'); if (b) { issues[+b.dataset.fix].fix(); done(1); } };
  }
  $('tCheck').onclick = designCheck; $('tOutline').onclick = outlineModal; $('tFind').onclick = () => findModal(false);

  /* ---------- 도움말 (단축키) ---------- */
  function help() {
    const rows = [['저장 · PDF 인쇄 · 도움말', 'Ctrl+S · Ctrl+P · F1'], ['발표 (지금 장부터)', 'F5'], ['새 장 · 장 복제 · 장 지우기', 'Ctrl+M · Ctrl+Shift+D · Ctrl+Delete'], ['장 이동', 'PageUp · PageDown'], ['요소 고르기', '클릭 · Shift+클릭 · 빈 곳에서 끌기 · Tab · Ctrl+A · Esc 해제'], ['요소 옮기기', '끌기 · 화살표 10 · Ctrl+화살표 1 · Shift+화살표 50'], ['끌 때', 'Shift 한 방향 · Ctrl 복제 · Alt 자석 끄기'], ['크기 · 회전', '테두리 점(Shift 비율 유지) · 위쪽 둥근 점(Shift 15도씩)'], ['복제 · 지우기', 'Ctrl+D · Delete'], ['복사 · 잘라내기 · 붙여넣기', 'Ctrl+C · Ctrl+X · Ctrl+V (다른 교안 탭에도)'], ['서식 복사 · 붙여넣기', 'Ctrl+Shift+C · Ctrl+Shift+V'], ['앞으로 · 뒤로 / 맨 앞 · 맨 뒤', 'Ctrl+] · Ctrl+[ / Ctrl+Shift+] · Ctrl+Shift+['], ['묶기 · 풀기', 'Ctrl+G · Ctrl+Shift+G'], ['글 고치기 시작 · 끝', '더블클릭 · Enter · F2 / Esc'], ['글 서식', 'Ctrl+B · Ctrl+I · Ctrl+U'], ['표', '칸 더블클릭 · Tab 다음 칸 · 엑셀/한글 표 Ctrl+V'], ['그림', 'Ctrl+V · 화면에 끌어다 놓기 · 더블클릭 자르기(휠 확대)'], ['되돌리기 · 다시 실행', 'Ctrl+Z · Ctrl+Y'], ['찾기 · 바꾸기', 'Ctrl+F · Ctrl+H'], ['터치(휴대폰 · 태블릿)', '한 번 톡 고르기 · 끌어 옮기기 · 두 번 톡 글 고치기 · 장 순서는 ↑ ↓']];
    const sh = modal(`<h3>단축키 (PowerPoint 와 같은 배치)</h3><table class="keys">${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table><div class="row end"><button class="btn pri" id="mClose">닫기</button></div>`, 'wide');
    sh.querySelector('#mClose').onclick = closeModal;
  }

  /* ---------- 교안 설정 · 내보내기 ---------- */
  /* 글을 고치는 중이면 그 글부터 확정 (나가기 · 저장 · 내보내기 전에) */
  const flushEdit = async () => { const a = document.activeElement; if (a && (a.isContentEditable || /^(INPUT|TEXTAREA)$/.test(a.tagName))) { a.blur(); await new Promise(r => setTimeout(r, 40)); } snapshot(); };
  let busyExport = false;
  async function doExport(kind) {
    if (busyExport) return; busyExport = true; await flushEdit();
    try { if (dirty || kind === 'pdf' || kind === 'handout') await putDraft(); // 인쇄 화면은 이 기기의 작업본을 읽는다 → 지금 화면 그대로
      toast(TSExport.ITEMS.find(x => x[0] === kind)[1] + ' 만드는 중…', false, 120000);
      await TSExport.run(kind, deck, t => toast(t, false, 120000)); toast(TSExport.DONE[kind], false, 6000);
    } catch (e) { console.error(e); toast('내보내지 못했습니다: ' + (e.message || e), true, 9000); }
    busyExport = false;
  }
  const printPdf = () => doExport('pdf');
  function importFile() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { const d = JSON.parse(await f.text()); if (!Array.isArray(d.slides)) throw 0; await TSStore.keepPut(deck, '파일에서 가져오기 전 모습'); d.id = id; delete d._synced; deck = d; cur = 0; $('deckTitle').value = deck.title || ''; TSEdit.select([]); changed(true); panel(); toast('가져왔습니다 — 이 교안의 내용이 바뀌었습니다. 직전 모습은 보관함에 30일 남고, [되돌리기] 로도 돌아갑니다', false, 8000); } catch (err) { toast('TAESTEP 교안 파일이 아닙니다', true); } };
    inp.click();
  }
  /* [내보내기] 메뉴 */
  const closeMenu = () => { $('menu').hidden = true; };
  $('btExport').onclick = e => {
    e.stopPropagation(); const m = $('menu'); if (!m.hidden) return closeMenu();
    m.innerHTML = TSExport.ITEMS.map(([k, t, d]) => `<button data-x="${k}"><b>${t}</b><small>${d}</small></button>`).join('') + `<hr><button data-x="import"><b>파일에서 가져오기</b><small>내려받아 둔 교안 파일(.taestep.json)로 이 교안의 내용을 바꿉니다. 지금 모습은 보관함에 남습니다.</small></button><button data-x="history"><b>저장 이력 · 보관된 작업본</b><small>저장할 때마다 남은 이전 판을 미리 보고 되돌리기 · 고르지 않은 작업본 되살리기(30일)</small></button>`;
    const r = $('btExport').getBoundingClientRect(); m.style.top = r.bottom + 6 + 'px'; m.style.right = Math.max(8, innerWidth - r.right) + 'px'; m.hidden = false;
  };
  $('menu').onclick = e => { const b = e.target.closest('button'); if (!b) return; closeMenu(); const k = b.dataset.x; if (k === 'import') importFile(); else if (k === 'history') historyModal(); else doExport(k); };
  addEventListener('click', e => { if (!$('menu').hidden && !e.target.closest('#menu')) closeMenu(); });

  /* 저장 이력(판) · 보관된 작업본 */
  async function historyModal() {
    await flushEdit();
    const sh = modal(`<h3>저장 이력 · 보관된 작업본</h3><div class="sub-h" style="margin-top:0">보관된 작업본 <small>이 기기 · 30일</small></div><div id="hKept"><p class="muted small">불러오는 중…</p></div><div class="sub-h">저장 이력 <small>저장할 때마다 남은 판 (GitHub 저장소)</small></div><div id="hVer"><p class="muted small">불러오는 중…</p></div><div class="row end"><button class="btn ghost" id="mClose">닫기</button></div>`, 'wide');
    sh.querySelector('#mClose').onclick = closeModal;
    const useDeck = async (d, label) => { await TSStore.keepPut(deck, '다른 판을 불러오기 전 모습'); const x = JSON.parse(JSON.stringify(d)); x.id = id; delete x._synced; deck = x; cur = Math.min(cur, deck.slides.length - 1); $('deckTitle').value = deck.title || ''; TSEdit.select([]); closeModal(); changed(true); snapshot(); panel(); toast(`${label} 을(를) 불러왔습니다 — 확인한 뒤 [저장] 을 눌러야 저장소에 반영됩니다. 직전 모습은 보관함에 30일 남습니다`, false, 9000); };
    /* 한 장을 "어디: 글" 목록으로 편다 → 두 판을 나란히 놓고 달라진 곳만 뽑는다 */
    const flat = x => { const m = {}; if (!x) return m; const put = (k, v) => { if (v != null && String(v) !== '') m[k] = String(v); };
      put('장 유형', (TS.LAYOUTS[x.layout] || {}).name); Object.keys(WHERE).forEach(k => put(WHERE[k], x[k])); (x.items || []).forEach((it, n) => it && ['k', 't', 'd', 'v', 'u'].forEach(k => put(`항목 ${n + 1} · ${TS.ITEM_LABEL[k]}`, it[k])));
      if (x.image) { put('그림', x.image.src && x.image.src.slice(-40)); put('그림 설명', x.image.caption); } if (x.bg) put('배경', [x.bg.src ? x.bg.src.slice(-40) : '그림 없음', TS.MOTIONS[x.bg.motion], TS.TONES[x.bg.tone], x.bg.dim != null ? '덮기 ' + Math.round(x.bg.dim * 100) + '%' : ''].filter(Boolean).join(' · '));
      put('장 넘김', TS.TRANSITIONS[x.tr]); put('숨김', x.hidden ? '숨긴 장' : ''); put('구역', x.section); put('제목 글자 크기', x.titleScale ? Math.round(x.titleScale * 100) + '%' : '');
      (x.els || []).forEach(e => { const nm = `${TYPE[e.type] || '요소'} (${String(e.id).slice(0, 4)})`; put(nm + ' 내용', e.html ? new DOMParser().parseFromString(e.html, 'text/html').body.textContent : e.type === 'table' ? (e.rows || []).map(r => r.join(' | ')).join(' / ') : e.type === 'chart' ? (e.data || []).map(r => r.join(' ')).join(', ') : e.name || e.shape || (e.src || '').slice(-40)); put(nm + ' 자리 · 크기', `가로 ${e.x} · 세로 ${e.y} · ${e.w}×${e.h}${e.rot ? ' · ' + e.rot + '도' : ''}`); put(nm + ' 모션', [(+e.step ? '클릭 ' + e.step : ''), TS.ANIMS[e.anim], TS.EMPHS[e.emph], e.exit ? '클릭 ' + e.exit + '에 사라짐' : ''].filter(Boolean).join(' · ')); });
      return m; };
    const hl = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; let j = 0; while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++; const cut = t => (i > 24 ? '…' : '') + E(t.slice(Math.max(0, i - 24), i)) + '<mark>' + E(t.slice(i, t.length - j)) + '</mark>' + E(t.slice(t.length - j, t.length - j + 24)) + (j > 24 ? '…' : ''); return [cut(a), cut(b)]; };
    const diffRows = (old, now) => { const A = flat(old), B = flat(now); return [...new Set([...Object.keys(A), ...Object.keys(B)])].filter(k => A[k] !== B[k]).map(k => { const [x, y] = A[k] != null && B[k] != null ? hl(A[k], B[k]) : [A[k] != null ? E(A[k].slice(0, 80)) : '<i>(없음)</i>', B[k] != null ? E(B[k].slice(0, 80)) : '<i>(없음)</i>']; return `<div class="drow"><b>${E(k)}</b><span class="d-old">${x}</span><span class="d-new">${y}</span></div>`; }).join(''); };
    const preview = (d, label, onUse) => { const pv = modal(`<h3>미리 보기 — ${E(label)}</h3><p class="muted">${(d.slides || []).length}장 · 지금 교안과 ${TSStore.diff(deck, d)}장이 다릅니다.</p><div class="lay-grid pv">${(d.slides || []).map((x, i) => { const df = JSON.stringify(x) !== JSON.stringify(deck.slides[i]); return `<div class="lay-item${df ? ' diff' : ''}" data-i="${i}"><div class="pic"></div><span>${i + 1}${df ? ' · 지금과 다름 (눌러서 보기)' : ''}</span></div>`; }).join('')}</div><div id="pvDiff" class="pvdiff"></div><div class="row end"><button class="btn ghost" id="pvBack">목록으로</button><button class="btn pri" id="pvUse">이 판으로 되돌리기</button></div>`, 'wide'); pv.querySelectorAll('.pic').forEach((h, i) => TS.thumb(d, d.slides[i], i, d.slides.length, h)); pv.querySelector('.lay-grid').onclick = e => { const it = e.target.closest('.lay-item.diff'); if (!it) return; const i = +it.dataset.i; pv.querySelectorAll('.lay-item.sel').forEach(x => x.classList.remove('sel')); it.classList.add('sel'); const rows = diffRows(d.slides[i], deck.slides[i]); const box = pv.querySelector('#pvDiff'); box.innerHTML = `<div class="drow head"><b>${i + 1}장 — 달라진 곳</b><span>그 판</span><span>지금</span></div>` + (rows || '<div class="drow"><b>겉으로 드러나는 차이 없음</b><span></span><span></span></div>'); box.scrollIntoView({ block: 'nearest' }); }; if ((d.slides || []).length !== deck.slides.length) pv.querySelector('#pvDiff').innerHTML = `<div class="drow head"><b>장 수</b><span>그 판 ${(d.slides || []).length}장</span><span>지금 ${deck.slides.length}장</span></div>`;
      pv.querySelector('#pvBack').onclick = historyModal; pv.querySelector('#pvUse').onclick = onUse; };
    const kept = await TSStore.keepList(id); const kb = sh.querySelector('#hKept'); if (!kb) return;
    kb.innerHTML = kept.length ? kept.map((k, i) => `<div class="hrow" data-i="${i}"><div><b>${whenFull(k.at)}</b><small>${k.slides}장 · ${E(k.why || '')}</small></div><button class="tb" data-a="pv">미리 보기</button><button class="tb" data-a="use">되살리기</button><button class="tb danger" data-a="del">지우기</button></div>`).join('') : '<p class="muted small">보관된 작업본이 없습니다.</p>';
    kb.onclick = async e => { const b = e.target.closest('button'); if (!b) return; const k = kept[+b.closest('.hrow').dataset.i]; const label = whenFull(k.at) + ' 작업본';
      if (b.dataset.a === 'pv') preview(k.deck, label, () => useDeck(k.deck, label)); else if (b.dataset.a === 'use') useDeck(k.deck, label); else if (confirm('이 보관본을 지울까요? 지우면 되살릴 수 없습니다.')) { await TSStore.keepDel(k.key); historyModal(); } };
    const vb = sh.querySelector('#hVer');
    try { const vs = await TSStore.history(id); if (!sh.isConnected) return;
      vb.innerHTML = vs.length ? vs.map((v, i) => `<div class="hrow" data-i="${i}"><div><b>${whenFull(v.at)}</b><small>${i === 0 ? '가장 최근 저장 · ' : ''}${E(v.msg)}</small></div><button class="tb" data-a="pv">미리 보기</button><button class="tb" data-a="use">이 판으로 되돌리기</button></div>`).join('') : '<p class="muted small">아직 저장한 적이 없습니다.</p>';
      vb.onclick = async e => { const b = e.target.closest('button'); if (!b) return; const v = vs[+b.closest('.hrow').dataset.i]; const label = whenFull(v.at) + ' 저장 판'; b.disabled = true;
        try { const d = await TSStore.version(id, v.sha); if (b.dataset.a === 'pv') preview(d, label, () => useDeck(d, label)); else useDeck(d, label); } catch (err) { b.disabled = false; toast('그 판을 불러오지 못했습니다: ' + err.message, true); } };
    } catch (err) { if (vb.isConnected) vb.innerHTML = `<p class="muted small">저장 이력을 불러오지 못했습니다 (${E(err.message)}).</p>`; }
  }
  $('btMore').onclick = () => {
    const sh = modal(`<h3>교안 설정</h3>
      <div class="grid2"><label class="f"><span>테마</span><select id="sTheme">${Object.entries(TS.THEMES).map(([k, v]) => `<option value="${k}"${TS.themeOf(deck) === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="f"><span>장 넘김 (기본값)</span><select id="sTr">${Object.entries(TS.TRANSITIONS).map(([k, v]) => `<option value="${k}"${(deck.transition || 'fade') === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="f"><span>강조색 <small>비우면 테마 색</small></span><input id="sAccent" value="${E(deck.accent || '')}" placeholder="#4DEBFF"></label>
      <label class="f"><span>기관 이름 (표지 왼쪽 위)</span><input id="sOrg" value="${E(deck.org || '')}"></label>
      <label class="f"><span>대상</span><input id="sAud" value="${E(deck.audience || '')}" placeholder="예: 현장지휘관(소방령)"></label>
      <label class="f"><span>강의 시간(분)</span><input id="sMin" type="number" min="0" value="${+deck.minutes || ''}"></label></div>
      <label class="f"><span>아래 줄 문구 <small>비우면 교안 제목</small></span><input id="sFoot" value="${E(deck.footer || '')}"></label>
      <div class="f"><span>기본 배경 <small>그림을 고르지 않은 장 전체에 어둡게 깔립니다</small></span><div class="pick"><div class="pick-pic" style="${deck.bg && deck.bg.src ? `background-image:url('${deck.bg.src.replace(/'/g, '%27')}')` : ''}"></div><div class="pick-btn"><button class="btn ghost" id="sBg">그림 고르기</button>${deck.bg && deck.bg.src ? '<button class="btn ghost" id="sBgX">없애기</button>' : ''}</div></div></div>
      <label class="chk"><input type="checkbox" id="sAuto"${autoOn() ? ' checked' : ''}> 자동 저장 — 손을 멈추고 30초 뒤 GitHub 저장소에 저장 (이 기기 설정)</label>
      <p class="muted small">내보내기(PPTX · PDF · 단독 HTML · 교안 파일)는 위쪽 [내보내기] 단추에 있습니다.</p>
      <div class="row end"><button class="btn pri" id="mOk">확인</button></div>`);
    const set = (k, v) => { if ((deck[k] || '') !== v) { if (v === '' || v === 0) delete deck[k]; else deck[k] = v; changed(true); } };
    sh.querySelector('#sTheme').onchange = e => { set('theme', e.target.value); panel(); }; sh.querySelector('#sTr').onchange = e => set('transition', e.target.value);
    sh.querySelector('#mOk').onclick = () => {
      const a = sh.querySelector('#sAccent').value.trim(); set('accent', /^#[0-9a-f]{3,8}$/i.test(a) ? a : '');
      set('org', sh.querySelector('#sOrg').value.trim()); set('audience', sh.querySelector('#sAud').value.trim()); set('minutes', +sh.querySelector('#sMin').value || 0); set('footer', sh.querySelector('#sFoot').value.trim()); closeModal(); panel();
    };
    sh.querySelector('#sBg').onclick = () => pickImage(src => { deck.bg = Object.assign({ motion: 'zoom-in', dim: .86 }, deck.bg, { src }); changed(true); panel(); toast('기본 배경을 바꿨습니다'); });
    const bx = sh.querySelector('#sBgX'); if (bx) bx.onclick = () => { delete deck.bg; closeModal(); changed(true); panel(); };
    sh.querySelector('#sAuto').onchange = e => { try { localStorage.setItem('taestep:autosave', e.target.checked ? '1' : '0'); } catch (err) { } toast(e.target.checked ? '자동 저장을 켰습니다 — 고친 뒤 30초 동안 손을 멈추면 저장소에 저장합니다' : '자동 저장을 껐습니다'); };
  };

  /* ---------- 저장 · 발표 ---------- */
  function askToken(then) {
    const sh = modal(`<h3>GitHub 연결</h3><p class="muted">[저장] 은 교안을 GitHub 저장소에 올립니다. 이 기기에서 처음이면 토큰을 한 번 넣어 주세요. 토큰은 이 기기에만 보관됩니다.</p>
      <label class="f"><span>토큰</span><input id="tk" type="password" placeholder="github_pat_…" autocomplete="off"></label>
      <p class="muted small">만드는 곳: github.com/settings/personal-access-tokens/new → 저장소 <b>${E(TSStore.repo().repo)}</b> 선택 → Repository permissions 의 <b>Contents: Read and write</b></p>
      <div class="row end"><button class="btn ghost" id="mClose">취소</button><button class="btn pri" id="mOk">연결하고 저장</button></div>`, '', true);
    sh.querySelector('#mClose').onclick = () => { closeModal(); then(false); };
    sh.querySelector('#mOk').onclick = () => { const v = sh.querySelector('#tk').value.trim(); if (!v) return; TSStore.setToken(v); closeModal(); then(true); };
  }
  /* 다른 곳에서 먼저 저장된 경우 */
  const conflict = (remote, opt) => new Promise(done => {
    const sh = modal(`<h3>이 교안이 다른 곳에서 먼저 저장되었습니다</h3><p>다른 기기나 다른 탭에서 <b>${whenFull(remote.modified)}</b> 에 저장했습니다. ${base ? `지금 화면은 그 전(${whenFull(base)}) 저장본에서 시작한 것입니다.` : ''} 두 교안은 <b>${TSStore.diff(deck, remote)}장</b>이 다릅니다.</p>
      <div class="cp-cards"><div class="cp-card"><div class="cp-name">내 것으로 덮어쓰기</div><div class="cp-sub">지금 화면을 저장합니다. 그쪽에서 고친 내용은 저장 이력에 남아 되돌릴 수 있습니다.</div><button class="btn ghost wide" data-c="mine">내 것으로 덮어쓰기</button></div>
      <div class="cp-card"><div class="cp-name">저장소 것 불러오기</div><div class="cp-sub">그쪽 저장본으로 엽니다. 내 것은 작업본으로 보관함에 30일 남습니다.</div><button class="btn ghost wide" data-c="theirs">저장소 것 불러오기</button></div></div>
      <div class="row end"><button class="btn pri" data-c="cancel">취소 (저장하지 않음)</button></div>`, 'wide', true);
    sh.onclick = async e => { const b = e.target.closest('[data-c]'); if (!b) return; closeModal(); const c = b.dataset.c;
      if (c === 'mine') done(await save1(Object.assign({}, opt, { force: true })));
      else if (c === 'theirs') { await TSStore.keepPut(deck, '다른 곳의 저장본을 불러오며 보관'); await TSStore.draftDel(id); deck = remote; deck.id = id; base = remote.modified || ''; cur = Math.min(cur, deck.slides.length - 1); dirty = false; rev++; hist = [snapOf()]; hi = 0; $('deckTitle').value = deck.title || ''; TSEdit.select([]); state(); rail(); view(); panel(); toast('저장소의 교안을 불러왔습니다 · 내 것은 [내보내기] → [저장 이력 · 보관된 작업본] 에 남겼습니다', false, 8000); done(true); }
      else done(false); };
  });
  /* 저장: 끝나면 true. 저장 중에 또 고쳤으면 '저장 안 됨' 으로 남긴다 */
  function save(opt) { if (saving) return saving; saving = (async () => { await flushEdit(); state(); return save1(opt || {}); })().finally(() => { saving = null; $('btSave').disabled = false; state(); }); $('btSave').disabled = true; state(); return saving; }
  async function save1(opt) {
    const r0 = rev; deck._base = base;
    try {
      await TSStore.save(deck, t => { $('state').textContent = t; }, { force: opt.force });
      base = deck._base; offlinePending = false;
      if (rev === r0) { dirty = false; deck._synced = true; await TSStore.draftPut(deck); } else putDraft(); // 배포(1~2분)가 끝날 때까지는 이 기기 사본으로 연다
      view(); if (!P.contains(document.activeElement)) panel();
      if (!opt.quiet) toast(rev === r0 ? '저장했습니다 — 다른 기기에는 1~2분 뒤(배포 후) 보입니다' : '저장했습니다 · 저장하는 동안 고친 내용은 아직 저장되지 않았습니다', false, 5000);
      return true;
    } catch (e) {
      if (e.code === 'notoken' || e.status === 401) { if (e.status === 401) TSStore.setToken(''); if (opt.quiet) return false; return new Promise(res => askToken(async ok => res(ok ? await save1(opt) : false))); }
      if (e.code === 'conflict') { if (opt.quiet) { toast('자동 저장을 멈췄습니다 — 다른 곳에서 먼저 저장되었습니다. [저장] 을 눌러 확인해 주세요', true, 9000); return false; } return conflict(e.remote, opt); }
      if (e.code === 'offline') { await putDraft(); offlinePending = true; if (!opt.quiet) toast('인터넷에 연결되어 있지 않아 저장소에 올리지 못했습니다 — 고친 내용은 이 기기에 작업본으로 보관했습니다. 연결되면 알려 드립니다', true, 9000); return false; }
      if (!opt.quiet) toast('저장하지 못했습니다: ' + (e.message || e), true, 9000); return false;
    }
  }
  addEventListener('online', () => { if (dirty || offlinePending) { if (autoOn() && TSStore.repo().token) save({ quiet: true }).then(ok => ok && toast('인터넷에 다시 연결되어 자동으로 저장했습니다')); else toast('인터넷에 다시 연결됐습니다 — [저장] 을 눌러 저장소에 올리세요', false, 9000); } });
  addEventListener('offline', () => toast('인터넷 연결이 끊겼습니다 — 고친 내용은 이 기기에 작업본으로 보관됩니다', true, 6000));
  $('btSave').onclick = () => save(); $('btUndo').onclick = undo; $('btRedo').onclick = redo;

  /* ---------- 나갈 때: 저장 안 한 변경이 있으면 묻는다 ---------- */
  const go = url => { leaving = true; location.href = url; };
  async function leave(url) {
    await flushEdit(); if (!dirty) return go(url); await putDraft();
    const has = !!TSStore.repo().token;
    const sh = modal(`<h3>저장하지 않은 변경이 있습니다</h3><p>저장하지 않고 나가도 고친 내용은 <b>이 기기에 작업본으로 남아</b>, 다음에 이 교안을 열 때 이어서 할지 묻습니다. 다만 다른 기기에서는 보이지 않습니다.</p>
      ${has ? '' : '<p class="warn-t">이 기기는 GitHub 에 연결되어 있지 않아 저장소에 저장할 수 없습니다. 연결한 뒤 저장하거나, 교안 파일로 내려받아 두세요.</p>'}
      <div class="row end leave">${has ? '<button class="btn pri" data-l="save">저장하고 나가기</button>' : '<button class="btn pri" data-l="save">GitHub 연결하고 저장</button><button class="btn ghost" data-l="file">교안 파일로 내려받고 나가기</button>'}<button class="btn ghost" data-l="go">저장하지 않고 나가기</button><button class="btn ghost" data-l="stay">계속 편집</button></div>`, '', true);
    sh.onclick = async e => { const b = e.target.closest('[data-l]'); if (!b) return; const k = b.dataset.l; closeModal();
      if (k === 'save') { const ok = await save(); if (ok && !dirty) go(url); else if (!ok) toast('저장하지 못해 나가지 않았습니다 — 위 알림을 확인해 주세요', true, 7000); }
      else if (k === 'file') { await TSExport.run('json', deck); setTimeout(() => go(url), 600); }
      else if (k === 'go') go(url); };
  }
  document.querySelectorAll('a.brand, #btHome').forEach(a => a.addEventListener('click', e => { e.preventDefault(); leave('./'); }));
  addEventListener('beforeunload', e => { if (dirty && !leaving) { putDraft(); e.preventDefault(); e.returnValue = ''; } }); // 창 닫기 · 새로고침 · 뒤로가기 · 주소 입력
  document.addEventListener('visibilitychange', () => { if (document.hidden && dirty) putDraft(); });
  /* 같은 교안을 다른 탭에서도 열었는지 */
  if ('BroadcastChannel' in window) { const bc = new BroadcastChannel('taestep:edit:' + id); let told = false; const warn = () => { if (told) return; told = true; toast('이 교안이 다른 탭에서도 열려 있습니다 — 한쪽에서만 고쳐 주세요. 양쪽에서 저장하면 나중에 저장하는 쪽에서 덮어쓸지 묻습니다', true, 12000); $('state').classList.add('twin'); };
    bc.onmessage = e => { if (e.data === 'hello') { bc.postMessage('here'); warn(); } else if (e.data === 'here') warn(); }; bc.postMessage('hello'); }

  /* ---------- 발표: 편집 화면 위에 띄운다 → 닫으면 편집하던 상태(되돌리기 기록 포함) 그대로 ---------- */
  async function play() {
    if (document.querySelector('.play-frame')) return; await flushEdit(); if (dirty) await putDraft(); TSEdit.select([]);
    const f = document.createElement('iframe'); f.className = 'play-frame'; f.allow = 'fullscreen'; f.setAttribute('allowfullscreen', ''); f.src = `play.html?deck=${encodeURIComponent(id)}&embed=1#${cur + 1}`; document.body.appendChild(f); f.onload = () => { try { f.contentWindow.focus(); } catch (e) { } };
  }
  addEventListener('message', e => { if (e.origin !== location.origin || !e.data) return; if (e.data.type === 'taestep-play-close') { const f = document.querySelector('.play-frame'); if (f) f.remove(); window.focus(); if (e.data.slide && e.data.slide - 1 !== cur) select(e.data.slide - 1); } });
  $('btPlay').onclick = play;
  $('deckTitle').value = deck.title || ''; $('deckTitle').oninput = e => { deck.title = e.target.value; changed(); };
  addEventListener('keydown', e => {
    const c = e.ctrlKey || e.metaKey, k = e.key.toLowerCase(), ty = typing(e);
    if (document.querySelector('.play-frame')) return;
    if (!$('menu').hidden && e.key === 'Escape') return closeMenu();
    if (!$('modal').hidden) { if (e.key === 'Escape' && !sticky) closeModal(); return; }
    if (c && k === 's') { e.preventDefault(); return save(); }
    if (c && k === 'p') { e.preventDefault(); return printPdf(); }
    if (e.key === 'F5') { e.preventDefault(); return play(); }
    if (e.key === 'F1') { e.preventDefault(); return help(); }
    if (ty) return;
    if (c && k === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
    if (c && k === 'y') { e.preventDefault(); return redo(); }
    if (c && (k === 'f' || k === 'h')) { e.preventDefault(); return findModal(k === 'h'); }
    if (c && k === 'm') { e.preventDefault(); return addSlide(); }
    if (c && e.shiftKey && k === 'd') { e.preventDefault(); return dupSlide(); }
    if (c && e.key === 'Delete') { e.preventDefault(); return delSlide(); }
    if (c && k === 'v') return; // 붙여넣기는 paste 에서
    if (TSEdit.key(e)) { e.preventDefault(); return; }
    if (c && k === 'c') { try { localStorage.setItem('taestep:slide', JSON.stringify({ slide: S() })); localStorage.removeItem('taestep:clip'); navigator.clipboard.writeText('taestep-clip').catch(() => { }); } catch (err) { } toast('이 장을 복사했습니다 — Ctrl+V 로 붙여넣기 (다른 교안에도)'); return; }
    if (e.key === 'PageDown') { e.preventDefault(); select(cur + 1); } else if (e.key === 'PageUp') { e.preventDefault(); select(cur - 1); }
  });
  dirty = startDirty; if (dirty) putDraft();
  state(); rail(); view(); panel(); markTools(); if (openNote) toast(openNote, false, 9000);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { rail(); view(); });
})();
