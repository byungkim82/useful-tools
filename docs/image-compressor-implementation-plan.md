# 이미지 압축기 — 세부 구현 계획

> **문서 성격:** 로드맵 Tier 1 #1 "이미지 압축/리사이즈"의 **구현 계획**이다. 아직 코드는 안 건드렸다(구현 착수
> 전). 근거는 짝 문서 **`image-compressor-research.md`**(경쟁·기술·편의·로케일 조사). 실행 규약은
> **`.claude/skills/extend-tools/`**. 이 문서는 "**기존 아키텍처를 지키면서** 무엇을·어떤 파일로·어떤 라이브러리·
> 어떤 인프라 변경·어떤 순서로·무엇을 검증하며 짓나"의 판단 계층이다.
>
> **⚠️ 대전제(AGENTS.md):** "This is NOT the Next.js you know." 착수 시 `node_modules/next/dist/docs/`의 해당
> 가이드(정적 export·`next/dynamic`·워커/import.meta.url)를 먼저 읽는다. 라이브러리·워커 도입은 반드시
> `output:'export'` 빌드에서 실제 동작 검증(verify, don't claim).

---

> ## 🔎 rev — 시니어 아키텍트 리뷰 반영 (2026-07-18)
> 착수 전 이 계획을 코드베이스·Next 16 문서에 대해 공격적으로 리뷰하고 아래를 반영했다. **미반영 원안은 §부록 뒤가
> 아니라 이 배너가 최종 결정이다.**
>
> 1. **[HIGH] 워커-in-static-export는 오픈퀘스천이 아니라 P0 스파이크로 승격**(§11 P0-a, §12 #1). Next 16.2.10은
>    `next build`가 **Turbopack 기본**(빌드 스크립트에 `--webpack` 없음)이고, 이 repo엔 워커 선례가 0개다.
>    `new Worker(new URL(..,import.meta.url))`(A1)의 export emit은 미보장. **단 `public/workers/compress.js` 바닥(A2)이
>    번들러 무관 same-origin 서빙을 보장**(카운터리뷰 건설적#1)하므로 "논-잰크 배치" **가치 자체는 안 걸린다** — 원래
>    [BLOCKING]이라 썼던 걸 [HIGH]로 정정. 스파이크는 **A1(번들·최고 DX) vs A2(public·자체완결 JS)**를 정할 뿐. 그래도
>    엔진 절 문구가 이 결과에 달려 있어 **다른 어떤 코드보다 먼저** 판정한다.
>    **✅ 2026-07-18 스파이크 실행: A1 통과** — export에서 same-origin 청크로 emit, `worker-src` 없는 현재 CSP로
>    로드·왕복 OK → **A1 채택, P0-a 클로즈**(상세 §11 결과·D9). **워커엔 CSP 변경조차 불필요**로 확인됨(§9.1·D7).
> 2. **[결정] v1 스코프를 날카로운 척추로 축소**: 단일→배치 + 품질/포맷/리사이즈 + ZIP + EXIF제거만 v1.
>    **이미지별 오버라이드·타깃 KB/MB·Ctrl+V/폴더·비교 슬라이더는 v1.1로 이동**(§1). 이유: 복잡도 최대 승수
>    (오버라이드=상태·UI·재인코딩 트리거 곱연산)이고, 리서치 §5는 이들을 table-stake가 아닌 "high-value if
>    possible"로 분류했다. **⚠️ 이에 따라 §5.2 타깃크기 루프·§7 타깃크기 수렴 테스트는 v1.1 스펙으로 재분류된다.**
> 3. **[결정] PNG 출력·slug 모두 v1.5로 미룸(카운터리뷰 잔여#1 반영)**: canvas PNG 재인코딩은 oxipng가 아니라
>    크기를 못 줄이거나 오히려 키우고, `toBlob('image/png', quality)`의 quality는 **무시**된다 → v1에서 PNG 출력을
>    남기면 슬라이더가 inert이고 파일이 커지는 사고. slug만 미루고 출력 포맷에 PNG를 남긴 건 모순이었다.
>    **v1 출력 = JPEG·WebP만**(PNG는 입력 전용), **v1 slug = `image-compressor`+`compress-jpg`+`compress-webp` 3개**.
>    PNG 출력·slug·oxipng는 v1.5에 한 게이트로 함께 복귀(§1·§6·§8.1 갱신).
> 4. **[정확성 계약] compress-core / encode 계약에 3개 분기 명시**(§5.2·§12): ① 출력 포맷에 quality 축이 없으면
>    (PNG) 타깃크기는 dimension-search 전용 · ② "타깃 미달성 근사 수용" 상태를 상태머신에 추가(§5.1) · ③ canvas
>    최대면적 초과 자동 다운스케일은 **말없이 하지 말고** 사용자에게 배지로 고지. (①③은 리사이즈가 v1이라 v1 계약,
>    타깃크기 관련은 v1.1.)
> 5. **[정확성·저확률] WebP 인코딩 feature-detect(2줄, 비블로킹)**: 실패 모드는 AVIF와 같으나 **확률은 딴판**이다
>    — Safari는 수년 전부터 canvas WebP 인코딩을 지원해 조용한-PNG-폴백 꼬리가 아주 얇다(카운터리뷰 캘리브레이션
>    반영). 1px 인코딩 후 `blob.type` 확인은 값싸서 P0-a에 얹지만, **BLOCKING 게이트는 워커 스파이크 하나뿐** —
>    WebP 실패는 JPEG로 폴백하면 그만이라 P1 가드로 충분하다.
> 6. **[메모리] 적응형 동시성**: "순차 또는 2–3장"은 등가가 아니다. 대용량/모바일에선 동시성 1로 떨궈야 iOS jetsam
>    (~200–400MB)을 피한다. `navigator.deviceMemory`/픽셀면적 휴리스틱으로 동시성을 자동 조정(§5.1).
> 7. **[포지셔닝] "무제한" 정직화**: canvas 최대면적(iOS 4096²/8192²)·OOM 때문에 *치수*는 무제한이 아니다.
>    히어로는 "업로드 없음 · 개수 제한 없음"으로 프레이밍하고 우아한 열화 UX를 v1에 정의(§6·§8.3).
> 8. **[i18n] 로케일 프레이밍 ↔ 구조동일 불변식 충돌 해소**: `check-i18n`이 `faq[]`/`features[]` **배열 길이 동일**을
>    강제하므로, 로케일 고유 각도(DE DSGVO·BR WhatsApp)는 **`metaTitle`/`metaDescription`에만** 싣고 배열 콘텐츠는
>    6로케일 동형 유지(§8.3). per-locale 배열 분기는 인프라 선결 → v1 밖.
> 9. **[사소] 폴백 라이브러리는 `dependency`다**(§9.2): browser-image-compression는 런타임 라이브러리 →
>    `devDependency` 아님. 비교는 throwaway 브랜치에서, 조건부 import의 tree-shaking 탈락을 확인.
> 10. **[사소] 자동 방향보정은 크로스브라우저 실검증 항목**(§10): `createImageBitmap(..,{imageOrientation})`은
>     구형 Safari가 무시했고 이중회전 위험 — "네이티브 처리"로 가정 금지. `build-404.mjs`가 신규 slug을 덮는지도 확인.
>
> *(카운터리뷰(2차)의 5개 지적 — 잔여#1 PNG 출력·잔여#2 큐 순수화·잔여#3 드리프트·클래식워커 탈출구·deviceMemory
> 픽셀면적 1차 — 는 위 항목 1·3·5·6과 결정로그 D9–D13, 그리고 본문에 반영 완료. 별도 rev2 블록은 중복이라 접음.)*

---

## 0. 요약 — v1에서 짓는 것

**한 문장(v1):** 100% 브라우저에서 도는 **폴리시드 배치 이미지 압축기** — 드롭 → 큐(전역 기본설정) → 품질/포맷/
리사이즈 → before/after 통계 → 파일별 다운로드 + ZIP. 서버 업로드 0, 헤더 격리 0(=beacon 보호), 프라이버시 "증명"
표면 포함. 6로케일 SEO 랜딩. (**이미지별 오버라이드·타깃크기·유스케이스 프리셋은 v1.1** — §1.)

**엔진:** **Canvas 우선**(`createImageBitmap` + `OffscreenCanvas.convertToBlob`), **필요 시 WASM 지연로드**.
COOP/COEP 불필요. 유일 필수 인프라 변경 = CSP `img-src`에 `blob:` 추가.

**빈틈 공략(리서치 §3.3):** *클라이언트 + 무광고 + 무제한 + 폴리시드 배치*를 동시에 — 아무도 못 가진 조합.
+ **타깃 파일 크기**(대형 브랜드 전무) + **프라이버시 증명**.

---

## 1. 스코프 결정 (v1 in / out)

> **rev 반영:** 아래 표는 "날카로운 척추" 결정으로 갱신됨. **v1.1 이동분은 OUT 열에 `(v1.1)`로 명시**. 원안 대비
> 변경: 타깃크기·이미지별 오버라이드·Ctrl+V/폴더·비교슬라이더 → v1.1, `compress-png` slug → v1.5.

| 영역 | v1 IN | v1 OUT (→ 후속) |
|---|---|---|
| 입력 | 드래그드롭·파일피커·시작 후 추가; JPG/PNG/WebP(+브라우저 디코드 가능 포맷) | **Ctrl+V·폴더 업로드(v1.1)** · HEIC 입력(**별도 도구**, libheif) |
| 출력 포맷 | **JPEG·WebP** (canvas 네이티브; WebP는 인코딩 feature-detect + JPEG 폴백) · **PNG는 입력 전용** · 알파 입력은 WebP로 스티어(JPEG는 투명도 평탄화 경고) | **PNG 출력(v1.5, oxipng와 함께)** · **AVIF**(jSquash, v1.5) · JXL(스킵) |
| 압축 제어 | 프리셋(고화질/균형/최소, 슬라이더 동기) **+** 품질 슬라이더 · 리사이즈(최대치수/%/정확WxH·비율잠금·**오버사이즈 다운스케일 고지**) | **타깃 KB/MB(v1.1)** · 크로마 서브샘플링 등 전문가 튜닝 · 로시 PNG(pngquant) |
| 배치 | 큐 + **전역 기본설정** · 파일별/총계 통계 · ZIP(fflate) · **적응형 동시성**(디바이스/픽셀면적) | **이미지별 오버라이드(v1.1)** · 재정렬·이름패턴·실패재시도 세분화 |
| 프리뷰 | before/after 크기+% 배지 | **비교 슬라이더(v1.1)** · 줌/팬 |
| 메타데이터 | **EXIF 제거 기본 ON + 자동 방향보정(크로스브라우저 실검증)** · "EXIF 유지" 토글 | — |
| 프라이버시 | "업로드 없음·개수 제한 없음" 히어로 + **"직접 검증"** 섹션 · 무가입/무광고/무워터마크 | PWA/오프라인 설치(v1.5, 증거 강화) |
| 프리셋(유스케이스) | — (전부 v1.1) | **이메일·WhatsApp·증명사진/이력서(KO ≤500KB)·Bewerbungsfoto(DE)(v1.1)** · 전체 소셜 치수셋 |
| SEO slug | `image-compressor`(primary) + `compress-jpg` · `compress-webp` | **`compress-png`(v1.5, oxipng와 함께)** · "to X KB" 전체 사다리(§8) |
| 접근성/테마 | 다크모드·모바일우선·기본 a11y·키보드 | 키보드 단축키 고도화 |

> **유스케이스 프리셋을 v1.1로 뺀 이유:** 프리셋 값 자체는 싸지만, 각 프리셋이 "타깃 KB + 정확 치수"의 조합이라
> **v1.1로 미룬 타깃크기 기능에 의존**한다. 타깃크기가 v1에 없으면 프리셋도 반쪽이므로 함께 v1.1. (고화질/균형/최소
> 3-프리셋은 순수 품질 슬라이더 프리셋이라 v1 유지.)

**명시적 결정:**
- **[HIGH] 엔진 경로는 P0 워커 스파이크 통과 후 확정**(§11 P0-a). A1(번들 워커)이 static export에서 안 서도
  **A2(`public/workers/compress.js`) 바닥이 same-origin 서빙을 보장**하므로 "논-잰크 배치"는 안 무너진다 — 스파이크는
  A1 vs A2 = DX만 정한다. 그래도 엔진 절 문구가 이 결과에 달려 다른 코드보다 먼저 판정.
- **v1 = 날카로운 척추.** 단일→배치 + 품질/포맷/리사이즈 + ZIP + EXIF제거. 이미지별 오버라이드·타깃크기·
  Ctrl+V/폴더·비교슬라이더·유스케이스 프리셋은 **v1.1**. 리서치 §5의 table-stake 집합과 정렬(오버라이드·타깃크기는
  거기서도 "high-value if possible"이지 필수가 아님).
- **HEIC은 v1 밖.** WASM 2.6–6.2MB + 별도 디코더. 로드맵의 다음 도구(HEIC 변환)로 분리, 거기서 HEIC→ImageData
  디코드 후 **이 압축기의 순수 파이프라인을 재사용**하도록 설계한다(재사용 이음새를 §4에서 확보).
- **AVIF은 v1.5.** WebP로 "포맷 업그레이드" 가치를 먼저 증명하고, AVIF은 `@jsquash/avif` 명시적 옵트인
  ("AVIF — 가장 작음, 느림")으로 지연로드. 3.4MB WASM은 절대 초기 번들 금지.
- **`compress-png` slug은 v1.5(oxipng와 함께).** canvas PNG 재인코딩은 크기를 못 줄여 자기 랜딩이 사고 난다.
- **"to X KB" 전체 사다리(15+ slug)는 v1 밖.** slug당 6로케일 dict 블록이 필요(§8). 타깃크기 기능 자체가 v1.1이라
  랜딩 사다리 판단도 자연히 v1.1 이후 GSC 실측으로.

---

## 2. 기존 아키텍처 위에서의 구성 (지켜야 할 불변식)

리서치가 확인했듯 이 도구는 **컨버터 스위트와 동형**이다: 여러 slug가 하나의 공유 client island를 쓰고 slug로
변형을 고른다. 컨버터의 `ConverterClient`(slug→category)를 그대로 본뜬다.

| 레이어 | 기존 패턴 | 이미지 압축기 적용 |
|---|---|---|
| **registry** (`src/tools/registry.ts`) | `ToolMeta` 매핑타입, slug=`keyof Dictionary['tools']`, `group`/`primary`/`load` thunk | `group:'image'`, primary=`image-compressor`, **포맷 서브슬러그 2개(v1: jpg·webp; png는 v1.5)**. `category:'image'`(신규) |
| **client island** (`ToolLoader.tsx`) | `next/dynamic({ssr:false})`, slug 키로 로드 | `import('@/tools/image/ImageCompressorClient')` — **3 slug 공유(v1)** |
| **tool page** (`[slug]/page.tsx`) | SEO 메타 + JSON-LD(WebApplication+FAQPage) + 정적 howTo/features/faq + 그룹별 TypeNav | 그대로 + `group==='image'`이면 `ImageTypeNav`, JSON-LD에 **HowTo 추가** |
| **i18n** | `Dictionary`=전 로케일 교집합, 도구블록 6로케일 구조동일, UI칩=`categories` | `tools.<slug>` **3블록×6로케일(v1)** + `categories.image` 6로케일 |
| **UI 라벨** | 코드 맵(`convert/labels.ts`, `CHROME`) — SEO만 JSON | `src/tools/image/labels.ts`(드롭존·프리셋·버튼·통계 문구, 로케일 오버라이드) |
| **in-tool nav** | `ConverterTypeNav`(그룹 링크, 서버렌더 `<a>`) | `ImageTypeNav`(image 그룹) |
| **home grid** | `homeTools()` = 그룹 primary 1장 | `image-compressor` 카드 1장 |

**절대 어기면 안 되는 2개(extend-tools):**
1. **`Dictionary` = 전 로케일 JSON 교집합** → **3개 도구블록(v1)** + `categories.image`가 **6로케일 전부에
   구조동일**하게 존재. `check-i18n.mjs`가 강제. (dict 블록이 먼저 있어야 registry의 slug 타입이 성립.)
2. **툴 DOM은 `ssr:false`** → 정적 HTML에 없어야 함. 검증 마커는 **DOM 전용**(dict prop 문자열은 RSC flight
   페이로드에 직렬화돼 위양성). QR은 `name="ec-level"` 사용 → **이미지 도구는 파일 인풋에 코드상 하드코딩된
   마커**(예: `<input type="file" name="img-source">` 또는 드롭존 루트 `data-compressor-root`)로 검증(§10).

---

## 3. 라이브러리 & 엔진 결정

### 3.1 엔진 (권장: 자체 Canvas 워커, browser-image-compression은 폴백)
리서치 §4가 확인한 3가지 옵션과 각 CSP 델타:

| 옵션 | 내용 | 번들 | CSP 델타 | 판정 |
|---|---|---|---|---|
| **A. 자체 Canvas 워커**(권장) | `new Worker(new URL('./compress.worker.ts', import.meta.url))` 안에서 `createImageBitmap`(`imageOrientation:'from-image'`)+`OffscreenCanvas.convertToBlob`+타깃크기 루프. 메인스레드 `<canvas>` 폴백(OffscreenCanvas 미지원 구형). | ~0(자체 코드) | `img-src blob:` + `worker-src 'self'` | 동일오리진 워커 → **CDN·blob워커 CSP 마찰 없음**, 논-잰크, EXIF 방향 네이티브 처리 |
| **B. browser-image-compression** | `imageCompression(file,{maxSizeMB,maxWidthOrHeight,onProgress,signal,preserveExif})` | ~13KB gz | 워커 쓰면 `libURL` **자체호스팅** 필수(기본값 jsDelivr는 우리 CSP가 차단) + `worker-src blob:`; 또는 `useWebWorker:false`(메인스레드, 잰크) | **폴백/레퍼런스.** 타깃크기 루프·EXIF 엣지가 하드롤보다 견고 — A가 fiddly하면 채택 |
| **C. jSquash 코덱** | mozjpeg/oxipng/webp/avif WASM, 싱글스레드 폴백 | 코덱별 지연로드 | AVIF/WASM 시 `script-src 'wasm-unsafe-eval'` | **옵트인 고급 경로**(§3.3) — v1 기본 아님 |

**권장 v1:** **A(자체 워커)** — 우리 CSP 철학(외부 오리진 최소화)과 가장 정합하고 헤더 델타가 `img-src blob:` +
`worker-src 'self'`로 최소. `createImageBitmap`이 EXIF 방향·다운스케일을 네이티브로 처리하므로 하드롤 부담이 작다
(리서치 §4.4). A는 **두 하위 경로**를 가진다(§11 P0-a): **A1** `new Worker(new URL(..,import.meta.url))`(번들·최고 DX,
export emit 미보장) / **A2** `public/workers/compress.js`(번들러 무관 same-origin 보장, 자체완결 JS) — **A2 바닥이
있어 워커 자체는 안전**하다. EXIF/다운스케일 엣지가 fiddly하면 **B로 폴백**(비용 ~13KB, **런타임 `dependency`** — 비교는
throwaway 브랜치에서, 미채택 시 tree-shaking 탈락 확인). (타깃크기 이진탐색은 v1.1이라 v1 엔진 비교 변수에서 빠짐.)
→ **A1 확정**(✅ §11 P0-a 스파이크 통과: export에서 same-origin emit·CSP 변경 없이 로드·왕복 OK). **B 폴백 여부는 §12 #2.**

### 3.2 ZIP
**fflate**(~8KB, 스트리밍, 워커 오프로드, 헤더 불요). 이미지는 이미 압축됨 → **store/level 0**. JSZip(95KB) 배제.

### 3.3 지연로드 (초기 번들 방어 = CWV)
- v1: 엔진 A + fflate만. 초기 `ssr:false` island **< ~30KB gz** 목표.
- v1.5 AVIF: `@jsquash/avif`를 **사용자가 "AVIF" 선택 시에만** `import()` — 3.4MB WASM(≈1.5MB brotli), 첫 사용
  다운로드 표시 + `script-src 'wasm-unsafe-eval'` 추가.
- v1.5 고화질 JPEG(mozjpeg `@jsquash/jpeg` 246KB)·PNG 로슬리스 최적화(`@jsquash/oxipng` 160KB)·고화질 리사이즈
  (`@jsquash/resize` 34KB)도 동일하게 옵트인 지연로드.

---

## 4. 파일 구성 (제안)

`src/tools/image/`(컨버터의 `src/tools/convert/`와 대칭). **순수 로직(테스트) ↔ 브라우저 island** 경계를 명확히.

```
src/tools/image/
  compress-math.ts        # 순수(v1): 리사이즈 치수계산(최대치수/%/정확WxH·비율잠금·업스케일 클램프·단계반감 스텝),
                          #        바이트 포맷("1.2 MB"), % 절감, 출력 파일명 생성(foo.png→foo-min.webp),
                          #        프리셋→설정 해석, slug→기본출력포맷·기본프리셋 도출.
  queue-reducer.ts        # 순수(v1): 큐 상태머신 리듀서(전이) + 적응형 동시성 결정(픽셀면적→동시성 N)을 순수
                          #        함수로. 이게 가장 미지수 많은 로직 → fake 인코더/이벤트로 Vitest 커버(카운터리뷰 잔여#2).
  compress-core.ts        # 순수(v1.1): 타깃크기 이진탐색 오케스트레이션(인코더 주입). 출력에 quality 축 없으면
                          #        (PNG) dimension-search 전용, "타깃 이하 최근접" 수용. 타깃크기가 v1.1이라 이 파일도 v1.1.
  compress-math.test.ts   # 순수 함수 유닛테스트: 리사이즈 수학·파일명·포맷·프리셋(v1) + queue-reducer 전이·동시성(v1)
                          #        + compress-core 타깃 수렴 with fake encoder(v1.1).
  encode.ts               # 브라우저: createImageBitmap → OffscreenCanvas/canvas → convertToBlob/toBlob.
                          #        (엔진 B 채택 시 browser-image-compression 래핑) — 순수 아님, island서만 import.
  compress.worker.ts      # 브라우저: 워커 엔트리. encode.ts + compress-core.ts 사용. postMessage 프로토콜.
                          #        ※ 엔진 A가 public/ 클래식 워커로 확정되면 이 파일은 public/workers/compress.js로(§11 P0-a).
  useCompressQueue.ts     # 브라우저 훅(얇은 껍데기): queue-reducer를 워커/타이머/메모리해제에 배선만. 로직은 리듀서에.
  labels.ts               # 코드 라벨맵: 드롭존/프리셋/버튼/통계/토글 문구 + 로케일 오버라이드(convert/labels.ts 방식).
  ImageCompressorClient.tsx  # 'use client' island 루트. slug→기본값(labels), 큐/드롭존/설정패널/결과리스트 조립.
  ImageTypeNav.tsx        # image 그룹 in-tool 네비(ConverterTypeNav 미러).
  components/             # DropZone.tsx, QueueItem.tsx, SettingsPanel.tsx, CompareSlider.tsx, StatBadge.tsx
```

**HEIC 재사용 이음새:** `encode.ts`/`compress-core.ts`는 입력을 `File|Blob|ImageBitmap`으로 받게 설계 → 후속 HEIC
도구가 libheif로 HEIC→ImageBitmap 디코드 후 이 파이프라인을 그대로 호출. libheif는 이 번들에 **넣지 않는다**.

---

## 5. 데이터 모델 & 파이프라인

### 5.1 잡 상태머신 (이미지별)
```
queued → decoding → (resizing) → encoding → done | error | canceled          (v1)
                                       └→ iterating(타깃크기 루프) → done | approximated   (+v1.1)
```
- **전역 설정**(기본, v1): 출력포맷·품질/프리셋·(옵션)리사이즈·EXIF유지. (타깃크기·이미지별 오버라이드는 v1.1.)
- **적응형 동시성(v1):** 1차 신호는 **픽셀면적 휴리스틱**(디코드 W×H×4 바이트 추정) — 대용량/모바일이면 동시성 1로
  떨궈 iOS jetsam(~200–400MB) 방어. `navigator.deviceMemory`는 **Chromium 전용(Safari/FF 없음 — 정작 OOM 타깃인
  iOS Safari가 이 신호를 안 줌)** → 픽셀면적이 주(主), deviceMemory는 Chromium 보너스로만(카운터리뷰 건설적#2 반영).
  각 잡 진행률 + 배치 총계 진행률. 상태머신·동시성 결정은 `queue-reducer.ts`에 순수화(§4·§7).
- **메모리:** 잡 완료 즉시 `bitmap.close()`, 중간 objectURL revoke, 참조 해제. 큰 이미지는 canvas 최대면적 체크 후
  **말없이가 아니라 고지 배지와 함께** 다운스케일(iOS 8192² / 구형 4096² · DPR 반영).
- **상태:** `queued → decoding → (resizing) → encoding → done | error | canceled` (v1). 타깃크기 도입(v1.1) 시
  `iterating`(루프)과 **`approximated`(타깃 미달성 근사 수용)** 상태 추가.

### 5.2 타깃크기 루프 (compress-core.ts, 순수) — **v1.1**
디코드 1회 캐시 → 품질 `[0,1]` 이진탐색(6–8회), "타깃 이하 최근접" 수용, 최소품질 바닥 도달 시 **치수 다운스케일
폴백**. **WebP는 libwebp `target_size` 있으면(엔진 C) 한 방** — v1 canvas 경로에선 이진탐색 사용. 인코더를 인자로
주입해 **fake 인코더로 수렴 로직만 유닛테스트**(브라우저 없이).

### 5.3 출력
파일별 다운로드(`<a download href=blob:>`) + **ZIP 일괄**(fflate). 원본명 유지 + 접미사(예: `photo-min.webp`).
다운로드 후 objectURL revoke.

---

## 6. UI/UX 설계 (리서치 §2 3박자 채택)

```
┌─ H1 + 설명(SEO) + ImageTypeNav(포맷 전환 칩) ───────────────────────┐
│ ① DropZone: "여기에 이미지를 놓거나 선택" · 시작후 추가           (Ctrl+V·폴더=v1.1) │
│ ② SettingsPanel(전역 기본): [프리셋 버튼(고화질/균형/최소)] ↔ 품질 슬라이더 │
│    · 출력포맷(JPEG/WebP) · 리사이즈(선택) · EXIF유지 토글      (타깃크기=v1.1) │
│ ③ QueueItem[]: 썸네일 · 원본→압축 크기 · "-68%" 배지          (이미지별 오버라이드=v1.1) │
│    · 파일별 다운로드 · 제거                                  (CompareSlider=v1.1) │
│ ④ 액션바: [모두 다운로드 ZIP] [전체 지우기] · 총계 "12.4 MB → 3.1 MB (-75%)" │
└──────────────────────────────────────────────────────────────────┘
정적(SEO): howTo(3–4단계) · features · "직접 검증하기" 트러스트 · FAQ
```
> **v1 스케치.** 괄호의 `=v1.1`은 이번 스코프 컷으로 뒤로 뺀 표면 — §1과 일치(배너-본문 드리프트 방지).
> 출력포맷에 PNG 없음(입력 전용), 품질 슬라이더는 JPEG/WebP에서만 활성(PNG였다면 inert이라 애초에 v1 출력에서 빠짐).
- **프리셋+슬라이더 동시**(리서치 §2.3) — 프리셋 버튼이 슬라이더도 이동.
- **모바일 우선**(WhatsApp/증명사진 사용자가 모바일) · **다크모드**(기존 Tailwind 패턴) · **기본 a11y**(role/aria,
  라이브영역으로 진행률, sr-only 라벨 — 기존 Spinner/Converter 관례).
- 라이브 재인코딩(슬라이더 조작 시 대표 1장 즉시 갱신)은 딜라이트지만 배치 성능과 트레이드 → v1은 "적용" 버튼
  기반, 라이브 프리뷰는 대표 이미지 1장으로 제한(과열 방지).

---

## 7. 순수 로직 & 테스트 경계 (repo 관례)

**Vitest로 커버(브라우저 불요, v1):** ① `compress-math.ts` 전부 — 리사이즈 치수계산(최대치수/%/정확·비율잠금·
업스케일 클램프·단계반감·오버사이즈 클램프), 바이트 포맷, % 절감, 파일명 생성, 프리셋→설정, slug→기본값. ②
**`queue-reducer.ts`** — 상태 전이(queued→…→done/error/canceled)·abort·완료 해제·**적응형 동시성 결정(픽셀면적→N)**
을 fake 인코더/이벤트로 검증. **이게 카운터리뷰가 지적한 "가장 미지수 많은 로직이 커버리지 최저"의 역전을 닫는
지점** — 리사이즈 산수보다 큐 전이가 더 위험한데 이제 둘 다 순수 유닛테스트. → `compress-math.test.ts`(+큐 케이스).
**v1.1:** `compress-core.ts` 타깃크기 수렴(fake 인코더, 품질↔크기 단조·경계·최소바닥·PNG는 dimension-search).

**브라우저 필요(유닛테스트 밖):** 실제 encode(canvas/OffscreenCanvas), 워커 메시징, `useCompressQueue` 배선(얇은
껍데기). → **headless Chrome 검증**(§10)으로 커버. (원하면 나중에 vitest browser mode 도입 검토 — v1 필수 아님.)

---

## 8. i18n & SEO

### 8.1 사전 변경 (6로케일 전부, 구조동일)
- `categories`에 **`image` 키 추가** — ko:'이미지' / en:'Image' / es:'Imagen' / pt:'Imagem' / ja:'画像' / de:'Bild'.
- `tools`에 **3블록 추가(v1)**: `image-compressor`·`compress-jpg`·`compress-webp`. (`compress-png`는 v1.5 —
  oxipng와 함께. rev/D10.) 각 블록 키는 기존
  도구와 동일 셋: `title·description·metaTitle·metaDescription·howToTitle·howTo[]·featuresTitle·features[]·
  faqTitle·faq[]`. **UI 문구(드롭존/버튼/프리셋/통계)는 dict가 아니라 `labels.ts` 코드맵**(컨버터처럼).
- 작성: **EN·KO 원작성** 후 es·pt·ja·de는 **병렬 general-purpose 서브에이전트 번역**(extend-tools §C 워크플로) →
  `merge-tools.mjs` 병합 → `check-i18n.mjs` **ALL GOOD** 필수.

### 8.2 페이지/JSON-LD
- `[slug]/page.tsx`에 `group==='image' && <ImageTypeNav/>` 분기 추가. **JSON-LD에 `HowTo` 타입 추가**(리서치
  §7.2 — 현재 WebApplication+FAQPage뿐; 압축은 how-to 리치결과 가치 큼). howTo는 화면 표시 단계와 일치시킴.
- 각 slug의 `metaTitle`/`metaDescription`은 로케일별 고볼륨 표현(§8.3).

### 8.3 로케일 프레이밍 (리서치 §6 반영 — 번역이 아니라 시장별 각도)
- **KO**: "이미지 용량 줄이기 — 서버 업로드 없이, 로그인·광고 없이" + 증명사진/이력서 프리셋 카피.
- **DE**: "**ohne Upload · DSGVO-konform**"를 metaTitle에 · komprimieren vs verkleinern 구분 반영.
- **BR**: WhatsApp/이메일 각도 · "sem enviar seus arquivos".
- **ES**: "**sin subir archivos**" · iLoveIMG 대비 프라이버시.
- **JA**: "軽量化 · アップロードなし" · HEIC은 별도 도구로 유도.
- **EN**: "compress ... free, no upload, in your browser" · "to X KB" 표현은 본문/FAQ에.

### 8.4 "to X KB" 사다리 — 결정
현 아키텍처는 slug당 6로케일 dict 블록이 필요 → 15+ 타깃 slug = 90+ 블록(유지비 큼). **v1 결정:** 타깃크기를
**기능**으로 제공하고, 랜딩은 **소수 고가치 유스케이스 slug만**(예: `compress-image-to-100kb`, 증명사진/WhatsApp
계열)로 제한. **전체 사다리는 보류** — 나중에 도입하려면 "생성형 dict 블록(템플릿+치수변수)" **인프라 추가**가
선결(현 `Dictionary` 교집합 모델의 확장). → 착수 시점 GSC 실측으로 ROI 재판단(리서치 §9).

---

## 9. 인프라 변경 (`public/_headers` · 번들 · 배포)

### 9.1 CSP (현재값 기준 델타)
현재: `... img-src 'self' data:; ... script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com;
connect-src 'self' https://cloudflareinsights.com; ...` · COOP `same-origin` · **COEP 없음(유지 — beacon 보호)**.

| 변경 | 이유 | 단계 |
|---|---|---|
| `img-src 'self' data:` → **`'self' data: blob:`** | `URL.createObjectURL()` 프리뷰·썸네일·다운로드가 `blob:` 스킴 | **v1 필수** |
| ~~`worker-src 'self'` 추가~~ **불필요(P0-a 스파이크 확인)** — same-origin 워커는 `default-src 'self'`가 이미 허용 | 명시 원하면 선택. ※엔진 B의 **blob 워커**를 쓸 때만 `worker-src 'self' blob:` 필요(v1은 A1이라 해당 없음) | — (v1 불요) |
| `script-src`에 **`'wasm-unsafe-eval'`** 추가 | jSquash WASM(AVIF 등) 컴파일 | **v1.5**(AVIF 도입 시) |

- **COEP는 건드리지 않는다.** `require-corp`를 켜면 beacon 등 크로스오리진 로드가 깨진다(리서치 §4 + 로드맵 §4).
  싱글스레드 경로로 헤더 요구 자체를 회피.
- 다운로드(`<a download href=blob:>`)·ZIP은 CSP 추가 불요. `connect-src`는 v1 canvas 경로에서 추가 불요
  (WASM 지연로드는 동일오리진 fetch → 기존 `'self'` 커버).

### 9.2 번들 & 배포
- 초기 island < ~30KB gz(엔진 A + fflate). 무거운 WASM은 전부 지연 `import()`.
- dependency 추가: `fflate`(런타임). 폴백용 `browser-image-compression`도 런타임 라이브러리라 `dependency`이며,
  **import하면 island 번들에 딸려 들어간다** — 엔진 비교는 throwaway 브랜치에서 하고 조건부 import의 tree-shaking
  탈락을 확인(미채택 시 번들 0). WASM 코덱은 v1.5.
- **`pnpm run deploy`**(⚠️ `pnpm deploy` 아님, 워크스페이스 빌트인이 스크립트를 가림). preview=`pnpm run preview`.
- **PWA/오프라인**은 v1.5(프라이버시 증거 강화) — service worker + manifest, static export와 호환 확인 필요.

---

## 10. 검증 계획 (verify, don't claim)

**빌드/구조:**
```
pnpm test && pnpm lint && pnpm build
node .claude/skills/extend-tools/scripts/check-i18n.mjs      # 구조동일 + 엔티티 없음 → ALL GOOD 필수
```
`out/` 검사: **3개 새 도구 페이지(v1: image-compressor·compress-jpg·compress-webp)**의 `<title>`/
`<meta name=description>`(로케일별) · `application/ld+json`에 **WebApplication+FAQPage+HowTo** · **파일 인풋 마커
(`name="img-source"` 등) ABSENT**(=ssr:false 확인; dict prop 문자열은 위양성) · 홈 그리드에 image 카드 1장 ·
각 페이지 `ImageTypeNav` 링크 · `sitemap.xml` URL 수 = 6 × (홈1 + 도구수). (도구 17→**20**, 라우트 108→**126**.)
· **`build-404.mjs`가 신규 slug을 덮는지 확인**.

**런타임(headless Chrome, 로컬 `pnpm run preview` + 배포 후 라이브):**
- island 마운트(파일 인풋 present) · **실제 압축 왕복**: 테스트 이미지 드롭 → 압축 → 출력 blob 크기 < 원본 ·
  포맷 변환(→WebP) 동작 · **WebP 인코딩 feature-detect**(비지원 브라우저에서 조용한 PNG 폴백 대신 명시적 폴백) ·
  리사이즈 치수 · **오버사이즈 이미지**(canvas 최대면적 초과 사진 → 크래시 없이 다운스케일 + 고지 배지) ·
  **EXIF 제거 확인**(출력에 GPS/방향 태그 없음) · **자동 방향보정**(회전 EXIF 사진이 안 눕는지, 브라우저별) ·
  ZIP 다운로드 · **20-이미지 배치 OOM 없이 완주**(적응형 동시성) · 6로케일 200. (타깃크기 왕복은 v1.1.)
- **CSP 회귀:** 브라우저 콘솔에 CSP 위반 0(특히 blob 프리뷰·워커) · **beacon 여전히 로드**(COEP 안 켜짐 확인).
- **프라이버시 실증:** DevTools Network에 이미지 바이트 나가는 POST 0(우리 트러스트 주장의 근거).
- 배포 직후 신규 경로가 잠깐 stale 404 가능(Cloudflare 캐시 전파) — 캐노니컬 URL 몇 번 재확인(자가치유).

---

## 11. 단계별 실행 순서

**P0-a — [스파이크] 워커 엔진 경로 확정 + WebP 인코딩 판정(throwaway):** 다른 무엇보다 먼저. **3단 사다리로,
바닥이 가치를 보장한다**(카운터리뷰 건설적#1 반영 — 그래서 이건 "가치를 막는 BLOCKING"이 아니라 "엔진 DX를
정하는 스파이크"로 재분류):
- **A1(최선, 최고 DX):** `new Worker(new URL('./compress.worker.ts', import.meta.url))` — TS·번들 import 그대로.
  throwaway 워커가 숫자 postMessage back → `next build`(output:export) → **`out/`에 워커 청크가 same-origin으로
  떨어지고 CSP `worker-src 'self'`에서 로드**되는지 확인. 되면 A1 채택.
- **A2(안전 바닥, DX만 손해):** A1이 안 서면 **`public/workers/compress.js` + `new Worker('/workers/compress.js')`**.
  public/는 export 시 `out/`로 그대로 복사돼 Cloudflare가 same-origin static으로 서빙 → **번들러/Turbopack과 무관하게
  보장**, `worker-src 'self'` 허용. 대가는 자체완결 JS(TS·번들 import 없음): 순수 로직을 워커와 공유하려면 **미니
  esbuild 스텝으로 `queue-reducer`/`compress-math`를 `public/workers/`로 빌드하거나 `importScripts()`**. **핵심:
  A2가 있으므로 스파이크가 깨져도 "논-잰크 배치" 가치는 안 무너지고 편의성만 잃는다.**
- **A3(최후):** OffscreenCanvas·워커 자체가 미지원인 구형만 메인스레드 폴백(잰크 감수, 소수 경로).
- **WebP 판정(비블로킹, 2줄):** 1px `toBlob('image/webp')` → `blob.type` 확인. 실패는 JPEG 폴백(§12 #3).

→ 이 결과가 §3.1 엔진 확정을 정한다. **가치 제안(§0)은 A2 바닥이 보장하므로 게이트되지 않는다.**

> **✅ 스파이크 결과 (2026-07-18 실행, throwaway 브랜치 `spike/worker-in-export`에서 확인 후 코드·브랜치 폐기):**
> - **A1 통과.** `new Worker(new URL('./echo.worker.js', import.meta.url))`가 `output:'export'`+Turbopack(Next
>   16.2.10) 빌드에서 **`out/_next/static/media/echo.worker.[hash].js`(same-origin)** 로 emit됨. 참조 코드는
>   루트-상대 경로 `"/_next/static/media/echo.worker…"` — **blob:도 CDN도 아님.** 빌드·TypeScript 통과, 119 페이지 생성.
> - **CSP 변경 불필요(중요).** **현재 프로덕션 CSP**(`default-src 'self'`, **worker-src 없음**)를 그대로 얹어
>   `out/`을 서빙 → 헤드리스 Chrome로 `/ko/spike/` 로드 → A1 워커가 `OK {"from":"A1-bundled-worker"}` 왕복 성공.
>   same-origin 워커는 `default-src 'self'`가 이미 허용하므로 **`worker-src 'self'` 추가조차 불요**(§9.1·D7 갱신).
> - **A2도 확인**: `public/workers/echo-a2.js` → export 시 `out/workers/`로 복사, `new Worker('/workers/…')` 왕복 OK
>   — 폴백 바닥이 살아있음(그러나 A1이 되므로 안 씀).
> - **WebP 인코딩**: Chrome에서 `toBlob('image/webp')` → `OK image/webp`(Safari 꼬리는 §12 #3 feature-detect가 커버).
> - **결론 → 엔진 A1 채택**(최고 DX, TS·번들 import 그대로). **P0-a 클로즈.** 실제 압축 워커는 이 경로로 짓는다.

**P0-b — 순수 코어 + 테스트(브라우저 불요):** `compress-math.ts`(+`compress-math.test.ts`) — 리사이즈 수학
(최대치수/%/정확·비율잠금·업스케일 클램프·단계반감·**오버사이즈 클램프**)·바이트 포맷·%절감·파일명·포맷·프리셋.
`pnpm test` 초록. (타깃크기 수렴 `compress-core.ts`는 **v1.1** — 그 계약: 출력에 quality 축 없으면 dimension-search
전용, "타깃 이하 최근접" 수용, 인코더 주입으로 fake 테스트.)

**P1 — 단일 이미지 island(엔진 확정):** `encode.ts`(+워커, P0-a 결과 반영) → `ImageCompressorClient` 최소버전
(드롭 1장 → 품질/포맷/리사이즈 → 다운로드). **엔진 A vs B를 실빌드에서 비교·확정**(§3.1, §12). WebP 선택 시
feature-detect 폴백 경로 포함. `img-src blob:` CSP 반영(**worker-src는 불요 — P0-a 확인**). headless로 압축 왕복 검증.

**P2 — 배치 + 편의(척추):** 큐 훅(순차/**적응형 동시**·진행률·메모리해제)·**전역 설정**·통계·ZIP(fflate)·
EXIF 토글. before/after 배지. (이미지별 오버라이드·Ctrl+V·폴더는 **v1.1**.)

**P3 — registry/네비/홈:** `category:'image'` + **3 slug 엔트리(v1: image-compressor·compress-jpg·compress-webp)**
· `ImageTypeNav` · 홈 카드.

**P4 — i18n + SEO:** EN·KO dict **3블록(v1)** 원작성 → 병렬 번역 es/pt/ja/de → merge → check-i18n. 페이지 HowTo
JSON-LD.
로케일 프레이밍 metaTitle.

**P5 — 검증 → 배포:** §10 전체 → `pnpm run deploy` → 라이브 6로케일·CSP·프라이버시 실증 재확인. 커밋(심플 영어,
요약+불릿, co-author 없음, main이라 브랜치 프리픽스 없음). `implementation-status.md` 갱신.

**후속(v1.5):** AVIF(jSquash 지연 + `wasm-unsafe-eval`) · PWA/오프라인 · 비교 슬라이더 줌 · 고화질 mozjpeg/
oxipng/resize 옵트인 · 유스케이스 랜딩(증명사진·WhatsApp) · (GSC 보고) "to X KB" 확장 판단.

---

## 12. 리스크 & 오픈 퀘스천 (착수 시 실빌드로 확정)
1. **✅ [해소 — 2026-07-18 스파이크] 워커 + static export + Turbopack.** ~~미지수~~ 판정 완료. `new Worker(new
   URL('...', import.meta.url))`(A1)가 Next 16.2.10 `output:'export'`+Turbopack 빌드에서 **same-origin 청크로 emit되고,
   `worker-src` 없는 현재 CSP로 로드·왕복 OK**로 확인됨(§11 P0-a 결과). **A1 채택.** A2(public) 바닥도 동작 확인했으나
   불필요. **워커엔 CSP 변경조차 불요**(§9.1). → 남은 워커 관련 리스크 없음.
2. **엔진 A vs B.** 1번 통과 후, 자체 워커의 EXIF/다운스케일 엣지가 fiddly하면 browser-image-compression로 폴백
   (+`libURL` 자체호스팅 or `useWebWorker:false`). → P1에서 실측 확정. (타깃크기 수렴은 v1.1이라 이 비교의 변수에서
   빠짐 — v1 엔진 판정이 그만큼 단순해짐.)
3. **WebP 인코딩 폴백(저확률·비블로킹).** 실패 모드는 AVIF와 같으나 **확률은 딴판** — Safari는 수년 전부터 canvas
   WebP 인코딩을 지원해 조용한-PNG-폴백 꼬리가 얇다(카운터리뷰 캘리브레이션). 1px 인코딩 후 `blob.type` 확인은 값싸
   P0-a에 얹되, 실패는 JPEG 폴백이면 그만 → **BLOCKING 아님, P1 가드로 충분**.
4. **iOS Safari canvas 면적/메모리 + 적응형 동시성.** 12MP≈48MB 라이브 × 동시 N + 중간 blob이면 jetsam(~200–400MB)
   위험. **1차 신호 = 픽셀면적 휴리스틱**(디코드 W×H×4 추정) — `navigator.deviceMemory`는 **Chromium 전용이라 정작
   OOM 타깃 iOS Safari가 안 주므로 보너스로만**(카운터리뷰 건설적#2). 큰 사진 다운스케일은 **말없이 하지 말고 고지**.
   실기기(또는 헤드리스 메모리 계측)로 확인 — "무제한" 포지셔닝의 근거라 headless 왕복 1회로는 부족.
5. **CSP 회귀로 beacon 깨짐 0.** blob/worker 추가가 beacon·기존 페이지에 영향 없는지 라이브 검증.
6. **로케일 프레이밍 ↔ 구조동일 불변식.** DE DSGVO·BR WhatsApp 각도를 `faq[]`/`features[]` 배열에 넣으면
   `check-i18n`의 배열-길이-동일이 깨짐. 프레이밍은 `metaTitle`/`metaDescription`에만(§8.3). per-locale 배열 분기는
   인프라 선결(v1 밖).
7. **"to X KB" 사다리 i18n 인프라** — 도입 시 생성형 dict 블록이 `Dictionary` 교집합 모델과 `check-i18n`을
   깨지 않게 확장하는 설계 선결(타깃크기 기능이 v1.1이라 이 판단도 그 이후).
8. **테스트 경계** — 브라우저 로직은 유닛테스트 밖. verify 스킬/headless로 커버, 필요 시 vitest browser mode.

---

## 부록 — 결정 로그 요약
| # | 결정 | 근거 |
|---|---|---|
| D1 | 컨버터 동형(공유 island + slug 변형) | registry/ToolLoader/i18n 패턴 재사용, 코드 1편집 원칙 |
| D2 | 엔진 = Canvas 우선, WASM 지연 | COOP/COEP 회피(beacon 보호), 초기 번들 방어(리서치 §4) |
| D3 | 엔진 A(자체 워커) 권장, B 폴백 | CSP 마찰 최소(동일오리진), 논-잰크; B는 견고성 안전망 |
| D4 | HEIC·AVIF v1 밖 | WASM 무게(2.6–6.2MB / 3.4MB) → HEIC 별도도구·AVIF v1.5 지연 |
| D5 | UI 라벨 코드맵, JSON은 SEO만 | 컨버터 관례, 8×6 dict 변경 회피 |
| D6 | **타깃크기·이미지별 오버라이드 = v1.1** | 리뷰 결정: 날카로운 척추. 복잡도 최대 승수, 리서치 §5 non-table-stake |
| D7 | CSP 델타 = **`img-src blob:` 하나뿐**(worker-src 불요 — P0-a 확인) | objectURL 프리뷰/다운로드; same-origin 워커는 default-src 'self'가 커버; COEP 불변 |
| D8 | ZIP=fflate store/0 | 8KB·스트리밍·워커·헤더불요; 이미지는 이미 압축 |
| D9 | **워커-in-export ✅ 해소(2026-07-18): A1 채택** | 스파이크 통과 — A1이 export에서 same-origin emit + `worker-src` 없는 현재 CSP로 로드·왕복 OK; A2 바닥도 확인(불요) |
| D10 | **PNG 출력·slug 모두 v1.5(oxipng와 함께)** | canvas PNG는 quality 무시·크기 못 줄임 → v1 출력=JPEG·WebP만(카운터리뷰 잔여#1) |
| D11 | WebP feature-detect(v1, 저확률·비블로킹) | 실패는 JPEG 폴백; Safari 수년 지원이라 꼬리 얇음(카운터리뷰 캘리브레이션) |
| D12 | **적응형 동시성 + 다운스케일 고지** | 1차=픽셀면적(deviceMemory는 Chromium 전용 보너스); iOS jetsam 방어; "무제한"은 개수만 |
| D13 | **큐 로직 순수화(`queue-reducer.ts`) + Vitest** | 카운터리뷰 잔여#2: 최고-위험 로직(전이·동시성)을 headless 전용에서 유닛테스트로 |

*(이 문서는 판단·순서·검증 계층이다. 실제 코드/문구는 착수 시. 근거 데이터는 `image-compressor-research.md`.)*
