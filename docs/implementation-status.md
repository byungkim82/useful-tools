# 구현 현황 (Implementation Status)

> **문서 성격:** 2026-07-17 기준 **실제로 구현·배포되어 라이브인 상태**의 스냅샷. "무엇이 있고, 어디에 있고,
> 어떻게 검증됐는지"의 인덱스다. 세부 설계·전략은 각 짝 문서로 링크한다. **최종 진실은 코드**이며, 이 문서는
> 그 위의 요약 계층이다.

## 0. 한눈에

| | |
|---|---|
| **라이브** | https://tools.solisapps.com |
| **스위트 2종** | QR 생성기 **9종** + 단위 변환기 **8종** = **도구 17개** |
| **로케일** | 6개 — 한국어 · English · Español · Português(BR) · 日本語 · Deutsch (hreflang) |
| **정적 라우트** | **108 URL** = 6 로케일 × (홈 1 + 도구 17) → `sitemap.xml` |
| **스택** | Next.js(App Router) · TypeScript · Tailwind v4 · Vitest |
| **호스팅** | static export(`output:'export'`) → Cloudflare Workers Static Assets · **$0 서버** |
| **분석** | Cloudflare Web Analytics (쿠키리스 beacon) |
| **포지셔닝** | 회원가입 0 · 추적 0 · 100% 클라이언트 · 데이터가 기기를 안 떠남 |

---

## 1. 도구 (Tools)

### 1.1 QR 코드 스위트 — 9종 (라이브)
URL/텍스트 · WiFi · vCard · email · SMS · 전화 · WhatsApp · 위치 · 이벤트.
공유 렌더 엔진(`qr-core`) + 타입별 순수 payload 빌더(단위 테스트) + 개별 SEO 랜딩. 온페이지 SEO·JSON-LD 완비.
→ 상세: **`qr-generator-implementation.md`** (아키텍처·결정·검증), 개선 백로그 `qr-generator-improvements.md`.

### 1.2 단위 변환기 스위트 — 8종 (라이브, 이번에 신규)
카테고리별 slug: `length-converter` · `weight-converter` · `temperature-converter` · `area-converter` ·
`volume-converter` · `speed-converter` · `time-converter` · `data-converter`.

**아키텍처 (`src/tools/convert/`):**
- **`units.ts`** — 순수 변환 엔진. 카테고리별 기준단위-팩터 맵, 온도는 섭씨 피벗 아핀 변환, **로케일 숫자
  파서**(`Intl`에서 구분자 도출 → DE "1.234,5"→1234.5) + 포맷터. **전통단위 내장**: 평/坪(=400/121 ㎡, 공유
  팩터) · 畳 · 근(다중값 600/375g) · 돈/匁(3.75g) · 貫/斤 · 자/치·尺/寸 · 合/升 · 요리 컵(US 240·metric 250·JP 200mL).
- **`units.test.ts`** — 47개 유닛테스트(전통단위 팩터·온도 −40 교차·SI/IEC·로케일 파싱·에러/역변환).
- **`Converter.tsx`** — 멀티타깃 위젯: 값 + 기준단위 → 그 카테고리의 **모든 단위 동시 변환** + 행별 복사. `ssr:false`.
- **`labels.ts`** — 단위·카테고리·UI chrome 라벨 + slug 매핑을 **코드에** 보관(QrTypeNav 철학). 로케일 오버라이드로
  같은 unit id가 ko=평 / ja=坪 렌더. → 그래서 로케일 JSON은 **SEO 블록만** 갖는다.
- **`ConverterClient.tsx`** — 8개 slug가 공유하는 단일 클라이언트, slug→category 도출.
- **`ConverterTypeNav.tsx`** — 카테고리 전환 네비(그룹 `converter`).

**결정(리서치 기반):** 페이지 구조 = **카테고리별 slug**(공유 엔진 + 프리셋) · 전통단위 = **전 로케일 노출** ·
환율/FX·신발·의류 사이즈 = **범위 밖(v1)**. → 근거: **`unit-converter-research.md`**.

---

## 2. 다국어 (i18n)
- `src/i18n/` — 6개 로케일 dictionary. **`Dictionary` = 모든 로케일 JSON의 교집합** → 모든 도구는 전 로케일에
  구조적으로 동일하게 존재(타입이 강제 + `scripts/check-i18n.mjs`가 검사).
- 도구 SEO 카피는 로케일별로 번역(EN·KO 원작성, es·pt·ja·de는 병렬 번역). 단위/카테고리/UI 라벨은 코드 라벨 맵.
- hreflang·`<html lang>`·OG locale·로케일 스위처·사이트맵은 `locales`/`localeMeta`에서 자동.

