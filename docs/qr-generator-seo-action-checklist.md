# QR 코드 생성기 — SEO 기술 작업 체크리스트 (미실행)

> **문서 성격:** 짝 문서 **`docs/qr-generator-growth-seo.md`**(전략)의 Step 0–1을 실행하기 위한 **구체 기술
> 체크리스트**. 각 항목에 *목표 · 왜 · 건드릴 파일 · 구현 노트 · 검증*을 적었다. **아직 아무것도 구현하지
> 않았다** — 실행 승인 시 착수. 2026-07 기준 실제 코드/설정을 검증한 상태를 전제로 한다.

## 착수 전 공통 주의 (이 repo 관례)
- **`AGENTS.md`:** "This is NOT the Next.js you know" — 코드 작성 전 `node_modules/next/dist/docs/`의 해당
  가이드(metadata, static export)를 먼저 읽을 것.
- **verify, don't claim:** 각 작업 후 `pnpm build` 하고 **`out/`의 실제 산출물**(HTML의 `<title>`/JSON-LD/
  `out/og.png` 존재)로 검증. "될 것"이라고 쓰지 말고 확인.
- **ko/en 딕셔너리는 구조적으로 동일**해야 함 — 한쪽에 필드 추가 시 반대쪽도. `Dictionary` 타입이 이를 강제.
- **CSP:** `public/_headers`의 `Content-Security-Policy`는 `script-src 'self' 'unsafe-inline'` — **인라인
  JSON-LD는 허용됨**(아래 3번). 단 외부 스크립트/beacon은 막힘(아래 6번 주의).

---

## 1. `og.png` (1200×630) 제작·배치  — Step 0

- **목표:** `public/og.png` 파일을 실제로 넣어 공유 미리보기 복구.
- **왜:** `layout.tsx`·tool `page.tsx`가 이미 `/og.png`를 참조하지만 **파일이 없음** → 지금 모든 SNS/메신저
  공유가 빈 미리보기. 코드 변경 불필요, **파일만 추가하면 됨**.
- **건드릴 파일:** `public/og.png` (신규). 참조는 이미 존재하므로 코드 수정 없음.
- **구현 노트:** 1200×630, 브랜드명 + "무료 QR 코드 생성기 · 회원가입 없음" 류 카피. 파일 크기 가볍게(<200KB).
  static asset이므로 빌드 시 `out/og.png`로 복사됨. CSP `img-src 'self' data:`가 same-origin이라 통과.
  (선택) 동적 `opengraph-image.tsx`(`ImageResponse`)는 `output:'export'`에서 미검증 → 정적 파일이 안전.
- **검증:** `pnpm build` 후 `out/og.png` 존재 확인. 배포 후 공유 디버거(카톡/트위터/OG 검사기)로 실제 렌더 확인.

## 2. 키워드 타이틀 / 메타 튜닝  — Step 1

- **목표:** UI용 짧은 title과 **SEO용 meta title/description을 분리**해 키워드·차별점을 담기.
- **왜:** 현재 tool `<title>`="QR 코드 생성기"만. 순위+CTR 1위 레버. 단, H1/그리드 카드에 쓰이는 `title`을
  길게 늘이면 UI가 깨지므로 **메타 전용 필드를 따로** 둠.
- **건드릴 파일:**
  - `src/i18n/dictionaries/{ko,en}.json` — `tools.qr`에 `metaTitle`·`metaDescription` **선택 필드 추가**(양쪽 동일 구조).
  - `src/app/[locale]/tools/[slug]/page.tsx` — `generateMetadata`에서 `t.metaTitle ?? t.title`,
    `t.metaDescription ?? t.description` 사용. H1은 그대로 `t.title`(짧게 유지).
- **구현 노트:** 예) `metaTitle: "무료 QR 코드 생성기 — 회원가입 없이, SVG 다운로드"`(브랜드 접미사 포함 ~60자 이내).
  `en`은 `"Free QR Code Generator — No Sign Up, Free SVG"`. 현재 title 템플릿(`%s · 유용한 도구 모음`)을 유지할지,
  tool 페이지는 `title:{absolute:...}`로 완전 제어할지 결정(길이 관리 목적이면 absolute 권장).
  `Dictionary` 타입이 JSON에서 파생되면 선택 필드는 `?:`로.
- **검증:** 빌드 후 `out/ko/tools/qr/index.html`의 `<title>`·`<meta name="description">`이 새 값인지 grep.

## 3. JSON-LD 구조화 데이터  — Step 1

- **목표:** tool 페이지에 `WebApplication`(+ 4번의 FAQ가 생기면 `FAQPage`) JSON-LD 삽입 → 리치 결과 자격.
- **왜:** 현재 JSON-LD 0개. SERP 노출·이해도 향상.
- **건드릴 파일:** `src/app/[locale]/tools/[slug]/page.tsx`(서버 컴포넌트) — `<script type="application/ld+json"
  dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />` 렌더.
