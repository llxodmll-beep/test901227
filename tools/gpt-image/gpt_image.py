#!/usr/bin/env python3
"""ChatGPT 이미지 엔진(OpenAI 이미지 API · chatgpt-image-latest) 으로 그림을 만든다 — Claude(Opus)가 대신 불러 쓰는 도구.

  python3 tools/gpt-image/gpt_image.py "프롬프트" -o assets/그림.png
  python3 tools/gpt-image/gpt_image.py "프롬프트" --style anime --size 1536x1024 --quality high -o out.png
  python3 tools/gpt-image/gpt_image.py "이 인물이 책을 읽는 모습" --ref assets/인물.png -o out.png   # 참고 그림(같은 인물·화풍 유지)
  python3 tools/gpt-image/gpt_image.py --styles                                                      # 화풍 목록

API 키
  · Claude 클라우드 세션: 환경의 Network secret(api.openai.com) 에 저장하면 프록시가 요청에 키를 넣어 준다.
    이 도구는 키를 몰라도 된다(OPENAI_API_KEY 가 없으면 자리표시 값을 보냄).
  · 내 PC: 환경 변수 OPENAI_API_KEY 에 키를 넣고 실행.
  ChatGPT Plus 구독과 API 요금은 별개다 — platform.openai.com 에서 결제 수단을 등록한 API 키가 필요하다.

표준 라이브러리만 쓴다(설치 없음). --jpg 를 주면 Pillow 가 있을 때 JPEG 로 줄여 저장한다.
"""
import argparse, base64, json, mimetypes, os, ssl, sys, time, uuid, urllib.request, urllib.error

API = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
DEFAULT_MODEL = os.environ.get("GPT_IMAGE_MODEL", "chatgpt-image-latest")

# 화풍 프리셋 — 프롬프트 뒤에 붙는다. 교안에 자주 쓰는 것만.
STYLES = {
    "anime": "High-quality anime key visual illustration, semi-realistic proportions, clean thin line art, "
             "cel shading with 2-3 tone levels, highly detailed gear and fabric folds, vivid blue sky with white "
             "cumulus clouds, bright daylight, cinematic composition, sharp focus. No text, no letters, no watermark, not chibi.",
    "manga": "Japanese manga page panel, black and white ink line art, screentone shading, speed lines, dramatic "
             "composition, professional manga artist quality. No text, no speech bubbles, no watermark.",
    "photo": "Photorealistic, natural lighting, 35mm lens, shallow depth of field, realistic skin and fabric texture, "
             "documentary style. No text, no watermark.",
    "flat": "Clean flat vector illustration for a presentation slide, simple shapes, soft gradients, consistent line "
            "weight, friendly, white background. No text, no watermark.",
    "edu": "Clear instructional medical illustration for first-aid training, accurate anatomy and hand positions, "
           "clean lines, soft colors, plain light background, textbook quality. No text, no labels, no watermark.",
}

def ssl_ctx():
    for p in (os.environ.get("SSL_CERT_FILE"), "/root/.ccr/ca-bundle.crt"):
        if p and os.path.exists(p):
            return ssl.create_default_context(cafile=p)
    return ssl.create_default_context()

def headers(extra=None):
    key = os.environ.get("OPENAI_API_KEY") or "sk-proxy-injects-the-real-key"
    h = {"Authorization": f"Bearer {key}"}
    if os.environ.get("OPENAI_ORG_ID"): h["OpenAI-Organization"] = os.environ["OPENAI_ORG_ID"]
    h.update(extra or {})
    return h

def post(url, body, ctype, timeout=300):
    req = urllib.request.Request(url, data=body, method="POST", headers=headers({"Content-Type": ctype}))
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, context=ssl_ctx(), timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            msg = e.read().decode("utf-8", "replace")
            try: msg = json.loads(msg).get("error", {}).get("message", msg)
            except Exception: pass
            if e.code in (429, 500, 502, 503) and attempt < 2:
                time.sleep(4 * (attempt + 1)); continue
            hint = {401: "API 키가 없거나 틀렸습니다.", 403: "이 키로 이 모델을 쓸 권한이 없거나(조직 인증 필요) 접속이 막혔습니다.",
                    429: "요청 한도 또는 크레딧 부족입니다 (platform.openai.com → Billing)."}.get(e.code, "")
            sys.exit(f"[gpt-image] 실패 HTTP {e.code}: {msg}\n{hint}")
        except urllib.error.URLError as e:
            if attempt < 2: time.sleep(3); continue
            sys.exit(f"[gpt-image] 연결 실패: {e.reason} — api.openai.com 접속이 허용되어 있는지 확인하세요.")

