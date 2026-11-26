/* TAESTEP 내보내기 — 편집 화면과 첫 화면이 함께 쓴다
   PPTX · PDF(슬라이드만) · PDF 유인물(노트 포함) · 단독 HTML(한 파일, 서버 없이 발표) · 교안 파일(JSON) */
'use strict';
const TSExport = (() => {
  const ITEMS = [
    ['pptx', 'PowerPoint (PPTX)', '글 · 표 · 사각형/원/선은 PowerPoint 에서 고칠 수 있습니다. 배경 · 자른 그림 · 아이콘 · 차트는 그림으로 들어가고, 모션은 빠집니다.'],
    ['pdf', 'PDF (슬라이드만)', '한 장이 한 쪽. 인쇄 창이 열리면 대상을 "PDF로 저장"으로 고릅니다.'],
    ['handout', 'PDF 유인물 (노트 포함)', 'A4 세로 한 쪽에 슬라이드와 발표 노트를 함께. 강의 준비 · 배포용.'],
    ['html', '단독 HTML (한 파일)', '그림 · 글꼴까지 한 파일에 담습니다. USB 로 옮겨 인터넷 없이 더블클릭으로 발표(모션 포함). 영상 배경은 담기지 않습니다.'],
    ['json', '교안 파일 (JSON)', 'TAESTEP 에서 다시 여는 원본. 보관 · 다른 기기로 옮길 때.'],
  ];
  const loadScript = src => new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('필요한 파일을 받지 못했습니다 (' + src + ')')); document.head.appendChild(s); });
  const down = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
  const text = async u => { const r = await fetch(u, { cache: 'no-cache' }); if (!r.ok) throw new Error('앱 파일을 받지 못했습니다 (' + u + ')'); return r.text(); };
  const dataUrl = async u => { if (/^data:/.test(u)) return u; const r = await fetch(u); if (!r.ok) throw new Error('그림을 받지 못했습니다 (' + u + ')'); const b = await r.blob(); return new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = rej; f.readAsDataURL(b); }); };
  const name = deck => TSStore.fileId(deck.id || deck.title);
  const clean = deck => { const d = JSON.parse(JSON.stringify(deck)); delete d._base; delete d._synced; return d; };

  async function pptx(deck, say) { await loadScript('ts/vendor/pptxgen.bundle.js'); await loadScript('ts/pptx.js'); await TSPptx.save(clean(deck), say); }
  /* 인쇄 화면은 이 기기의 작업본을 읽으므로, 먼저 지금 화면을 작업본으로 남긴 뒤에 연다 */
  function print(deck, notes) { const w = window.open(`play.html?deck=${encodeURIComponent(deck.id)}&print=${notes ? 'notes' : '1'}`, '_blank'); if (!w) throw new Error('팝업이 막혀 인쇄 창을 열지 못했습니다 — 주소창의 팝업 차단을 풀어 주세요'); }
  const json = deck => down(new Blob([JSON.stringify(clean(deck), null, 1)], { type: 'application/json' }), name(deck) + '.taestep.json');
  async function html(deck, say) {
    const d = clean(deck); const holders = []; if (d.bg) holders.push(d.bg);
    d.slides.forEach(s => { if (s.bg) holders.push(s.bg); if (s.image) holders.push(s.image); (s.els || []).forEach(e => { if (e.type === 'image') holders.push(e); }); });
    const srcs = [...new Set(holders.map(h => h.src).filter(x => x && !TS.isVideo(x)))]; const map = {}; let n = 0;
    for (const s of srcs) { if (say) say(`단독 HTML 을 만드는 중… 그림 ${++n} / ${srcs.length}`); map[s] = await dataUrl(s); }
    holders.forEach(h => { if (map[h.src]) h.src = map[h.src]; });
    if (say) say('단독 HTML 을 만드는 중… 앱 파일');
    const [css1, css2, fontCss, icons, engine, play] = await Promise.all(['ts/engine.css', 'ts/app.css', 'ts/fonts.css', 'ts/icons.js', 'ts/engine.js', 'ts/play.js'].map(text));
    const font = await dataUrl('ts/fonts/PretendardVariable.woff2'); const esc = s => s.replace(/<\/(script|style)/gi, '<\\/$1');
    const page = `<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${TS.E(d.title || '')}</title>\n<style>${fontCss.replace(/url\('fonts\/PretendardVariable\.woff2'\)/, `url('${font}')`)}\n${css1}\n${css2}</style></head>\n<body class="play standalone">\n<div id="wrap"><div id="stage" class="ts-stage ts-live"></div></div>\n<div id="bar" class="play-bar"><button id="btPrev">◀</button><span class="pg"><b id="pgNow">1</b> / <span id="pgAll">1</span></span><button id="btNext">▶</button><i></i><button id="btGrid">전체 장</button><button id="btNotes">노트</button><button id="btPres" hidden>발표자 화면</button><button id="btFull">전체 화면</button><button id="btExit" hidden>나가기</button></div>\n<aside id="notes" class="play-notes" hidden><h4>발표 노트</h4><div id="notesText"></div></aside>\n<div id="overview" class="play-ov" hidden><div class="ov-head"><b>전체 장</b><button id="ovClose">닫기 (Esc)</button></div><div class="ov-grid"></div></div>\n<script>window.TS_DECK = ${esc(JSON.stringify(d))};<\/script>\n<script>${esc(icons)}<\/script>\n<script>${esc(engine)}<\/script>\n<script>${esc(play)}<\/script>\n</body></html>`;
    down(new Blob([page], { type: 'text/html' }), name(deck) + '.html');
  }
  /* kind 하나를 실행. say = 진행 알림 */
  async function run(kind, deck, say) {
    if (kind === 'pptx') return pptx(deck, say); if (kind === 'html') return html(deck, say); if (kind === 'json') return json(deck);
    if (kind === 'pdf' || kind === 'handout') return print(deck, kind === 'handout');
  }
  const DONE = { pptx: 'PPTX 를 내려받았습니다', html: '단독 HTML 을 내려받았습니다 — 더블클릭하면 바로 발표 화면이 열립니다', json: '교안 파일을 내려받았습니다', pdf: '인쇄 창을 열었습니다 — 대상을 "PDF로 저장"으로 고르세요', handout: '유인물 인쇄 창을 열었습니다 — 대상을 "PDF로 저장"으로 고르세요' };
  return { ITEMS, run, DONE };
})();
