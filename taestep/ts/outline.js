/* TAESTEP 개요 → 장
   # 제목        → 표지 (두 번째 # 부터는 장 구분)
   ## 장 제목    → 한 장
   - 항목        → 항목 ("- 제목: 설명" 이나 한 칸 들여 쓴 줄은 설명)
   > 노트        → 발표 노트
   | 가 | 나 |   → 표
   그 밖의 줄    → 부제 · 설명
   ("09:00 개회" 처럼 시각의 쌍점은 제목 · 설명으로 나누지 않는다)
   항목의 모양을 보고 장 유형을 고른다(숫자 → 숫자, 절차 → 단계, 둘 비교 → 비교, 설명 있는 4개 이하 → 카드 …). */
'use strict';
const TSOutline = (() => {
  const RX = { steps: /순서|절차|단계|과정|프로세스|흐름|방법/, agenda: /일정|시간표|목차|차례|진행/, compare: /비교|차이|vs|대비|전\s*·?\s*후/i, closing: /정리|요약|마무리|결론|핵심/ };
  function parse(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n'); const slides = []; let cur = null, sec = 0, deckTitle = '';
    const open = (layout, title) => { cur = { layout, title, subs: [], items: [], notes: [], rows: [] }; slides.push(cur); return cur; };
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, ''); const t = line.trim(); if (!t || /^-{3,}$/.test(t)) continue; let m;
      if ((m = t.match(/^#\s+(.+)/))) { if (!slides.length) { deckTitle = m[1]; open('cover', m[1]); } else { sec++; const c = open('section', m[1]); c.k = String(sec).padStart(2, '0'); } continue; }
      if ((m = t.match(/^#{2,6}\s+(.+)/))) { open('', m[1]); continue; }
      if (!cur) open('', t.replace(/^[-*>]\s*/, ''));
      else if ((m = t.match(/^>\s?(.*)/))) cur.notes.push(m[1]);
      else if (/^\|.*\|$/.test(t)) { if (!/^\|[\s:|-]+\|$/.test(t)) cur.rows.push(t.slice(1, -1).split('|').map(x => x.trim())); }
      else if ((m = line.match(/^(\s*)(?:[-*•]|\d+[.)])\s+(.+)/))) { if (m[1].length >= 2 && cur.items.length) { const it = cur.items[cur.items.length - 1]; it.d = it.d ? it.d + '\n' + m[2] : m[2]; } else { const p = m[2].match(/^(.{1,40}?)\s*(?::(?!\d)|：| — | - )\s*(.+)$/); cur.items.push(p ? { t: p[1], d: p[2] } : { t: m[2], d: '' }); } }
      else cur.subs.push(t);
    }
    const out = [];
    slides.forEach((c, idx) => {
      const base = () => Object.assign(TS.blank('free'), { title: c.title, notes: c.notes.join('\n') }); const sub = c.subs.join('\n'); const n = c.items.length;
      const mk = (layout, more) => { const s = Object.assign(base(), { layout }, more || {}); delete s.els; out.push(s); return s; };
      if (c.layout === 'cover') return mk('cover', { subtitle: c.subs[0] || '', meta: c.subs.slice(1).join('\n') });
      if (c.layout === 'section') return mk('section', { k: c.k, subtitle: sub });
      if (c.rows.length) return mk('table', { subtitle: sub, body: c.rows.map(r => r.join(' | ')).join('\n') });
      if (!n) return mk(/^["“”']/.test(c.title) ? 'quote' : 'statement', /^["“”']/.test(c.title) ? { title: c.title.replace(/^["“”']|["“”']$/g, ''), subtitle: sub } : { subtitle: sub });
      const nums = c.items.map(x => String(x.d || '').match(/^([\d,]+(?:\.\d+)?)\s*([^\d\s].{0,4})?$/));
      if (n <= 4 && nums.every(Boolean)) return mk('stat', { subtitle: sub, items: c.items.map((x, i) => ({ k: String(i + 1).padStart(2, '0'), v: nums[i][1], u: nums[i][2] || '', t: x.t, d: '' })) });
      if (idx === slides.length - 1 && RX.closing.test(c.title) && n <= 4) return mk('closing', { subtitle: sub, items: c.items.map(x => ({ t: x.t + (x.d ? ' — ' + x.d.replace(/\n/g, ' ') : '') })) });
      if (n === 2 && (RX.compare.test(c.title) || c.items.every(x => /\n/.test(x.d)))) return mk('compare', { subtitle: sub, items: c.items.map(x => ({ k: '', t: x.t, d: x.d })) });
      if (RX.steps.test(c.title) && n <= 5) return mk('steps', { subtitle: sub, items: c.items.map(x => ({ t: x.t, d: x.d.replace(/\n/g, ' ') })) });
      if (RX.agenda.test(c.title) && n <= 6) return mk('agenda', { subtitle: sub, items: c.items.map((x, i) => { const tm = x.t.match(/^(\d{1,2}:\d{2}|\d+\s*분|\d+\s*교시)\s+(.+)$/); return { k: tm ? tm[1] : String(i + 1).padStart(2, '0'), t: tm ? tm[2] : x.t, d: x.d.replace(/\n/g, ' ') }; }) });
      if (n <= 4 && c.items.filter(x => x.d).length >= Math.ceil(n / 2)) return mk('cards', { subtitle: sub, items: c.items.map((x, i) => ({ k: String(i + 1).padStart(2, '0'), t: x.t, d: x.d.replace(/\n/g, ' ') })) });
      for (let i = 0; i < n; i += 5) mk('bullets', { title: c.title + (i ? ' (계속)' : ''), subtitle: i ? '' : sub, items: c.items.slice(i, i + 5).map(x => ({ t: x.t, d: x.d.replace(/\n/g, ' ') })) }); // 항목이 5개를 넘으면 장을 나눈다
    });
    return { title: deckTitle, slides: out };
  }
  const SAMPLE = '# 교안 제목\n이 교육이 끝나면 달라지는 것 한 줄\n\n## 왜 필요한가?\n> 30초 동안 질문을 던지고 기다린다\n\n## 오늘의 순서\n- 첫째 주제\n- 둘째 주제\n- 셋째 주제\n\n# 첫째 주제\n\n## 핵심 세 가지\n- 하나: 설명을 적습니다\n- 둘: 설명을 적습니다\n- 셋: 설명을 적습니다\n\n## 숫자로 보는 현황\n- 보유 대수: 16대\n- 자격 인원: 156명\n\n## 진행 절차\n- 준비\n- 실시\n- 평가\n\n## 정리\n- 내일 할 일 하나\n- 내일 할 일 둘';
  return { parse, SAMPLE };
})();
