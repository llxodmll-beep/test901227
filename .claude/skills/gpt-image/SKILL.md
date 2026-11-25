---
name: gpt-image
description: ChatGPT 이미지 엔진(OpenAI chatgpt-image-latest)으로 그림을 만들어 교안·문서에 넣는다. 사용자가 "그림/이미지/일러스트/삽화를 만들어 줘", "ChatGPT로 그려 줘", 교안 장의 그림을 바꿔 달라고 할 때 사용. "소방 기동복"이 나오면 6장의 고정 복장(주황+남색 기동복)으로 그린다. SVG 로 직접 그리기 전에 이 도구를 먼저 쓴다.
---

# gpt-image — Claude 가 ChatGPT 이미지 엔진을 불러 그림 만들기

도구: `tools/gpt-image/gpt_image.py` (표준 라이브러리만, 설치 없음)

## 1. 쓰기 전에 확인
- 클라우드 세션: 환경의 Network secret 에 `api.openai.com` 키가 저장돼 있어야 한다. 없으면 `request_credential`(host `api.openai.com`, Bearer)로 사용자에게 받는다. 키를 채팅으로 받지 않는다.
- 내 PC: `OPENAI_API_KEY` 환경 변수.
- 401 = 키 없음/틀림, 403 = 모델 권한(조직 인증) 또는 접속 차단, 429 = 크레딧 부족.

## 2. 만들기
```bash
python3 tools/gpt-image/gpt_image.py "장면 설명" --style anime --size 1536x1024 --quality high -o assets/이름.png
python3 tools/gpt-image/gpt_image.py --styles        # anime · manga · photo · flat · edu
```
- 시안은 `--quality low` 로 여러 장(`--n 3`) → 고른 뒤 `high` 로 다시.
- 같은 인물·화풍을 이어 가려면 앞서 만든 그림을 `--ref` 로 준다 (여러 장 가능).
- 교안 그림은 `--jpg` 로 용량을 줄인다(투명 배경이 필요하면 `--background transparent` + PNG).
- 칸 비율: 교안 카드(가로 10:9)는 `1024x1024`, 넓은 칸은 `1536x1024`, 세로 칸은 `1024x1536`.

## 3. 프롬프트 요령
- 장면(누가·어디서·무엇을) → 인물 고정 묘사(나이·머리·복장) → 화풍 프리셋 순서.
- 그림 안에 글자·로고를 넣지 않는다 (교안 글은 DPV 텍스트로). 예외: 소방 기동복의 등판 「소방 119」·태극기 「KOREA」 패치는 복장의 일부라 넣는다(6장).
- 응급처치 손 위치·패드 위치처럼 정확해야 하는 도식은 생성 그림을 쓰지 말고 검증된 교재 그림을 쓴다. 생성 그림은 분위기·상황 장면용.
- 실존 인물 얼굴, 특정 작가 이름, 상표는 넣지 않는다.

## 4. 교안(DPV)에 넣기
- 파일은 `assets/` 에 저장하고, `decks/<교안>.json` 의 해당 image 요소 `src` 를 `assets/파일` 로 바꾼다.
- 원래 그림은 지우지 말고 새 이름으로 저장(되돌리기 쉽게).
- 작업 규칙(CLAUDE.md): 최신 main 에서 worktree → 커밋 → `--no-ff` 병합 → 푸시 → Pages 배포 확인.
- 만든 그림은 교안 장 notes 끝에 `[그림] gpt-image 생성 — 프롬프트 요약` 을 한 줄 남긴다.

## 5. 모델
- 기본 `chatgpt-image-latest` (ChatGPT 앱과 같은 엔진). 다른 모델: `curl` 대신 `/v1/models` 목록에서 `image` 가 든 이름 확인 후 `--model` 로 지정.
- 400 "model does not exist" 가 나오면 모델 이름이 바뀐 것 — 목록을 다시 확인한다.

## 6. 소방 기동복 (고정 복장) — 사용자가 "소방 기동복"이라고 하면 항상 이 복장
상세 매뉴얼: `docs/소방-기동복-레퍼런스.md` · 참고 그림: `.claude/skills/gpt-image/ref/fire-uniform-front.jpg`(앞) · `fire-uniform-back.jpg`(등)

- 생성할 때 참고 그림을 **반드시 `--ref` 로 함께 준다** (보이는 쪽에 맞춰 앞·등 중 하나 또는 둘 다).
- 프롬프트의 인물 복장 부분에 아래 고정 문구를 그대로 붙인다.

```
wearing the Korean firefighter field-duty uniform (소방 기동복): a bright safety-orange work jacket with dark navy contrast panels —
navy pointed shirt collar, navy shoulder yoke across the upper chest and upper back, navy epaulettes, wide navy side panels running
from the armpits down to the hem, navy cuffs. Front: center metal zipper, two chest pockets with buttoned flaps, small gold embroidered
fire-service eagle emblem on the left chest, plain black name tape above the right pocket (no readable name).
Left upper sleeve: South Korean flag (Taegukgi) patch with "KOREA" in white on a blue band. Right upper sleeve: round fire-service emblem patch.
Back: on the navy yoke, large white reflective lettering "소방" (small) above a big bold "119" with three horizontal speed lines.
Navy work trousers. Optional: black cap with gold eagle emblem.
```

- 하지 말 것: 방화복(두꺼운 방화 외피·반사띠 두른 진압복), 남색 단색 근무복, 미국식 소방복(베이지·노랑 반사띠), 빨간 소방복으로 바꾸기.
- 이름표는 빈칸 또는 읽히지 않게(실명 금지). 계급장은 사용자가 말할 때만 넣는다.
- 결과에서 확인: 「소방 119」·「KOREA」 철자, 태극기 모양, 주황/남색 배치(어깨·옆구리·소매끝 남색). 글자가 깨지면 다시 만들거나 그 부분을 가린 구도로 바꾼다.
- 이미지 엔진을 못 쓰면 위 문구 + 참고 그림 2장을 ChatGPT 에 함께 넣으라는 프롬프트를 사용자에게 준다.