## 3. SEO / 검색 발견성
- 도구별 전용 랜딩 + 키워드 튜닝 `metaTitle`/`metaDescription`(H1과 분리) + 크롤 가능한 사용법·특징·FAQ 정적 텍스트.
- **JSON-LD**: 전 도구 페이지에 `WebApplication` + `FAQPage`(화면 FAQ와 일치).
- `sitemap.xml`(108 URL, hreflang alternates) · `robots.txt` · OG 이미지(`og.png`) · Google Search Console 등록.
- → 전략: **`qr-generator-growth-seo.md`**, 체크리스트 `qr-generator-seo-action-checklist.md`.

## 4. 분석 (Analytics)
- Cloudflare Web Analytics **beacon**(`layout.tsx`, `CF_BEACON_TOKEN` 있을 때만 주입, `type="module" defer`).
- `public/_headers` CSP가 beacon 도메인 허용(`static.cloudflareinsights.com` 스크립트 · `cloudflareinsights.com` 전송).
- 쿠키리스·개인추적 없음 → 프라이버시 포지셔닝과 정합. 대시보드에서 hostname `tools.solisapps.com` 필터 + GSC 병행.

## 5. 아키텍처 / 호스팅 / 규약
- **static export → Cloudflare Workers Static Assets**(`wrangler.jsonc`), 서버 로직 0, $0.
- 도구 DOM은 `next/dynamic({ssr:false})` **client island**(정적 HTML에서 제외 — WASM/Canvas/브라우저 API 얹기 좋음).
- 배포: **`pnpm run deploy`** (⚠️ `pnpm deploy` 아님 — 워크스페이스 빌트인이 스크립트를 가림). preview도 `pnpm run preview`.
- 도구 추가 규약: 순수 로직(+Vitest) → client island → `registry.ts` 엔트리 → 네비/홈그리드 → 전 로케일 dict.
  → **`.claude/skills/extend-tools/`**. 프레임워크 코드 전 `node_modules/next/dist/docs/` 확인(`AGENTS.md`).

## 6. 검증 로그 (verify, don't claim)
최신 배포(단위 변환기) 기준 실제 실행·확인:
- ✅ `pnpm test` — 47 통과 · `pnpm lint` 클린 · `pnpm build` 성공 · `check-i18n.mjs` **ALL GOOD**.
- ✅ `out/` 검사 — 48개 컨버터 페이지, 키워드 title/meta, JSON-LD, 정적 FAQ, **`ssr:false` 확인**(위젯 내부가
  정적 HTML에 없음), 타입네비, 홈 카드, **sitemap 108**.
- ✅ 헤드리스 Chrome(로컬 + **라이브 프로덕션**) — 위젯 마운트, ko `평 (3.31 m²)` / ja `坪 (3.31 m²)`(로케일
  오버라이드), 한국어 chrome.
- ✅ 라이브 6개 로케일 컨버터 페이지 200.

## 7. 문서 인덱스
- `qr-generator-implementation.md` — QR 아키텍처·결정·검증
- `qr-generator-improvements.md` — QR 기능/UX 백로그
- `qr-generator-growth-seo.md` · `qr-generator-seo-action-checklist.md` — 유입/SEO 전략·체크리스트
- `tool-roadmap.md` — 다음 추가 도구(6로케일 리서치 → 소비자용 우선 백로그)
- `unit-converter-research.md` — 단위 변환기 리서치(기능·수요·로케일 단위·UI/UX)
- `monetization-strategy.md` — 다국어 트래픽 수익화(단/중/장기 + AI 티어)

## 8. 미구현 / 다음 (What's next)
- **로드맵 도구**(미착수, `tool-roadmap.md` 순서): 이미지 압축 → HEIC 변환 → PDF 합치기/분할 → 이미지↔PDF →
  PDF 압축 → 배경 제거 → (KO 특화) 평↔㎡·만나이 → 개발자용(JWT·hash·base64·JSON·UUID).
- **QR Tier 2/3**(미착수): 디자인 깊이(`qr-code-styling`)·대량 CSV→ZIP·디코드 QA·QR 리더.
- **단위 변환기 v1 이후**: 신발/의류 사이즈(검증 소스 필요) · 공유 가능한 URL 상태 · from/to swap(현재 멀티타깃만) ·
  和暦↔西暦(JA, 미확인) · 실제 검색량 순위 반영(GSC).
- **성장/수익화**: 네이티브 번역 검수 · 커뮤니티 런칭/백링크 · 네이버 등록 · 수익화 레버(제휴/Pro/AI) 착수.