- **구현 노트:** `WebApplication`: `name`(=title), `description`, `url`, `applicationCategory:"UtilitiesApplication"`,
  `offers:{price:"0"}`, `operatingSystem:"Any (web)"`. **CSP 통과**(인라인 JSON-LD, `unsafe-inline` 허용).
  `FAQPage`는 **화면에 실제로 보이는 FAQ와 내용이 일치**해야 함(구글 가이드) → 4번과 같은 dict 소스에서 생성.
- **검증:** 빌드 후 HTML에 `application/ld+json` 존재 확인 + 구글 Rich Results Test로 유효성.

## 4. tool 페이지 thin-content 보강 (FAQ / 사용법)  — Step 1

- **목표:** 도구 아래에 **크롤 가능한 정적 텍스트**(소개 · 사용법 · FAQ · "왜 이 도구") 추가.
- **왜:** 도구가 `ssr:false`라 정적 HTML엔 H1+문장1개뿐 → 구글이 이길 근거가 없음. **on-page 최대 레버리지**.
  동시에 3번 FAQPage JSON-LD의 소스가 됨.
- **건드릴 파일:**
  - `src/i18n/dictionaries/{ko,en}.json` — `tools.qr`에 `intro`, `howto`(단계 배열), `faq`(`{q,a}` 배열) 추가(양쪽 동일).
  - `src/app/[locale]/tools/[slug]/page.tsx` — 도구(`ToolLoader`) 아래에 서버 렌더 텍스트 섹션 추가(정적 HTML에 포함).
- **구현 노트:** FAQ는 롱테일 질문 겨냥("QR 코드에 로고를 넣을 수 있나요?", "SVG로 저장하려면?", "회원가입이 필요한가요?",
  "인쇄용 크기는?"). "회원가입 없음/무료 SVG/오프라인/데이터가 기기를 안 떠남"을 본문에 명시(불만 키워드 + 신뢰 신호).
  범용 QR 페이지가 아니라 타입별(WiFi/vCard) 페이지를 만들 땐 이 콘텐츠를 타입별로(전략 문서 Step 2 / 기능 문서 SEO 곁가지).
- **검증:** 빌드 후 `out/ko/tools/qr/index.html`에 FAQ/사용법 텍스트가 **정적으로** 들어갔는지 확인(ssr:false 도구와 달리 보여야 함).

## 5. 검색엔진 등록 + 사이트맵 제출 (수동 · 코드 밖)  — Step 0

- **목표:** 색인 + 검색 데이터 확보. **단일 최고 레버리지.**
- **왜:** 등록 안 하면 안 보이고 데이터도 없음. 네이버는 별도 생태계라 반드시 별도 등록.
- **작업 체크리스트:**
  - [ ] **네이버 서치어드바이저:** 사이트 등록 → 소유확인 → `https://tools.solisapps.com/sitemap.xml` 제출 → 주요 URL 수집요청.
  - [ ] **Google Search Console:** 속성 등록(도메인 or URL prefix) → 사이트맵 제출 → 색인 요청.
  - [ ] **Bing Webmaster Tools:** GSC에서 import.
  - [ ] **Daum(카카오) 검색등록.**
- **소유확인 메타태그가 필요하면(코드):** `layout.tsx`의 `generateMetadata`에 Next `verification` 필드 활용
  (예: `verification:{ other:{ 'naver-site-verification':'...' } }`) → `<head>`에 메타 출력. (파일 업로드 방식이면 `public/`에 배치.)
- **검증:** 각 콘솔에서 소유확인 통과 + 사이트맵 "성공" 상태.

## 6. 프라이버시 친화 분석 (Cloudflare Web Analytics)  — Step 4

- **목표:** "추적 없음" 포지셔닝을 깨지 않고 트래픽 측정. (GA 금지 — 쿠키+포지셔닝 모순+무게.)
- **⚠️ CSP 충돌 주의:** CF Web Analytics beacon은 `static.cloudflareinsights.com`(스크립트) +
  `cloudflareinsights.com`(전송)을 씀. 현재 `_headers` CSP(`script-src 'self' 'unsafe-inline'; connect-src 'self'`)가
  이를 **차단**함 → 그냥 켜면 조용히 실패.
- **선택지:**
  - **(A) 권장 — 서버 사이드 요청 분석 우선 검토:** CF 대시보드의 Workers/Assets 요청 분석(페이지뷰 수준, beacon 불필요,
    CSP 변경 없음). 프라이버시 카피와 가장 정합. **먼저 이걸로 충분한지 판단.**
  - **(B) beacon이 필요하면:** `public/_headers` CSP에 `script-src`에 `https://static.cloudflareinsights.com`,
    `connect-src`에 `https://cloudflareinsights.com` 추가. 프라이버시 카피에 "쿠키리스 분석 사용" 한 줄 명시 권장.
- **검증:** (B) 채택 시 브라우저 콘솔에 CSP 위반 없음 + CF 대시보드에 데이터 유입 확인.

---

## 실행 순서 요약 (이번 주 우선)
1. **#1 og.png** → 2. **#5 검색엔진 등록/사이트맵** → 3. **#4 thin-content + #2 타이틀 + #3 JSON-LD**(같이).
4. 배포 안정화 후 **#6 분석**. — 상세 근거·비코드 전략은 `docs/qr-generator-growth-seo.md`.
