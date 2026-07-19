# 구현 현황 (Implementation Status)

> **문서 성격:** 2026-07-18 기준 **실제로 구현·배포되어 라이브인 상태**의 스냅샷(최신: 이미지 압축기 v1). "무엇이 있고, 어디에 있고,
> 어떻게 검증됐는지"의 인덱스다. 세부 설계·전략은 각 짝 문서로 링크한다. **최종 진실은 코드**이며, 이 문서는
> 그 위의 요약 계층이다.

## 0. 한눈에

| | |
|---|---|
| **라이브** | https://tools.solisapps.com |
| **스위트 3종** | QR 생성기 **9종** + 단위 변환기 **8종** + 이미지 압축기 **3종** = **도구 20개** |
| **로케일** | 6개 — 한국어 · English · Español · Português(BR) · 日本語 · Deutsch (hreflang) |
| **정적 라우트** | **126 URL** = 6 로케일 × (홈 1 + 도구 20) → `sitemap.xml` |
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
- **`units.test.ts`** — 26개 유닛테스트(전통단위 팩터·온도 −40 교차·SI/IEC·로케일 파싱·에러/역변환).
- **`Converter.tsx`** — 멀티타깃 위젯: 값 + 기준단위 → 그 카테고리의 **모든 단위 동시 변환** + 행별 복사. `ssr:false`.
- **`labels.ts`** — 단위·카테고리·UI chrome 라벨 + slug 매핑을 **코드에** 보관(QrTypeNav 철학). 로케일 오버라이드로
  같은 unit id가 ko=평 / ja=坪 렌더. → 그래서 로케일 JSON은 **SEO 블록만** 갖는다.
- **`ConverterClient.tsx`** — 8개 slug가 공유하는 단일 클라이언트, slug→category 도출.
- **`ConverterTypeNav.tsx`** — 카테고리 전환 네비(그룹 `converter`).

**결정(리서치 기반):** 페이지 구조 = **카테고리별 slug**(공유 엔진 + 프리셋) · 전통단위 = **전 로케일 노출** ·
환율/FX·신발·의류 사이즈 = **범위 밖(v1)**. → 근거: **`unit-converter-research.md`**.

### 1.3 이미지 압축기 스위트 — 3종 (라이브, 이번에 신규)
slug: `image-compressor`(primary·자동 포맷) · `compress-jpg` · `compress-webp`. **100% 브라우저 배치 압축** —
드롭 → **대기열(자동 변환 X)** → 전역 설정 → **[압축 시작] 버튼** → before/after 통계(완료 요약 강조) →
파일별 다운로드 + ZIP. 서버 업로드 0. 비이미지 드롭은 "건너뜀" 안내.

**아키텍처 (`src/tools/image/`):**
- **`compress-math.ts`** — 순수: 리사이즈 치수계산(최대치수/%/정확·비율잠금·오버사이즈 클램프)·바이트 포맷·%
  절감·출력 파일명·프리셋→품질·slug→기본포맷·`auto` 포맷 해석. **`queue-reducer.ts`** — 순수 배치 상태머신
  (전이·cancel·requeue) + **적응형 동시성**(픽셀면적 휴리스틱, iOS jetsam 방어). **`zip-store.ts`** — 순수
  store-only ZIP + CRC32(의존성 0, "모두 받기"). → **`compress-math.test.ts` 44개 유닛테스트**.
- **`encode.ts`** — 브라우저 인코드: `createImageBitmap({imageOrientation:'from-image'})`(EXIF 방향 보정 +
  메타데이터 제거) → `OffscreenCanvas`/canvas → `convertToBlob`. WebP 인코딩 feature-detect → JPEG 폴백.
- **워커**: `compress.worker.ts`(TS) → **`scripts/build-worker.mjs`(esbuild)**가 self-contained
  `public/workers/compress.js`로 번들 → export가 `out/workers/`로 복사(same-origin `.js`, 올바른 MIME).
  **이유: `output:'export'`+Turbopack은 import 있는 워커를 번들 안 하고 raw `.ts`를 에셋 복사만 함**(스파이크가
  self-contained `.js`라 A1을 거짓 통과시켰던 지점). `runner.ts`가 워커/메인스레드 폴백을 투명 처리.
- **`useCompressQueue.ts`** — 리듀서를 워커·타이머·objectURL 해제에 배선(렌더는 state에서만 파생). UI:
  `ImageCompressorClient`(3 slug 공유) + `DropZone`/`SettingsPanel`/`QueueItem` + `ImageTypeNav`(포맷 전환).
