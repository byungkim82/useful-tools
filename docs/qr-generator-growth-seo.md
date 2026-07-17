# QR 코드 생성기 — 검색 노출 · 성장(Growth/SEO) 전략

> **문서 성격:** 도구 *기능 개선*과는 별개로, "사람들이 검색으로 이 도구를 쉽게 찾게" 하려면 무엇을 어떤
> 순서로 해야 하는지 정리한 전략 문서. 2026-07 기준 실제 앱 상태를 검증한 결과를 근거로 한다. 짝 문서:
> **`docs/qr-generator-seo-action-checklist.md`**(이 전략을 실행하는 구체 기술 체크리스트).

---

## 0. 현재 SEO 상태 진단 (검증 완료)

**이미 갖춰진 기술 토대:**
- 도메인 확정: `SITE_ORIGIN = https://tools.solisapps.com` (플레이스홀더 아님)
- `sitemap.xml` — hreflang alternates + trailing slash + `force-static`, `lastmod` 없음(의도적)
- `robots.txt` — 전체 allow + sitemap 링크. 색인 차단 헤더 없음(`_headers`에 `noindex` 없음)
- 페이지별 localized `<title>` / meta description / OG(type·siteName·locale·url·image) / hreflang `x-default→ko`
- Core Web Vitals 사실상 최상(정적 export → CF 엣지)

**검색 유입을 막는 실제 구멍 (이번 전략의 대상):**
1. ❌ **`og.png` 파일이 실제로 없음.** `/og.png`를 참조하지만 `public/`에 파일 부재 → **모든 SNS/메신저
   공유 미리보기가 깨짐**(가장 값싼 배포 채널이 지금 고장).
2. ❌ **tool 페이지의 크롤 가능 HTML이 얇음.** 실제 도구는 `ssr:false` client island이라 정적 HTML엔
   없음 → 구글이 보는 텍스트 ≈ `<title>` + H1 "QR 코드 생성기" + 문장 1개. 경쟁 검색어에서 이길 근거가 없음.
3. ❌ **JSON-LD 구조화 데이터 0개** → 리치 결과 노출 자격 없음.
4. ❌ **검색엔진 등록/사이트맵 제출 미확인**(특히 네이버) → 색인도, 데이터도 없음.
5. ❌ **타이틀이 키워드 미튜닝** — "QR 코드 생성기"만. 사람들이 실제 치는 수식어·차별점 없음.

---

## 1. 전제 — 어디서 싸울지부터 정한다

**"qr code generator"(head term)는 몇 년간 못 이긴다.** qr-code-generator.com · QRCode Monkey · Canva ·
Adobe · Bitly가 도메인 파워로 장악. 신규 사이트가 정면으로 붙는 건 시간 낭비다. → **거인들이 약한 3곳**에서 이긴다:

1. **한국어 검색** — 앱은 이미 ko/en + hreflang. 한국어 QR 검색("qr코드 생성기", "와이파이 qr코드 만들기")은
   영어 거인들이 거의 없고 **네이버는 완전히 별개 생태계**다. 가장 안 붐비는 기회이고, 앱이 이미 그렇게 지어져 있다.
2. **롱테일 의도 검색** — "wifi qr code generator", "vcard qr", "bulk qr free", "qr code svg" 등 좁은 의도.
   → 기능 개선 문서의 **콘텐츠 타입별 페이지**가 곧 유입 엔진(기능 다 안 만들어도 전용 페이지가 그 검색어를 잡음).
3. **불만(frustration) 키워드** — 앱의 정직한 장점이 곧 검색어다: "no sign up", "no expiration", "free svg",
   "no watermark", "no tracking". 거인들의 다크패턴에 데인 사람들이 이걸 친다.

---

## 2. 우선순위 로드맵

각 단계의 *구체 실행 항목·파일·검증*은 짝 문서(액션 체크리스트)에 있다. 여기는 순서와 이유.

### Step 0 — 지금 당장 (이번 주 · 최고 레버리지)
- **`og.png`(1200×630) 제작·배치** — 공유 미리보기 복구.
- **사이트 라이브 + HTTPS 확인**(도메인은 설정됐으나 실제 배포 여부 확인 필요).
- **검색엔진 등록 + 사이트맵 제출** ← *단일 최고 레버리지 첫 행동*:
  **네이버 서치어드바이저**(한국 유입 핵심) · **Google Search Console** · Bing Webmaster · Daum 검색등록.
  안 하면 안 보일 뿐 아니라 **데이터가 없어 개선 방향도 못 잡는다.**