def multipart(fields, files):
    b = uuid.uuid4().hex; out = []
    for k, v in fields.items():
        out += [f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()]
    for k, path in files:
        mt = mimetypes.guess_type(path)[0] or "image/png"
        out += [f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"; filename=\"{os.path.basename(path)}\"\r\nContent-Type: {mt}\r\n\r\n".encode(),
                open(path, "rb").read(), b"\r\n"]
    out.append(f"--{b}--\r\n".encode())
    return b"".join(out), f"multipart/form-data; boundary={b}"

def main():
    ap = argparse.ArgumentParser(description="ChatGPT 이미지 엔진(gpt-image)으로 그림 만들기")
    ap.add_argument("prompt", nargs="?", help="그릴 내용 (한국어 가능)")
    ap.add_argument("-o", "--out", default="gpt-image.png", help="저장할 파일 (여러 장이면 -1, -2 가 붙음)")
    ap.add_argument("--style", choices=sorted(STYLES), help="화풍 프리셋")
    ap.add_argument("--size", default="1536x1024", help="1024x1024 · 1536x1024(가로) · 1024x1536(세로) · auto")
    ap.add_argument("--quality", default="high", choices=["low", "medium", "high", "auto"], help="low 는 싸고 빠름(시안용)")
    ap.add_argument("--n", type=int, default=1, help="몇 장")
    ap.add_argument("--ref", action="append", default=[], help="참고 그림(같은 인물·화풍 유지). 여러 번 쓸 수 있음")
    ap.add_argument("--background", choices=["auto", "transparent", "opaque"], help="transparent = 배경 투명 PNG")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--jpg", action="store_true", help="JPEG 로 줄여 저장(교안 용량 절약, Pillow 필요)")
    ap.add_argument("--styles", action="store_true", help="화풍 프리셋 보기")
    a = ap.parse_args()
    if a.styles:
        for k, v in STYLES.items(): print(f"{k:6} {v}\n")
        return
    if not a.prompt: ap.error("프롬프트를 적어 주세요")
    prompt = a.prompt + ("\n\nStyle: " + STYLES[a.style] if a.style else "")

    t0 = time.time()
    if a.ref:
        for r in a.ref:
            if not os.path.exists(r): sys.exit(f"[gpt-image] 참고 그림이 없습니다: {r}")
        fields = {"model": a.model, "prompt": prompt, "size": a.size, "quality": a.quality, "n": str(a.n)}
        if a.background: fields["background"] = a.background
        body, ct = multipart(fields, [("image[]", r) for r in a.ref])
        res = post(f"{API}/images/edits", body, ct)
    else:
        payload = {"model": a.model, "prompt": prompt, "size": a.size, "quality": a.quality, "n": a.n}
        if a.background: payload["background"] = a.background
        res = post(f"{API}/images/generations", json.dumps(payload).encode(), "application/json")

    data = res.get("data") or []
    if not data: sys.exit(f"[gpt-image] 그림을 받지 못했습니다: {json.dumps(res)[:400]}")
    base, ext = os.path.splitext(a.out); ext = ".jpg" if a.jpg else (ext or ".png")
    saved = []
    for i, d in enumerate(data):
        path = f"{base}{'' if len(data) == 1 else f'-{i+1}'}{ext}"
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        if d.get("b64_json"): raw = base64.b64decode(d["b64_json"])
        elif d.get("url"):
            with urllib.request.urlopen(d["url"], context=ssl_ctx(), timeout=120) as r: raw = r.read()
        else: continue
        if a.jpg:
            try:
                from PIL import Image; import io
                Image.open(io.BytesIO(raw)).convert("RGB").save(path, quality=88, optimize=True)
            except ImportError:
                path = f"{base}{'' if len(data) == 1 else f'-{i+1}'}.png"; open(path, "wb").write(raw)
        else:
            open(path, "wb").write(raw)
        saved.append(path)
    u = res.get("usage") or {}
    print(json.dumps({"saved": saved, "model": a.model, "size": a.size, "quality": a.quality,
                      "seconds": round(time.time() - t0, 1), "usage": u}, ensure_ascii=False))

if __name__ == "__main__":
    main()