- **라벨은 코드 맵(`labels.ts`, 6로케일)**, 로케일 JSON은 SEO 블록만.

**조용한-실패 방어(3종):** ① **면적 클램프**(`safeMaxArea` — 변뿐 아니라 총 픽셀도 제한, 모바일/저메모리 보수적)
→ iOS 캔버스 면적 초과 시 빈 이미지 대신 다운스케일+배지. ② **출력 검증**(그린 뒤 빈 캔버스 감지 → 깨진 "가짜
성공" 대신 실패 표시; 균일 이미지는 오탐 없이 예외). ③ **잡 타임아웃**(45s 무응답 → 무한 스피너 대신 실패).

**결정:** v1 = 날카로운 척추(JPEG·WebP 출력만, **PNG는 입력 전용**) · **EXIF는 항상 제거**(canvas 재인코딩이
전제 — "keep EXIF" 토글은 이중회전 리스크로 v1.1) · CSP 델타 = **`img-src blob:` 하나뿐**(same-origin 워커는
`default-src 'self'`가 커버). → 근거·결정로그: **`image-compressor-plan-ko.md`** / `-en.md`, 리서치
`image-compressor-research.md`.

**v1.1 추가 (진행 중):**
- **① 타깃 파일 크기 (라이브)** — 설정에 "목표 파일 크기(KB)" 토글. 켜면 **`compress-core.ts`(순수 이진탐색)**가
  품질을 [0.4, 0.95]에서 이진탐색해 **목표 이하 최고 품질**을 찾고, 최저 품질로도 초과하면 **치수를 단계적으로 다운스케일**
  (0.8배 × 최대 5단계, 64px 바닥)해 재시도. 목표를 못 맞추면 결과에 **`approximated` 플래그**(가장 근접) → 배지 고지.
  타깃 ON이면 품질/프리셋 컨트롤은 비활성(품질을 자동 결정). `encode.ts`가 디코드 1회 후 같은 캔버스에서 재인코딩
  (효율), 워커/메인스레드 폴백 동일 경로. 유닛테스트 5개(수렴·경계·근사·인코드콜 바운드) + **헤드리스 실왕복 검증**
  (100KB→99.96KB·30KB→29.66KB·5KB→근사, 치수 다운스케일 작동). 상태머신엔 `iterating`/`approximated` 상태를
  추가하지 않고 **성공 결과의 플래그**로 처리(= `downscaled`와 동일 패턴, 리듀서 전이 단순 유지).
- **② 이미지별 오버라이드 (라이브)** — 각 큐 아이템의 ⚙ 버튼이 **접이식 개별 설정 편집기**(`SettingsPanel` compact
  재사용, `showTitle`/`bare` prop)를 열고, 편집하면 그 이미지에 **완전한 Settings 스냅샷 오버라이드**가 생김(부분 병합
  복잡도 회피, 없으면 전역 사용). hook은 단일 `Settings` 대신 **잡별 리졸버 `(id)=>Settings`**를 받도록 바꿔 최소 침습
  (`compressAll(resolve)`·`recompress(resolve, ids)`). 오버라이드된 done 잡은 `appliedFor`(출력 생성 시점 설정)와
  현재 유효 설정이 달라지면 **dirty**로 감지 → 행별 `↻` + 전역 "다시 압축(N)"이 dirty만 재인코딩. `custom` 배지 ·
  "기본값으로" 초기화 · remove/clear 시 오버라이드/appliedFor 정리. **헤드리스 실 UI E2E**: 같은 6.5MB 소스 2장 →
  a.png만 타깃 20KB 오버라이드 → **a=20.0KB / b=926.6KB**(이미지별로 다른 EncodeRequest 라우팅 확인), 회귀 0.
- **③ 유스케이스 프리셋 (라이브)** — 설정 상단 "용도별 최적화" 칩 4종(공통, 전 로케일·라벨만 번역): **WhatsApp**(≤100KB·
  1600px) · **이메일 첨부**(≤300KB·2048px) · **웹/블로그**(≤200KB·1920px WebP) · **증명사진**(≤200KB·**413×531 정확 크롭**).
  칩 1클릭이 format+resize+target을 한 번에 세팅(`applyUsePreset` 순수·전역/이미지별 편집기 공용). 증명사진용 **`exactCrop`
  리사이즈 모드 신규**(`planCrop`: cover 스케일 → 중앙 크롭 → 정확한 W×H, 캔버스 상한 클램프). `encode.ts`가 crop
  소스 사각형을 `drawImage`로 샘플(타깃 경로도 crop 유지). 프리셋 데이터·`Settings` 타입은 `compress-math.ts`로 이동해
  순수 테스트 가능(hook은 재export). 유닛테스트 6개(planCrop 3·applyUsePreset 3) + **실 UI E2E**(ID사진 칩→413×531
  jpeg 130KB·WhatsApp→99,968B≤100KB).
- **④ Ctrl+V / 폴더 업로드 (라이브)** — 클라이언트가 **document 레벨 `paste` 리스너**(ref로 최신 핸들러 고정, 한 번만
  구독)로 클립보드 이미지(`clipboardData.items` 중 `image/*`)를 File로 추출해 기존 `addFiles`로 투입(스크린샷 워크플로).
  DropZone에 **`webkitdirectory` 폴더 인풋**(속성은 ref로 명령형 설정 — React prop 타입에 없음) + "폴더 선택" 버튼 +
  붙여넣기 힌트. 비이미지는 기존 필터가 걸러냄. **실 UI E2E**: 합성 ClipboardEvent 붙여넣기 → pasted.png 큐 행 추가·
  폴더 인풋 `webkitdirectory` 확인.

---

## 2. 다국어 (i18n)
- `src/i18n/` — 6개 로케일 dictionary. **`Dictionary` = 모든 로케일 JSON의 교집합** → 모든 도구는 전 로케일에
  구조적으로 동일하게 존재(타입이 강제 + `scripts/check-i18n.mjs`가 검사).
- 도구 SEO 카피는 로케일별로 번역(EN·KO 원작성, es·pt·ja·de는 병렬 번역). 단위/카테고리/UI 라벨은 코드 라벨 맵.
- hreflang·`<html lang>`·OG locale·로케일 스위처·사이트맵은 `locales`/`localeMeta`에서 자동.

## 3. SEO / 검색 발견성
- 도구별 전용 랜딩 + 키워드 튜닝 `metaTitle`/`metaDescription`(H1과 분리) + 크롤 가능한 사용법·특징·FAQ 정적 텍스트.
- **JSON-LD**: 전 도구 페이지에 `WebApplication` + `FAQPage`(화면 FAQ와 일치). 이미지 도구는 **`HowTo` 추가**.
- `sitemap.xml`(126 URL, hreflang alternates) · `robots.txt` · OG 이미지(`og.png`) · Google Search Console 등록.
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
최신 배포(이미지 압축기) 기준 실제 실행·확인:
- ✅ **[v1.1 ④ Ctrl+V / 폴더 업로드]** test 102·lint·build·check-i18n 클린 · **CDP 실 UI E2E**: 합성 ClipboardEvent
  붙여넣기 → "pasted.png" 큐 행 추가 확인 · 폴더 인풋에 `webkitdirectory` 설정됨(파일/폴더 인풋 2개) 확인.
- ✅ **[v1.1 ③ 유스케이스 프리셋]** test 102(+6: planCrop·applyUsePreset)·lint·build·check-i18n 클린 · 워커 번들에
  crop 로직 포함 · **CDP 실 UI E2E**: ID사진 칩 클릭 → 패널이 exactCrop·413×531·jpeg·타깃 200KB 반영 확인 + 페이지에서
  실제 encode 모듈 import → **크롭 출력 정확히 413×531 jpeg(130KB)**·WhatsApp 프리셋 **99,968B≤100KB**.
- ✅ **[v1.1 ② 이미지별 오버라이드]** test 96·lint·build·check-i18n 클린 · **CDP 실 UI E2E**(Node 22 WebSocket로
  헤드리스 Chrome 구동, 프로덕션 CSP로 out/ 서빙): 같은 6.5MB 소스 2장 주입 → a.png ⚙로 타깃 20KB 오버라이드 →
  전역 압축 → **a=20.0KB(custom 배지·자동 리사이즈)·b=926.6KB(-86%)** → 이미지별 다른 EncodeRequest 확인·배치 회귀 0.
- ✅ **[v1.1 ① 타깃 파일 크기]** `pnpm test` **96 통과**(+5 타깃 이진탐색: 천장 즉시 채택·최고 적합 품질·근사
  fits:false·커스텀 경계·인코드콜 바운드) · lint/build/check-i18n 클린 · 워커 번들에 타깃 로직 포함(자체완결 JS, bare
  import 0) · **헤드리스 실왕복**(메인스레드 `encodeImage` = 워커 동일 함수, 1600² 노이즈 소스): 100KB→99,962B ·
  30KB→29,662B(둘 다 목표 아래, 치수 자동 다운스케일 작동) · 5KB→16,738B `approximated`(근접 처리·배지) · 무타깃 대조군 정상.
- ✅ `pnpm test` — **91 통과**(이미지 순수 로직 신규: math·큐리듀서·zip·면적클램프·타임아웃) · `pnpm lint` 클린 · `pnpm build` 성공 · `check-i18n.mjs` **ALL GOOD**.
- ✅ `out/` 검사 — 3개 이미지 페이지, 키워드 title/meta, JSON-LD(**WebApplication+FAQPage+HowTo**), **`ssr:false`
  확인**(`name="img-source"` 마커가 정적 HTML에 없음), 홈 카드 1장(primary만), ImageTypeNav 형제 링크, **sitemap 126**.
- ✅ **워커 번들 검증** — `out/workers/compress.js`가 self-contained JS(bare import 0, TS 구문 0), 런타임이
  `/workers/compress.js` 참조, raw `.ts`는 out/에 없음.
- ✅ **헤드리스 Chrome 실압축 왕복**(프로덕션 CSP로 `out/`+라이브 서빙) — 아일랜드 마운트, PNG 드롭 → [압축 시작] →
  **-98% 압축**(auto PNG→WebP), **Web Worker 실제 로드**(논-잰크 경로 활성), **CSP 위반 0**, 페이지 에러 0.
- ✅ **UX 흐름**(라이브) — 드롭은 대기열만 채움(자동 변환 X), [압축 시작 (N)] 눌러야 처리, 완료 요약 강조, 비이미지 "건너뜀" 안내.
- ✅ **안전장치**(라이브) — 면적 클램프(12MP→1MP cap, 배지) · 균일 이미지 오탐 없음 · 빈-이미지 감지 알고리즘 · 타임아웃 유닛테스트.
- (이전 배포) 단위 변환기: 26 테스트, sitemap 108→126, ko/ja 전통단위 로케일 오버라이드 — 라이브 확인 완료.

## 7. 문서 인덱스
- `qr-generator-implementation.md` — QR 아키텍처·결정·검증
- `qr-generator-improvements.md` — QR 기능/UX 백로그
- `qr-generator-growth-seo.md` · `qr-generator-seo-action-checklist.md` — 유입/SEO 전략·체크리스트
- `tool-roadmap.md` — 다음 추가 도구(6로케일 리서치 → 소비자용 우선 백로그)
- `unit-converter-research.md` — 단위 변환기 리서치(기능·수요·로케일 단위·UI/UX)
- `monetization-strategy.md` — 다국어 트래픽 수익화(단/중/장기 + AI 티어)

## 8. 미구현 / 다음 (What's next)
- **이미지 압축기 v1.1** (순서대로 진행 중): ✅ **① 타깃 파일 크기** · ✅ **② 이미지별 오버라이드** · ✅ **③ 유스케이스
  프리셋** · ✅ **④ Ctrl+V/폴더**(넷 다 완료·라이브, §1.3) → ⑤ 비교 슬라이더. **v1.5**: AVIF 출력(jSquash 지연 +
  `wasm-unsafe-eval`) · PNG 출력 + oxipng (+`compress-png` slug) · PWA/오프라인. → `image-compressor-plan-ko.md` 스코프 표.
- **로드맵 도구**(미착수, `tool-roadmap.md` 순서): HEIC 변환 → PDF 합치기/분할 → 이미지↔PDF → PDF 압축 →
  배경 제거 → (KO 특화) 평↔㎡·만나이 → 개발자용(JWT·hash·base64·JSON·UUID).
- **QR Tier 2/3**(미착수): 디자인 깊이(`qr-code-styling`)·대량 CSV→ZIP·디코드 QA·QR 리더.
- **단위 변환기 v1 이후**: 신발/의류 사이즈(검증 소스 필요) · 공유 가능한 URL 상태 · from/to swap(현재 멀티타깃만) ·
  和暦↔西暦(JA, 미확인) · 실제 검색량 순위 반영(GSC).
- **성장/수익화**: 네이티브 번역 검수 · 커뮤니티 런칭/백링크 · 네이버 등록 · 수익화 레버(제휴/Pro/AI) 착수.