### Step 1 — 페이지를 "검색에 이해될" 상태로 (지금 너무 얇음)
- **tool 페이지에 크롤 가능한 정적 텍스트 추가**: 소개 + **사용법 + FAQ**(롱테일 질문 겨냥) + "왜 이 도구"
  (회원가입 없음/무료 SVG/오프라인). on-page 최대 레버리지.
- **타이틀/메타 키워드 튜닝** — 순위+CTR 1위 레버. UI용 짧은 title과 별개로 SEO용 meta title/description 분리 권장.
- **JSON-LD**(`WebApplication` + `FAQPage`) 추가.
- Core Web Vitals는 이미 강점 → **무거운 트래커/스크립트로 깨지 말 것.**

### Step 2 — 검색어에 맞는 랜딩 페이지 (진짜 성장 엔진)
- **한국어 우선 + 롱테일 전용 페이지**(WiFi QR, vCard QR…) 각자 title/H1/본문. 기능 개선 문서의 "타입별 slug"
  옵션이 여기서 유입으로 회수됨. ko/en 쌍(hreflang이 연결).
- **정보성 how-to 글**("와이파이 QR코드 만드는 법", "vCard QR 포맷")로 informational 검색을 잡아 도구로 유입.

### Step 3 — 초기 유입·백링크 씨 뿌리기 (SEO는 느림 → 점화)
- **런칭 배포**: Show HN(Hacker News) · Product Hunt · Reddit(r/webdev, r/InternetIsBeautiful, r/privacy) ·
  **한국 개발자 커뮤니티**(GeekNews/news.hada.io, 클리앙, OKKY). 업보트 앵글 = "오픈소스·추적 없음·오프라인·
  회원가입 없는 QR 도구"(프라이버시/개발자층이 좋아함).
- **"best free QR generator" 리스티클 / 무료 도구 디렉토리 등재** 요청.
- **오픈소스화**하면 GitHub repo 자체가 순위 + 개발자 백링크. 정직한 포지셔닝이 링크를 부르는 소재.

### Step 4 — 측정하며 반복
- **Search Console**: 노출/검색어/CTR 관찰 → 노출은 되는데 CTR 낮으면 타이틀 재작성, 노출되는 검색어에 맞춰 본문 보강.
- **Cloudflare Web Analytics**(무료·쿠키 없음)로 측정 — "추적 없음" 포지셔닝을 안 깨는 유일한 선택.
  단, 현재 CSP가 외부 beacon을 막으므로 CSP 조정 필요(짝 문서 참고). GA는 지양(쿠키+포지셔닝 모순+무게).

---

## 3. 이번 주에 딱 3개만 한다면
1. **`og.png` 넣기** (공유 미리보기 복구)
2. **네이버 서치어드바이저 + Google Search Console 등록 + 사이트맵 제출**
3. **tool 페이지에 FAQ/사용법 텍스트 + 키워드 타이틀 + JSON-LD** (thin content 해소)

**한 줄 요약:** head term은 버리고 — 한국어 + 롱테일 + 불만 키워드에서 이기고 — 얇은 페이지를 두껍게 만든 뒤 —
커뮤니티 런칭으로 첫 백링크를 뿌려 SEO가 복리로 쌓이게 하는 순서.

---

## 부록 A — 타깃 키워드 (초안)

**한국어(네이버·구글 KR — 최우선, 저경쟁):**
`qr코드 생성기` · `무료 qr코드 만들기` · `qr코드 만들기 회원가입 없이` · `와이파이 qr코드 만들기` ·
`명함 qr코드(vCard)` · `qr코드 svg 다운로드` · `url qr코드 생성` · `qr코드 무료 무제한`

**영어 롱테일/불만(경쟁 낮음):**
`wifi qr code generator` · `vcard qr code generator` · `qr code generator no sign up` ·
`free qr code generator no expiration` · `qr code generator svg free` · `bulk qr code generator free` ·
`offline qr code generator` · `qr code generator no watermark` · `privacy qr code generator`

**피할 head term(당분간):** `qr code generator`, `qr generator`, `free qr code`.

## 부록 B — 등록할 곳 / 배포 채널

- **검색엔진 등록:** 네이버 서치어드바이저 · Google Search Console · Bing Webmaster Tools · Daum(카카오) 검색등록.
- **런칭/커뮤니티:** Hacker News(Show HN) · Product Hunt · Reddit(r/webdev·r/InternetIsBeautiful·r/privacy·
  r/QRcode) · GeekNews(news.hada.io) · 클리앙 · OKKY.
- **등재 요청:** "best free QR code generator" 리스티클, 무료 도구 디렉토리, AlternativeTo 등.
- **분석:** Cloudflare Web Analytics (쿠키리스).
