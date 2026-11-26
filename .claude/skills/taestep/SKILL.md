---
name: taestep
description: TAESTEP(김태의 전용 교안 앱)으로 교안(슬라이드)을 만들거나 고친다. 사용자가 "TAESTEP 으로 ○○ 교안 만들어 줘", "새 교안/교육안/슬라이드 만들어 줘", "TAESTEP 교안 고쳐 줘", "TAESTEP 에 기능 넣어 줘"라고 할 때 사용. 기존 DPV 교안(decks/*.json · gyoan.html)을 고치는 일에는 쓰지 않는다.
---

# TAESTEP — 교안 만들기

앱: `taestep/` (첫 화면 `index.html` · 편집 `studio.html` · 발표 `play.html`). 배포 주소 `https://llxodmll-beep.github.io/test901227/taestep/`.
DPV(`app/` · `decks/`)와는 따로 만든 앱이다. 코드를 서로 섞지 않는다.

## 1. 교안 파일
- `taestep/decks/<이름>.json` + `taestep/decks/index.json` 의 `items` 에 { id(=파일 이름), title, subtitle, audience, minutes, slides(장 수), theme, modified } 를 넣는다.
- 그림은 `taestep/media/` 에 두고 `taestep/media/index.json` 의 `items` 에 { src, name } 을 더한다(편집 화면의 그림 고르기에 나옴).
- 웹 편집기에서도 저장된다(`TAESTEP 교안 저장: …` 커밋). 고치기 전에 반드시 최신 `main` 에서 시작한다.

```json
{ "app": "taestep", "v": 1, "id": "파일 이름", "title": "", "audience": "", "minutes": 60,
  "theme": "paper(기본 · 밝음) | midnight | ember", "transition": "fade | slide | zoom | none", "accent": "#색(선택)",
  "org": "표지 왼쪽 위 기관 이름", "footer": "아래 줄 문구(선택)",
  "bg": { "src": "media/….jpg", "motion": "zoom-in", "dim": 0.86 },
  "slides": [ { "id": "", "layout": "", "kicker": "", "title": "", "subtitle": "", "body": "", "items": [], "image": {}, "bg": {}, "source": "", "notes": "", "time": "", "build": true } ] }
```
- 글 안의 `*강조*` 는 강조색, 줄바꿈(`\n`)은 그대로 줄바꿈. HTML 은 쓰지 않는다.
- `deck.bg` = 그림을 고르지 않은 장 전체에 어둡게 깔리는 기본 배경. 장의 `bg.off: true` 면 그 장에는 깔지 않는다.
- 장의 `bg`: { src, motion(zoom-in · zoom-out · pan-left · pan-right · rise · none), tone(left · right · bottom · full · none), dim(0~0.95), pos }. src 가 `.mp4/.webm` 이면 영상 배경.

## 2. 장 유형 (layout) — `taestep/ts/engine.js` 의 `LAYOUTS` 가 기준
| layout | 쓰임 | 칸 |
|---|---|---|
| cover | 표지 | kicker, title, subtitle, meta(한 줄에 하나 · `라벨: 값`) |
| section | 장 구분 | k(번호), kicker, title, subtitle |
| statement | 한 문장(질문 · 핵심 메시지) | kicker, title, subtitle |
| bullets | 항목 최대 5 | items[{t,d}] |
| stat | 숫자 최대 4 (0에서 올라감) | items[{k,v,u,t,d}] — v 는 숫자만 |
| cards | 카드 최대 4 | items[{k,t,d}] |
| split | 글 + 그림 | body, items[{t,d}], image{src,caption}, side(left·right) |
| steps | 단계(계단) 최대 5 | items[{t,d}] |
| compare | 비교 2개 | items[{k,t,d}] — d 는 한 줄에 하나 |
| agenda | 진행 순서 최대 6 | items[{k(시간·번호),t,d}] |
| table | 표 | body — 첫 줄 머리글, 칸은 `|` |
| quote | 인용 | title, subtitle(출처) |
| photo | 사진 전면 | kicker, title, subtitle |
| closing | 마무리 | kicker, title, subtitle, items[{t}] 최대 4, meta |
- bullets · stat · cards · steps 는 클릭마다 하나씩 나온다(`build: false` 면 한 번에).
- 내용이 넘치면 엔진이 본문을 줄인다. 줄어들지 않게 한 장에는 한 가지 메시지만, 항목 설명은 한두 줄로.

## 2-1. 자유 요소 (els) — 어느 장에나 얹는 글상자 · 그림 · 도형 · 선 · 아이콘 · 표 · 차트
- 장의 `els: [ … ]` 에 넣는다. 좌표는 1920×1080 기준 { id, type, x, y, w, h, rot?, lock?, hide?, g?(묶음) }. `layout: "free"` 는 요소만 있는 빈 장.
- 색은 테마 이름표(`title · fg · muted · accent · ink · bg2 · card · line`)를 쓴다(테마를 바꾸면 함께 바뀜). 꼭 필요할 때만 `#색`.
- text: { html, fs, color, align, lh, weight, valign, font(body·mono), fill?, pad?, radius? } — html 은 b · i · u · mark · span(style) · br · ul/ol/li 만.
- image: { src, zoom(1~), px, py(보여 줄 곳 0~100), mask(none·round·circle·hexagon·arch·diamond), radius, br, ct, sat, gray, stroke, sw, shadow }
- shape: { shape(rect·round·ellipse·card·triangle·diamond·hexagon·pentagon·star·arrow·chevron·speech), fill, stroke, sw, radius, dash, op, html(도형 안 글), fs, color }
- line: { stroke, sw, arrow(none·end·both), dash, flip, rev } · icon: { name(`ts/icons.js` 의 이름), color, sw }
- table: { rows[[칸]], head, stripe, plain, fs } · chart: { kind(bar·hbar·line·pie·donut), data[[항목, 값]], unit, values, pct, fs, color }
- 모션(요소마다): { step(0 = 장이 열릴 때, 1~ = 그 클릭에 등장), anim(rise · fade · drop · left · right · zoom · pop · wipe · blur · flip · none), dur(초), delay(초), emph(pulse · shake · glow · blink), emphAt(강조할 클릭 · 없으면 등장 직후), exit(사라질 클릭), exitAnim(fade · fall · zoom · none) }. 클릭 번호는 1부터 빈 번호 없이.
- 장 넘김: 교안 `transition` 이 기본, 장의 `tr` 이 그 장으로 넘어올 때의 효과(fade · slide · up · cover · wipe · zoom · blur · morph · none). morph 는 앞 장과 id 가 같은 요소를 이어 움직인다(장을 복제해서 만들면 id 가 같다).
- 배경 움직임: 장의 `bg.motion`(zoom-in · zoom-out · pan-left · pan-right · rise · fall · none) + `bg.speed`(1 = 기본, 2 = 두 배 빠르게) + `bg.amt`(움직임 크기).
- 장 유형으로 만든 장을 요소로 풀 때는 `TS.explode(deck, slide, i, total)` (편집 화면의 [요소로 풀기], PPTX 내보내기가 같이 씀).
- 배경 · 글+그림 장의 그림도 `zoom · px · py` 로 자른다.

## 3. 품질 규칙 (어떤 주제든 같은 수준이 나오게)
- 흐름: 표지 → 첫 질문(statement) → 순서(agenda) → [장 구분(section) → 내용 3~6장] 반복 → 핵심 정리(closing) → 마무리. 같은 유형을 세 장 넘게 잇지 않는다.
- 기본 테마는 밝은 `paper` 다(사용자 결정, 2026-11). 글자 쪽은 흰 면으로 덮이고 반대쪽에서 사진이 드러나므로, 사진의 주제는 오른쪽(또는 글 반대쪽)에 오게 고른다.
- 표지 · 장 구분 · 한 문장 · 사진 장에는 장마다 다른 전면 배경을 넣는다. 내용 장은 `deck.bg` 기본 배경으로 통일한다.
- 배경 그림: `gpt-image` 스킬로 만든다(가로 1536x1024, `--jpg`, 글자 · 로고 없이, 글자 놓을 어두운 여백을 두라고 적는다). 크레딧이 없으면(429) 사용자에게 알리고 기존 그림 · 사용자 사진을 쓴다. 가로 1400 미만 그림은 전면 배경으로 쓰지 않는다.
- 정확해야 하는 도식(응급처치 손 위치 등)은 생성 그림으로 그리지 않는다.
- 숫자 · 법령 · 통계는 출처를 확인해 `source` 에 적고, 확인 못 한 것은 넣지 않거나 `확인 필요` 로 적는다. 없는 수치를 만들지 않는다.
- `notes` 에는 [시간], 말할 내용, 클릭 순서, [출처] 를 적는다.
- 만든 뒤에는 화면을 실제로 띄워 장마다 확인한다: `python3 -m http.server` 로 저장소를 열고 `taestep/play.html?deck=<이름>` 을 Playwright 로 캡처(글자 넘침 · 그림 위 글자 가독성 · 오탈자).

## 4. 앱을 고칠 때
- 슬라이드 디자인 = `ts/engine.css`, 그리기 = `ts/engine.js`, 저장 = `ts/store.js`, 화면 = `ts/home.js · studio.js · play.js`, 앱 화면 꾸밈 = `ts/app.css`.
- 화면 위 직접 편집 = `ts/edit.js`(고르기 · 옮기기 · 크기 · 회전 · 자석 · 자르기 · 복사), PPTX 내보내기 = `ts/pptx.js`(+ `ts/vendor/pptxgen.bundle.js`), 아이콘 = `ts/icons.js`.
- 저장 · 작업본 · 보관함(30일) · 덮어쓰기 확인 · 저장 이력 = `ts/store.js`, 내보내기(PPTX · PDF · 유인물 · 단독 HTML · 교안 파일) = `ts/export.js`. 사용자가 고르지 않은 내용은 지우지 않는다(보관함으로).
- 교안 파일에는 `_base` · `_synced` 를 넣지 않는다(이 기기의 작업본에만 쓰는 표시).
- 고친 뒤에는 편집 화면을 실제로 띄워 넣기 · 옮기기 · 되돌리기 · 발표 화면 · PPTX 까지 확인한다.
- 장 유형을 더할 때: `LAYOUTS` 에 칸 정의 → `R` 에 그리는 함수 → `engine.css` 에 `.L-<이름>` → 이 표에 한 줄.
- 화면 파일을 더하면 `taestep/sw.js` 의 `CORE` 와 `CACHE` 번호를 함께 고친다.
- 작업 규칙(CLAUDE.md): 최신 main 에서 worktree → 커밋 → `--no-ff` 병합 → 푸시 → Pages 배포 확인.
