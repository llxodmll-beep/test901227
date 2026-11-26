/* TAESTEP 첫 화면 — 내 교안 목록 · 새 교안 */
'use strict';
(async () => {
  const $ = id => document.getElementById(id); const E = TS.E;
  const modal = html => { const m = $('modal'); m.innerHTML = `<div class="sheet">${html}</div>`; m.hidden = false; m.onclick = e => { if (e.target === m) close(); }; return m.firstChild; };
  const close = () => { $('modal').hidden = true; $('modal').innerHTML = ''; };
  let toastT = 0; const toast = (t, bad, ms) => { const o = $('toast'); o.textContent = t; o.className = 'toast' + (bad ? ' bad' : ''); o.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { o.hidden = true; }, ms || 3600); };
  const when = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : `${d.getFullYear()}.${TS.pad(d.getMonth() + 1)}.${TS.pad(d.getDate())}`; };

  async function draw() {
    const items = await TSStore.list(); const box = $('decks');
    $('count').textContent = items.length ? `${items.length}개` : '';
    if (!items.length) { box.innerHTML = '<p class="muted">아직 교안이 없습니다. [+ 새 교안] 으로 시작하세요.</p>'; return; }
    box.innerHTML = items.map(x => `<article class="deck" data-id="${E(x.id)}"><a class="pic" href="play.html?deck=${encodeURIComponent(x.id)}" title="발표"></a>
      <div class="info"><h3>${E(x.title)}</h3><p>${[x.audience, x.minutes ? x.minutes + '분' : '', x.slides + '장', when(x.modified)].filter(Boolean).map(E).join(' · ')}${x.where !== 'repo' ? ` <span class="tag">${x.where === 'device' ? '저장 안 됨 · 이 기기에만 있음' : '저장 안 한 변경 있음'}</span>` : ''}</p>
      <div class="row"><a class="btn pri" href="play.html?deck=${encodeURIComponent(x.id)}">▶ 발표</a><a class="btn ${x.where !== 'repo' ? 'pri' : 'ghost'}" href="studio.html?deck=${encodeURIComponent(x.id)}">${x.where !== 'repo' ? '이어서 편집' : '편집'}</a><button class="btn ghost" data-act="export">내보내기</button><button class="btn ghost" data-act="copy">복제</button>${x.where === 'device' ? '<button class="btn ghost danger" data-act="del">지우기</button>' : ''}</div></div></article>`).join('');
    for (const a of box.querySelectorAll('.deck')) { const d = await TSStore.load(a.dataset.id); if (d && d.slides && d.slides[0]) TS.thumb(d, d.slides[0], 0, d.slides.length, a.querySelector('.pic')); }
  }
  $('decks').addEventListener('click', async e => {
    const b = e.target.closest('button[data-act]'); if (!b) return; const id = b.closest('.deck').dataset.id;
    if (b.dataset.act === 'export') { const d = await TSStore.load(id); if (!d) return;
      const sh = modal(`<h3>내보내기 — ${E(d.title || id)}</h3><div class="xlist">${TSExport.ITEMS.map(([k, t, s]) => `<button data-x="${k}"><b>${t}</b><small>${s}</small></button>`).join('')}</div><p class="muted small">이 기기에 저장 안 한 작업본이 있으면 그 내용으로 내보냅니다.</p><div class="row end"><button class="btn ghost" id="mClose">닫기</button></div>`);
      sh.querySelector('#mClose').onclick = close;
      sh.querySelector('.xlist').onclick = async ev => { const x = ev.target.closest('[data-x]'); if (!x) return; close(); const k = x.dataset.x; try { toast(TSExport.ITEMS.find(i => i[0] === k)[1] + ' 만드는 중…', false, 120000); await TSExport.run(k, d, t => toast(t, false, 120000)); toast(TSExport.DONE[k], false, 6000); } catch (err) { toast('내보내지 못했습니다: ' + (err.message || err), true, 9000); } };
      return; }
    if (b.dataset.act === 'copy') { const d = await TSStore.load(id); if (!d) return; const c = JSON.parse(JSON.stringify(d)); c.title = d.title + ' 사본'; c.id = await freeId(c.title); c.modified = new Date().toISOString(); delete c._synced; delete c._base; await TSStore.draftPut(c); location.href = 'studio.html?deck=' + encodeURIComponent(c.id); }
    else if (b.dataset.act === 'del') { if (!confirm('이 기기에만 있는 교안입니다. 지우면 되살릴 수 없습니다. 지울까요?')) return; await TSStore.draftDel(id); draw(); }
  });
  async function freeId(title) { const have = new Set((await TSStore.list()).map(x => x.id)); let id = TSStore.fileId(title), n = 2; while (have.has(id)) id = TSStore.fileId(title) + ' ' + n++; return id; }

  /* 새 교안: 강의 한 편의 기본 뼈대(표지 → 순서 → 장 구분 → 내용 → 정리)를 깔아 준다 */
  function skeleton(title, o) {
    const s = (layout, f) => Object.assign(TS.blank(layout), f);
    return {
      app: 'taestep', v: 1, title, theme: o.theme, transition: 'fade', org: o.org, audience: o.audience, minutes: o.minutes, created: new Date().toISOString(), modified: new Date().toISOString(),
      slides: [
        s('cover', { kicker: 'TRAINING BRIEFING', title, subtitle: '이 교육이 끝나면 무엇이 달라지는지 한 줄로', meta: [o.audience && '대상: ' + o.audience, o.minutes && '시간: ' + o.minutes + '분', o.presenter && '교수요원: ' + o.presenter].filter(Boolean).join('\n') }),
        s('statement', { kicker: 'OPENING', title: '교육생이 스스로 답을 떠올리게 하는 *첫 질문*', subtitle: '30초 동안 생각할 시간을 줍니다' }),
        s('agenda', { kicker: 'TODAY', title: '오늘의 순서', items: [{ k: '01', t: '첫째 주제', d: '' }, { k: '02', t: '둘째 주제', d: '' }, { k: '03', t: '셋째 주제', d: '' }] }),
        s('section', { k: '01', title: '첫째 주제', subtitle: '이 장에서 답할 질문' }),
        s('bullets', { kicker: 'CH.01', title: '핵심 내용 세 가지' }),
        s('stat', { kicker: 'CH.01', title: '숫자로 보는 현황', source: '출처 · (확인 필요)' }),
        s('section', { k: '02', title: '둘째 주제', subtitle: '이 장에서 답할 질문' }),
        s('steps', { kicker: 'CH.02', title: '절차는 이 순서로 진행합니다' }),
        s('compare', { kicker: 'CH.02', title: '무엇이 다른가', items: [{ k: 'BEFORE', t: '기존', d: '첫째\n둘째' }, { k: 'AFTER', t: '개선', d: '첫째\n둘째' }] }),
        s('closing', { kicker: 'KEY TAKEAWAYS', title: '내일 현장에서 *할 일*', subtitle: '오늘 내용을 행동으로 정리', items: [{ t: '첫째 행동' }, { t: '둘째 행동' }, { t: '셋째 행동' }], meta: '감사합니다 · 질의응답' }),
      ],
    };
  }
  $('btNew').onclick = () => {
    const sh = modal(`<h3>새 교안</h3><label class="f"><span>제목</span><input id="nTitle" placeholder="예: 소방 드론 활용 전략" autofocus></label>
      <div class="grid2"><label class="f"><span>대상</span><input id="nAud" placeholder="예: 현장지휘관(소방령)"></label><label class="f"><span>강의 시간(분)</span><input id="nMin" type="number" min="0" placeholder="60"></label>
      <label class="f"><span>교수요원</span><input id="nWho" value="김태의"></label><label class="f"><span>기관 이름</span><input id="nOrg" value="인천소방학교 지휘역량강화센터"></label></div>
      <label class="f"><span>테마</span><select id="nTheme">${Object.entries(TS.THEMES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <p class="muted small">강의 한 편의 기본 뼈대 10장이 깔립니다. 내용 구성부터 그림·출처 확인까지 맡기려면 Claude 에게 “TAESTEP 으로 ○○ 교안 만들어 줘”라고 요청하세요.</p>
      <div class="row end"><button class="btn ghost" id="mClose">취소</button><button class="btn pri" id="mOk">만들기</button></div>`);
    sh.querySelector('#mClose').onclick = close;
    sh.querySelector('#mOk').onclick = async () => {
      const title = sh.querySelector('#nTitle').value.trim(); if (!title) { sh.querySelector('#nTitle').focus(); return; }
      const d = skeleton(title, { theme: sh.querySelector('#nTheme').value, audience: sh.querySelector('#nAud').value.trim(), minutes: +sh.querySelector('#nMin').value || 0, presenter: sh.querySelector('#nWho').value.trim(), org: sh.querySelector('#nOrg').value.trim() });
      d.id = await freeId(title); await TSStore.draftPut(d); location.href = 'studio.html?deck=' + encodeURIComponent(d.id);
    };
  };
  $('btGh').onclick = () => {
    const c = TSStore.repo();
    const sh = modal(`<h3>GitHub 연결</h3><p class="muted">편집한 교안은 GitHub 저장소 <b>${E(c.owner)}/${E(c.repo)}</b> 에 저장됩니다. ${c.token ? '이 기기는 <b>연결되어 있습니다</b>.' : '이 기기는 아직 연결되지 않았습니다.'}</p>
      <label class="f"><span>토큰 ${c.token ? '<small>바꿀 때만 입력</small>' : ''}</span><input id="tk" type="password" placeholder="github_pat_…" autocomplete="off"></label>
      <p class="muted small">만드는 곳: github.com/settings/personal-access-tokens/new → 저장소 ${E(c.repo)} 선택 → Contents: Read and write. 토큰은 이 기기에만 보관됩니다.</p>
      <div class="row end">${c.token ? '<button class="btn ghost danger" id="mOut">연결 해제</button>' : ''}<button class="btn ghost" id="mClose">닫기</button><button class="btn pri" id="mOk">연결</button></div>`);
    sh.querySelector('#mClose').onclick = close;
    sh.querySelector('#mOk').onclick = () => { const v = sh.querySelector('#tk').value.trim(); if (v) TSStore.setToken(v); close(); mark(); };
    const o = sh.querySelector('#mOut'); if (o) o.onclick = () => { TSStore.setToken(''); close(); mark(); };
  };
  const mark = () => { const on = !!TSStore.repo().token; $('btGh').textContent = on ? 'GitHub 연결됨' : 'GitHub 연결'; $('btGh').classList.toggle('ok', on); };
  mark(); draw();

  /* 앱으로 설치 */
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
  let prompt = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); prompt = e; $('btInstall').hidden = false; });
  $('btInstall').onclick = async () => { if (!prompt) return; prompt.prompt(); await prompt.userChoice.catch(() => { }); prompt = null; $('btInstall').hidden = true; };
})();
