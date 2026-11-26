/* TAESTEP 편집 화면 — 왼쪽 장 목록 · 가운데 미리보기 · 오른쪽 입력 칸
   장 유형을 고르고 칸만 채우면 디자인은 엔진이 맞춘다. 고친 내용은 이 기기에 바로 보관되고, [저장] 을 누르면 GitHub 저장소에 올라간다. */
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
  let tab = 'content', dirty = false, saved = JSON.stringify(deck);
  const hist = [saved]; let histT = 0, draftT = 0, viewT = 0;
  const S = () => deck.slides[cur];

  /* ---------- 알림 · 창 ---------- */
  let toastT = 0;
  const toast = (t, bad) => { const o = $('toast'); o.textContent = t; o.className = 'toast' + (bad ? ' bad' : ''); o.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { o.hidden = true; }, 3600); };
  const modal = (html, cls) => { const m = $('modal'); m.innerHTML = `<div class="sheet ${cls || ''}">${html}</div>`; m.hidden = false; m.onclick = e => { if (e.target === m) closeModal(); }; return m.firstChild; };
  const closeModal = () => { $('modal').hidden = true; $('modal').innerHTML = ''; };

  /* ---------- 바뀜 처리 ---------- */
  const state = () => { $('state').textContent = dirty ? '저장 안 된 변경 있음 (이 기기에 보관 중)' : '저장됨'; $('state').classList.toggle('warn', dirty); };
  function changed(structure) {
    dirty = true; deck.modified = new Date().toISOString(); state();
    clearTimeout(draftT); draftT = setTimeout(() => TSStore.draftPut(deck), 500);
    clearTimeout(histT); histT = setTimeout(() => { const j = JSON.stringify(deck); if (j !== hist[hist.length - 1]) { hist.push(j); if (hist.length > 60) hist.shift(); } }, 600);
    if (structure) { rail(); view(); } else { clearTimeout(viewT); viewT = setTimeout(() => { view(); railOne(cur); }, 120); }
  }
  function undo() {
    clearTimeout(histT); const now = JSON.stringify(deck); if (hist[hist.length - 1] !== now) hist.push(now);
    if (hist.length < 2) { toast('되돌릴 내용이 없습니다'); return; }
    hist.pop(); deck = JSON.parse(hist[hist.length - 1]); deck.id = id; cur = Math.min(cur, deck.slides.length - 1);
    dirty = true; state(); TSStore.draftPut(deck); $('deckTitle').value = deck.title || ''; rail(); view(); panel();
  }

  /* ---------- 그리기 ---------- */
  function view() { const el = TS.thumb(deck, S(), cur, deck.slides.length, $('view')); return el; }
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
  function select(i) { cur = Math.max(0, Math.min(deck.slides.length - 1, i)); [...$('rail').children].forEach((d, k) => d.classList.toggle('cur', k === cur)); const c = $('rail').children[cur]; if (c) c.scrollIntoView({ block: 'nearest' }); view(); panel(); try { history.replaceState(null, '', '#' + (cur + 1)); } catch (e) { } }

  /* ---------- 입력 칸 ---------- */
  const HINT = { title: '*별표 사이* 는 강조색으로 나옵니다', meta: '한 줄에 하나 · "교수요원: 김태의" 처럼 쓰면 라벨과 값으로 나뉩니다', source: '예: 출처 · 소방청 통계연보(2025)' };
  const ROWS = { title: 2, subtitle: 2, body: 6, meta: 3, kicker: 1, k: 1, source: 1 };
  const ta = (key, val, rows, ph) => rows > 1 ? `<textarea data-k="${key}" rows="${rows}" placeholder="${E(ph || '')}">${E(val || '')}</textarea>` : `<input data-k="${key}" value="${E(val || '')}" placeholder="${E(ph || '')}">`;
  function panel() {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const p = $('panel'); const s = S(); const L = TS.LAYOUTS[s.layout] || TS.LAYOUTS.bullets;
    if (tab === 'content') {
      let h = `<label class="f"><span>장 유형</span><select id="fLayout">${Object.entries(TS.LAYOUTS).map(([k, v]) => `<option value="${k}"${k === s.layout ? ' selected' : ''}>${v.name}</option>`).join('')}</select></label>`;
      L.f.forEach(k => {
        if (k === 'items') {
          h += `<div class="f"><span>${s.layout === 'compare' ? '비교 대상 (2개)' : '항목'} <small>최대 ${L.max}개</small></span><div id="items">${(s.items || []).map((x, i) => `<div class="item" data-i="${i}"><div class="item-h"><b>${i + 1}</b><span class="sp"></span><button data-act="up" title="위로">↑</button><button data-act="down" title="아래로">↓</button><button data-act="del" title="지우기">✕</button></div>${L.it.map(f => f === 'd' ? `<textarea data-f="${f}" rows="${s.layout === 'compare' ? 4 : 2}" placeholder="${TS.ITEM_LABEL[f]}${s.layout === 'compare' ? ' (한 줄에 하나씩)' : ''}">${E(x[f] || '')}</textarea>` : `<input data-f="${f}" value="${E(x[f] || '')}" placeholder="${TS.ITEM_LABEL[f]}">`).join('')}</div>`).join('')}</div>${(s.items || []).length < L.max ? '<button id="itemAdd" class="btn ghost wide">+ 항목 추가</button>' : ''}</div>`;
          if (L.build) h += `<label class="chk"><input type="checkbox" id="fBuild"${s.build !== false ? ' checked' : ''}> 클릭할 때마다 하나씩 등장</label>`;
        } else if (k === 'image') {
          const im = s.image || {};
          h += `<div class="f"><span>그림</span><div class="pick"><div class="pick-pic" style="${im.src ? `background-image:url('${im.src.replace(/'/g, '%27')}')` : ''}"></div><div class="pick-btn"><button class="btn ghost" data-pick="image">그림 고르기</button>${im.src ? '<button class="btn ghost" data-clear="image">없애기</button>' : ''}</div></div><input data-img="caption" value="${E(im.caption || '')}" placeholder="그림 설명 (선택)"></div>`;
        } else if (k === 'side') {
          h += `<label class="f"><span>그림 위치</span><select data-k="side"><option value="right"${s.side !== 'left' ? ' selected' : ''}>오른쪽</option><option value="left"${s.side === 'left' ? ' selected' : ''}>왼쪽</option></select></label>`;
        } else {
          const ph = k === 'body' && s.layout === 'table' ? '첫 줄은 머리글 · 칸은 | 로 나눕니다\n구분 | 내용 | 비고' : '';
          h += `<label class="f"><span>${TS.FIELD_LABEL[k]}</span>${ta(k, s[k], k === 'body' && s.layout === 'table' ? 8 : ROWS[k] || 1, ph)}${HINT[k] ? `<small>${HINT[k]}</small>` : ''}</label>`;
        }
      });
      p.innerHTML = h;
    } else if (tab === 'bg') {
      const b = s.bg || {};
      p.innerHTML = `<div class="f"><span>전면 배경</span><div class="pick big"><div class="pick-pic" style="${b.src ? `background-image:url('${b.src.replace(/'/g, '%27')}')` : ''}">${b.src ? '' : '<i>배경 그림 없음<br>(빛 · 격자 배경으로 나옵니다)</i>'}</div></div><div class="pick-btn"><button class="btn ghost" data-pick="bg">그림 고르기</button>${b.src ? '<button class="btn ghost" data-clear="bg">없애기</button>' : ''}</div></div>
        <label class="f"><span>배경 움직임</span><select data-bg="motion">${Object.entries(TS.MOTIONS).map(([k, v]) => `<option value="${k}"${(b.motion || 'zoom-in') === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="f"><span>글자가 읽히게 덮는 방식</span><select data-bg="tone">${Object.entries(TS.TONES).map(([k, v]) => `<option value="${k}"${(b.tone || L.tone) === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="f"><span>덮는 세기 <small id="dimV">${Math.round((b.dim == null ? L.dim : b.dim) * 100)}%</small></span><input type="range" min="0" max="95" step="1" data-bg="dim" value="${Math.round((b.dim == null ? L.dim : b.dim) * 100)}"></label>
        <label class="f"><span>그림에서 보여 줄 곳</span><select data-bg="pos">${[['center', '가운데'], ['top', '위'], ['bottom', '아래'], ['left', '왼쪽'], ['right', '오른쪽']].map(([k, v]) => `<option value="${k}"${(b.pos || 'center') === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        ${!b.src && deck.bg && deck.bg.src ? `<label class="chk"><input type="checkbox" id="bgOff"${b.off ? ' checked' : ''}> 이 장에는 교안 기본 배경도 깔지 않음</label>` : ''}
        <p class="muted small">그림을 고르지 않은 장에는 [교안 설정] 의 기본 배경이 어둡게 깔립니다.</p>`;
    } else {
      p.innerHTML = `<label class="f"><span>이 장의 시간</span><input data-k="time" value="${E(s.time || '')}" placeholder="예: 3분"></label>
        <label class="f grow"><span>발표 노트</span><textarea data-k="notes" rows="18" placeholder="말할 내용 · 출처 · 클릭 순서를 적어 둡니다. 발표자 화면(P)에 보입니다.">${E(s.notes || '')}</textarea></label>`;
    }
  }
  $('panel').addEventListener('input', e => {
    const t = e.target, s = S();
    if (t.dataset.k) { s[t.dataset.k] = t.value; changed(); }
    else if (t.dataset.f) { const i = +t.closest('.item').dataset.i; s.items[i][t.dataset.f] = t.value; changed(); }
    else if (t.dataset.img) { s.image = s.image || {}; s.image[t.dataset.img] = t.value; changed(); }
    else if (t.dataset.bg) { s.bg = s.bg || {}; s.bg[t.dataset.bg] = t.dataset.bg === 'dim' ? t.value / 100 : t.value; if (t.dataset.bg === 'dim') $('dimV').textContent = t.value + '%'; changed(); }
  });
  $('panel').addEventListener('change', e => {
    const t = e.target, s = S();
    if (t.id === 'fLayout') { s.layout = t.value; const L = TS.LAYOUTS[s.layout]; if (L.it && !(s.items || []).length) s.items = TS.blank(s.layout).items; if (L.max && (s.items || []).length > L.max) toast(`이 유형은 항목을 ${L.max}개까지만 보여 줍니다 (나머지는 그대로 보관)`); if (s.bg) { delete s.bg.tone; delete s.bg.dim; } changed(true); panel(); }
    else if (t.id === 'fBuild') { s.build = t.checked; changed(); }
    else if (t.id === 'bgOff') { s.bg = s.bg || {}; if (t.checked) s.bg.off = true; else delete s.bg.off; changed(); }
  });
  $('panel').addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return; const s = S();
    if (t.id === 'itemAdd') { const L = TS.LAYOUTS[s.layout]; const o = {}; L.it.forEach(k => o[k] = ''); o.t = '새 항목'; (s.items = s.items || []).push(o); changed(); panel(); }
    else if (t.dataset.act) { const i = +t.closest('.item').dataset.i; const a = s.items; if (t.dataset.act === 'del') a.splice(i, 1); else { const j = i + (t.dataset.act === 'up' ? -1 : 1); if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; } changed(); panel(); }
    else if (t.dataset.pick) pickImage(src => { const k = t.dataset.pick; s[k] = Object.assign({}, s[k], { src }); changed(); panel(); });
    else if (t.dataset.clear) { const k = t.dataset.clear; if (s[k]) delete s[k].src; changed(); panel(); }

  });
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.tab; panel(); });

  /* ---------- 그림 고르기 ---------- */
  const shrink = file => new Promise((res, rej) => { const im = new Image(); const u = URL.createObjectURL(file); im.onload = () => { const k = Math.min(1, 1920 / im.width); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', .86)); }; im.onerror = rej; im.src = u; });
  async function pickImage(done) {
    const sh = modal(`<h3>그림 고르기</h3><div class="row"><button id="upBtn" class="btn pri">내 그림 올리기</button><input id="upFile" type="file" accept="image/*" hidden><span class="muted">가로 1920 으로 줄여 넣습니다. 저장할 때 저장소에 올라갑니다.</span></div><div id="lib" class="lib"><p class="muted">불러오는 중…</p></div><div class="row end"><button class="btn ghost" id="mClose">닫기</button></div>`, 'wide');
    sh.querySelector('#mClose').onclick = closeModal; sh.querySelector('#upBtn').onclick = () => sh.querySelector('#upFile').click();
    sh.querySelector('#upFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const src = await shrink(f); closeModal(); done(src); } catch (err) { toast('그림을 읽지 못했습니다', true); } };
    const used = [...new Set(deck.slides.flatMap(s => [s.bg && s.bg.src, s.image && s.image.src]).filter(x => x && !TS.isVideo(x)))];
    const lib = await TSStore.media(); const all = [...new Set([...used, ...lib.map(x => x.src)])];
    const box = sh.querySelector('#lib'); if (!box) return;
    box.innerHTML = all.length ? all.map(src => `<button class="lib-item" data-src="${E(src)}" style="background-image:url('${src.replace(/'/g, '%27')}')"></button>`).join('') : '<p class="muted">아직 그림이 없습니다. 내 그림을 올려 주세요.</p>';
    box.onclick = e => { const b = e.target.closest('.lib-item'); if (b) { closeModal(); done(b.dataset.src); } };
  }

  /* ---------- 장 추가 · 복제 · 삭제 · 순서 ---------- */
  $('btAdd').onclick = () => {
    const sh = modal(`<h3>장 추가</h3><p class="muted">유형을 고르면 지금 장 바로 뒤에 들어갑니다.</p><div class="lay-grid">${Object.entries(TS.LAYOUTS).map(([k, v]) => `<button class="lay-item" data-l="${k}"><div class="pic"></div><span>${v.name}</span></button>`).join('')}</div><div class="row end"><button class="btn ghost" id="mClose">닫기</button></div>`, 'wide');
    sh.querySelector('#mClose').onclick = closeModal;
    sh.querySelectorAll('.lay-item').forEach(b => { TS.thumb(deck, SAMPLE(b.dataset.l), 0, 1, b.querySelector('.pic')); b.onclick = () => { const s = TS.blank(b.dataset.l); deck.slides.splice(cur + 1, 0, s); cur++; closeModal(); changed(true); panel(); }; });
  };
  const SAMPLE = l => Object.assign(TS.blank(l), { kicker: 'KICKER', title: l === 'quote' ? '기억에 남길 한 문장' : (TS.LAYOUTS[l].name + ' *제목*'), subtitle: '부제 · 설명', k: '01', body: l === 'table' ? '구분 | 내용 | 비고\n가 | 내용 | -\n나 | 내용 | -' : '본문', items: (TS.blank(l).items || []).map((x, i) => Object.assign(x, { k: l === 'agenda' ? '10분' : 'A' + (i + 1), v: String((i + 1) * 12), u: '건', d: '설명' })) });
  $('btDup').onclick = () => { const c = JSON.parse(JSON.stringify(S())); c.id = TS.uid(); deck.slides.splice(cur + 1, 0, c); cur++; changed(true); panel(); };
  $('btDel').onclick = () => { if (deck.slides.length < 2) { toast('마지막 한 장은 지울 수 없습니다'); return; } deck.slides.splice(cur, 1); cur = Math.min(cur, deck.slides.length - 1); changed(true); panel(); toast('지웠습니다 — [되돌리기] 로 되살릴 수 있습니다'); };
  const move = d => { const j = cur + d; if (j < 0 || j >= deck.slides.length) return; const a = deck.slides;[a[cur], a[j]] = [a[j], a[cur]]; cur = j; changed(true); };
  $('btUp').onclick = () => move(-1); $('btDown').onclick = () => move(1);
  $('btMotion').onclick = () => {
    const host = $('view'); const el = view(); host.classList.add('ts-live'); void el.offsetWidth; el.classList.add('is-active');
    setTimeout(() => TS.countUp({ querySelectorAll: s => [...el.querySelectorAll(s)].filter(x => !x.closest('[data-step]')) }), 450);
    const st = [...el.querySelectorAll('[data-step]')]; st.forEach((x, i) => setTimeout(() => { x.classList.add('on'); TS.countUp(x); }, 1300 + i * 650));
    clearTimeout(host._mt); host._mt = setTimeout(() => { host.classList.remove('ts-live'); view(); }, 9000 + st.length * 650);
  };

  /* ---------- 교안 설정 · 내보내기 ---------- */
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
      <div class="row"><button class="btn ghost" id="xPdf">PDF 로 인쇄</button><button class="btn ghost" id="xJson">파일로 내보내기</button><button class="btn ghost" id="xImp">파일에서 가져오기</button><input id="xFile" type="file" accept=".json,application/json" hidden></div>
      <div class="row end"><button class="btn pri" id="mOk">확인</button></div>`);
    const set = (k, v) => { if ((deck[k] || '') !== v) { if (v === '' || v === 0) delete deck[k]; else deck[k] = v; changed(true); } };
    sh.querySelector('#sTheme').onchange = e => set('theme', e.target.value); sh.querySelector('#sTr').onchange = e => set('transition', e.target.value);
    sh.querySelector('#mOk').onclick = () => {
      const a = sh.querySelector('#sAccent').value.trim(); set('accent', /^#[0-9a-f]{3,8}$/i.test(a) ? a : '');
      set('org', sh.querySelector('#sOrg').value.trim()); set('audience', sh.querySelector('#sAud').value.trim()); set('minutes', +sh.querySelector('#sMin').value || 0); set('footer', sh.querySelector('#sFoot').value.trim()); closeModal();
    };
    sh.querySelector('#sBg').onclick = () => pickImage(src => { deck.bg = Object.assign({ motion: 'zoom-in', dim: .86 }, deck.bg, { src }); changed(true); panel(); toast('기본 배경을 바꿨습니다'); });
    const bx = sh.querySelector('#sBgX'); if (bx) bx.onclick = () => { delete deck.bg; closeModal(); changed(true); panel(); };
    sh.querySelector('#xPdf').onclick = async () => { await TSStore.draftPut(deck); window.open(`play.html?deck=${encodeURIComponent(id)}&print=1`, '_blank'); };
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
    try { await TSStore.save(deck, t => { $('state').textContent = t; }); dirty = false; saved = JSON.stringify(deck); state(); view(); panel(); toast('저장했습니다 — 다른 기기에는 1~2분 뒤(배포 후) 보입니다'); }
    catch (e) { state(); if (e.code === 'notoken' || e.status === 401) { if (e.status === 401) TSStore.setToken(''); askToken(save); } else toast(e.message || '저장하지 못했습니다', true); }
    saving = false; $('btSave').disabled = false;
  }
  $('btSave').onclick = save; $('btUndo').onclick = undo;
  const play = async () => { await TSStore.draftPut(deck); location.href = `play.html?deck=${encodeURIComponent(id)}&from=studio#${cur + 1}`; };
  $('btPlay').onclick = play;
  $('deckTitle').value = deck.title || ''; $('deckTitle').oninput = e => { deck.title = e.target.value; document.title = deck.title + ' — TAESTEP 편집'; changed(); };
  addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || ''));
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); undo(); }
    else if (e.key === 'F5') { e.preventDefault(); play(); }
    else if (e.key === 'Escape' && !$('modal').hidden) closeModal();
    else if (!typing && (e.key === 'PageDown' || e.key === 'ArrowDown')) { e.preventDefault(); select(cur + 1); }
    else if (!typing && (e.key === 'PageUp' || e.key === 'ArrowUp')) { e.preventDefault(); select(cur - 1); }
  });
  addEventListener('beforeunload', () => { if (dirty) TSStore.draftPut(deck); });
  document.title = (deck.title || '') + ' — TAESTEP 편집';
  const d0 = await TSStore.draftGet(id); dirty = !!d0 && !(await TSStore.repoDeck(id).then(r => r && (r.modified || '') >= (d0.modified || '')));
  state(); rail(); view(); panel();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { rail(); view(); });
})();
