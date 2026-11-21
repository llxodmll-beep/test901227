# gpt-image — Claude 에서 ChatGPT 이미지 엔진으로 그림 만들기

ChatGPT 앱에는 외부에서 연결하는 커넥터가 없어서, ChatGPT 가 쓰는 이미지 엔진(OpenAI 이미지 API, 기본 모델 `chatgpt-image-latest` — ChatGPT 앱과 같은 그림 엔진. `--model gpt-image-2` 등으로 바꿀 수 있음)을 직접 부르는 도구입니다.
Claude(Opus)에게 "ChatGPT로 ○○ 그림 만들어서 4장에 넣어 줘" 라고 말하면 Claude 가 이 도구로 그림을 만들고 교안에 넣습니다.

## 준비 (한 번)

1. https://platform.openai.com 에 로그인 → **Billing** 에서 결제 수단 등록(크레딧 충전).
   ChatGPT Plus 구독과 API 요금은 **별개**입니다.
2. **API keys** → *Create new secret key* 로 키를 만듭니다.
   일부 모델은 조직 인증(Organization verification)을 요구할 수 있습니다 — 403 이 나오면 Settings → Organization → Verify.
3. 키 넣기
   - **Claude 클라우드 세션**: Claude 가 띄우는 키 입력 카드에서 「Bearer 토큰」을 고르고 붙여 넣습니다(채팅창에 붙여 넣지 마세요). 만료는 30일을 권장.
     키는 환경의 Network secret 으로 저장되고, 요청할 때 프록시가 넣어 줍니다.
   - **내 PC**: `setx OPENAI_API_KEY "sk-..."` (Windows) 후 새 창에서 실행.

## 직접 쓰기

```bash
python3 tools/gpt-image/gpt_image.py "소방관이 컵라면을 맛있게 먹는 모습" --style anime --size 1024x1024 -o assets/ramen.png
python3 tools/gpt-image/gpt_image.py "같은 인물이 책을 읽는 모습" --ref assets/ramen.png --style anime -o assets/reading.png
python3 tools/gpt-image/gpt_image.py --styles
```

| 옵션 | 뜻 |
|---|---|
| `--style` | anime(극장판 키 비주얼) · manga(흑백 만화) · photo(사진) · flat(평면 일러스트) · edu(교육용 도해) |
| `--size` | 1024x1024 · 1536x1024(가로) · 1024x1536(세로) |
| `--quality` | low(시안, 저렴) · medium · high(최종) |
| `--ref` | 참고 그림 — 같은 인물·화풍 유지 (여러 장 가능) |
| `--n` | 여러 장 한꺼번에 |
| `--jpg` | JPEG 로 줄여 저장 (교안 용량 절약) |
| `--background transparent` | 배경 투명 PNG |

## 요금 (참고)

장당 요금은 크기·품질에 따라 다릅니다. 시안은 `--quality low` 로 여러 장 보고, 고른 것만 `high` 로 다시 만드는 것이 경제적입니다.
최신 요금은 https://openai.com/api/pricing 에서 확인하세요.

## 주의

- 응급처치 손 위치·AED 패드 위치처럼 **정확해야 하는 도식**은 생성 그림 대신 교재 그림을 씁니다. 생성 그림은 상황·분위기 장면용입니다.
- 그림 안 글자는 깨지기 쉬우니 넣지 않고, 교안 글은 DPV 텍스트로 씁니다.
- 실존 인물 얼굴, 특정 작가 이름, 상표는 프롬프트에 넣지 않습니다.
