# HEIC → JPG 변환기 — 구현 계획

> **문서 성격:** 로드맵 Tier 1 #2 "HEIC→JPG 변환"의 **구현 계획**이다. 근거는 `tool-roadmap.md`(수요·해자),
> `image-compressor-implementation-plan.md`(파이프라인 재사용 대상), 라이브러리 조사(Context7 `libheif-js`).
> 실행 규약은 `.claude/skills/extend-tools/`. 이 문서는 "무엇을·어떤 라이브러리로·어떤 인프라 변경·어떤 순서로·
> 무엇을 검증하며" 짓는지의 판단 계층이다. **코드는 아직 안 건드렸다.**
>
> **⚠️ 대전제(AGENTS.md):** "This is NOT the Next.js you know." 착수 시 `node_modules/next/dist/docs/`를 먼저
> 확인. WASM·워커 도입은 **반드시 `output:'export'` 빌드에서 실제 동작 검증**(verify, don't claim).

---

> ## ✅ P0-a 스파이크 완료 — 결정 확정 (2026-07-18)
> BLOCKING 스파이크 P0-a를 **esbuild 실산출물 + 프로덕션 CSP 헤드리스**로 실행해 계획의 미결 결정을
> 판정했다(전체 근거·재현: **`heic-converter-p0a-spike-ko.md`**). **이 배너가 최상위 권위이며, 본문·rev·
> rev2의 "스파이크가 결정한다 / BLOCKING / (i)vs(ii) 미결" 문구를 모두 덮는다.** 5개 합격 기준 전부 통과.
>
> 1. **[확정] 라이브러리 = `libheif-js/wasm-bundle`**(WASM base64 임베드). esbuild iife 번들 **경고 0**,
>    `heic.js` **1.45 MB**. `.wasm` 별도 fetch 불요(`connect-src` 불변). asm.js(2.1 MB)는 esbuild가
>    `require('fs'/'path')`를 못 풀어 번들 실패 → **문서화된 폴백**으로만(importScripts로는 가능).
> 2. **[확정·H1/H9] 워커 = (i) 전용 `heic.worker.ts`.** (i)/(ii) 둘 다 실산출물로 동작하나 헤르메틱
>    (npm 버전 고정)·"워커는 우리가 번들" 설계 준수·[[worker-build-constraint]] 일치로 **(i) 채택**.
>    **빌드: 두 entryPoints+`outfile`은 esbuild 에러(`Must use "outdir"`) 실증 → `build-worker.mjs`에
>    별도 `build()` 호출.** `compress.js` **9939 B 불변** 확인. (ii) importScripts는 검증된 폴백.
> 3. **[반전·rev#3 REFUTED] orientation은 libheif가 이미 적용한다.** libheif `display()`가 irot를
>    픽셀·dims 모두에 적용(heif-dec C 레퍼런스와 **완전 동일**: 480×300 저장 → 300×480 출력). **→ 이음새에
>    수동 회전을 넣으면 안 된다(이중 적용).** `get_width/get_height`+display 버퍼 그대로 = 정방향. 단
>    합성 샘플 기반이라 **진짜 아이폰 .heic로 P1 재확인** 유지(EXIF-only orientation도 실샘플로 확인).
> 4. **[확정·H4] CSP = `wasm-unsafe-eval` 하나로 필요·충분.** 대조(토큰 OFF)에서 두 접근 모두 WASM
>    컴파일 차단 → ON이면 위반 0. connect-src·COEP 불변. **⚠️ WASM CSP 차단은 `securitypolicyviolation`
>    이벤트가 아니라 워커 `CompileError`로 표면화** → 미지원/실패 감지는 워커 `onerror`/reject로 잡는다.
> 5. **[확정·H10/rev2-B] HEIC는 Worker+OffscreenCanvas 요구 + 미지원 안내.** 메인스레드 폴백은
>    `createImageBitmap(HEIC)`가 던져 무의미. 감지 경로는 위 ④의 워커 에러와 동일.
>
> **P0-a는 더 이상 BLOCKING이 아니다 — P1(이음새) 착수 가능.** 상세는 스파이크 문서 참조.

---

> ## 🔎 rev — 시니어 아키텍트 리뷰 반영 (2026-07-18)
> 착수 전 이 계획을 **as-built 압축기 코드**(라이브·`implementation-status.md` §1.3)에 대해 공격적으로 리뷰했다.
> 재사용 표면(리사이즈·타깃크기·프리셋·비교슬라이더·ZIP·EXIF제거·붙여넣기·폴더)은 실재하므로 그 전제는 옳다.
> 그러나 "최소 이음새로 전부 재사용"이라는 논지가 **세 곳에서 실제 코드와 어긋나** 아래를 정정한다. **이 배너가
> 최종 결정이며, 본문의 상충 문구를 덮는다.**
>
> 1. **[CRITICAL·결정] 디코드는 기존 워커 수정이 아니라 파일단위 지연 워커로.** (⚠️ 아래 "2번째 esbuild 엔트리"는
>    **rev2 A/D로 정정**: `outfile`이 단일엔트리 전용이라 **별도 `build()` 호출**, 그리고 전용워커 vs importScripts는 스파이크 결정.) as-built
>    워커는 `build-worker.mjs`가 esbuild **`bundle:true, format:'iife', outfile`**로 만든 self-contained 클래식
>    워커(`public/workers/compress.js`, `runner.ts`가 `new Worker('/workers/compress.js')`)다. **esbuild는 iife에서
>    코드 스플리팅이 안 되므로**, 워커 안 `import('libheif-js')`는 libheif(2–3MB)를 `compress.js`에 **인라인** → HEIC를
>    안 쓰는 **모든 압축 사용자가 2–3MB 워커를 받는 회귀**. 계획 §2·§4의 "compress.worker.ts 수정 + 지연 import"는
>    성립 불가. **정답(채택):** `build-worker.mjs`에 두 번째 엔트리 `heic.worker.ts`(libheif+encode 번들) → `public/
>    workers/heic.js`. `runner`가 **입력 타입으로 워커 선택**(HEIC→heic.js, 그 외→compress.js). `compress.js` 9.9KB
>    유지, `heic.js`는 HEIC 나타날 때만 `new Worker` → 진짜 지연·논잰크. (§2·§4·§8·H1 갱신.)
> 2. **[결정·2차 리뷰 C] PNG 출력·`heic-to-png`는 v1.1로 미룬다.** 공유 파이프라인은 **`OutputFormat='jpeg'|'webp'`**
>    뿐이라(`compress-math.ts:5`) PNG 출력은 png를 OutputFormat/MIME/FormatChoice/SettingsPanel에 되살리고 HEIC에만
>    게이팅 + PNG 타깃크기 dimension-only까지 = **가장 비싼 미구현 조각**인데, 사진의 PNG는 거대해 실용가치도 낮다.
>    압축기가 `compress-png`로 저질렀던 실수의 재범이므로 뺀다. **v1 slug = `heic-to-jpg`(primary) + `heic-to-webp`**
>    (webp 출력 경로는 이미 있어 공짜). **v1은 `OutputFormat`을 안 건드린다.** PNG 출력·`heic-to-png`는 v1.1.
>    (§1·§3·§6·§7·§8·H3·H5 갱신.)
> 3. **[HIGH] orientation은 이음새가 못 가져온다.** `encode.ts:194`는 `createImageBitmap(blob,{imageOrientation:
>    'from-image'})`로 EXIF 회전을 픽셀에 굽지만, libheif→ImageData→`createImageBitmap(imageData)`엔 EXIF가 없어
>    무효. iPhone HEIC의 irot/EXIF orientation이 적용 안 되면 **세로 사진이 눕는다**(압축기가 피한 그 버그). libheif가
>    irot를 적용하는지 스파이크 확인, 아니면 수동 회전을 이음새에. (§3·§7 갱신.)
> 4. **[HIGH] P0-a 스파이크 합격 기준 재정의.** "디코드 왕복 OK"로는 esbuild가 libheif를 인라인해 **거짓 통과**한다
>    (압축기 전례와 동일 클래스). 합격 기준 = **libheif가 `compress.js`/초기 island에 들어가지 않음을 크기·네트워크로
>    단언** + 실제 위치(heic.js)에서 왕복. (§2·§7·H6 갱신.)
> 5. **[정확성] `resolveOutputFormat('image/heic','auto')`는 JPEG 아니라 `webp`를 반환**(`compress-math.ts:155`,
>    unknown→webp). §3의 "auto→JPEG"는 **함수 수정 필요**(`image/heic`→`jpeg` 케이스 추가). (§3 갱신.)
> 6. **[결정] group = 자체 `'heic'`(primary), 홈 카드 노출.** group `'image'` 합류면 `homeTools()`(`registry.ts:176`,
>    `!group||primary`)가 **홈 카드를 안 만든다** — Tier-1 #2 고수요(JA/DE)를 압축기 밑에 묻음. 자체 group으로 홈 카드
>    확보(압축기 ImageTypeNav엔 안 뜸 = 수용). (§4·§6·H5 갱신.)
> 7. **[MEDIUM] 공유 클라이언트 이질화.** HEIC는 HEIC 전용 accept·디코드 전단계·"변환" 프레이밍이라(PNG 출력은 rev2 C로
>    v1.1) `ImageCompressorClient` slug 분기가 스파게티가 될 수 있다. **얇은 별도 `HeicClient` 껍데기**(파이프라인·큐·
>    컴포넌트만 재사용) 권장. (§4 갱신.)
> 8. **[LOW] primary item(pitm) 디코드**(첫 프레임 ≠ 대표, Live Photo/버스트) · **실 .heic를 repo에 커밋**(CSP
>    `connect-src 'self'`+오프라인 헤드리스가 외부 페치 차단). (§7 갱신.)

---

> ## 🔎 rev2 — 자기 개정 재검증 (2026-07-18, 2차)
> 위 rev(1차)의 **자기 편집 세 곳이 esbuild/runner 실제 코드와 어긋나** 정정한다. 아그레시브 리뷰는 자기 수정본도
> 의심한다. **이 배너가 rev(1차)보다 우선하며 본문·H표의 상충 문구를 덮는다.**
>
> **A. [CRITICAL·1차 rev #1 오류] "build-worker.mjs에 두 번째 entryPoints 추가"는 esbuild 에러.** 현 스크립트는
> `entryPoints:[단일] + outfile`(`build-worker.mjs:19,24`)이고 esbuild에서 **`outfile`은 단일 엔트리 전용** — 엔트리
> 둘이면 `Cannot use "outfile" with multiple input files; use "outdir" instead`로 빌드가 깨진다. **정답:** 두 번째
> 워커는 **별도 `build()` 호출**(각자 `outfile`)로 뽑는다 = **빌드 파이프라인 이중화**. 부수효과: `encode.ts`/
> `compress-math.ts`가 `compress.js`와 `heic.js` **양쪽에 중복 번들**(같은 소스라 드리프트 0, `heic.js`에 ~9KB —
> 무시 가능). "엔트리 하나 추가"가 아니라 **`build()` 호출 2개**다. (§4·§8·H1 갱신.)
>
> **B. [CRITICAL·깨진 폴백] HEIC엔 메인스레드 폴백이 공짜로 안 따라온다.** `runner.ts:57,64`의 안전망은 워커 사망
> 시 `encodeImage(file,req)`를 메인스레드에서 재시도하는데, `encodeImage`는 `createImageBitmap(source)`
> (`encode.ts:194`)로 디코드 → **HEIC blob엔 이게 던진다** → 폴백이 아니라 실패. **결정(채택):** v1 HEIC는
> **Worker+OffscreenCanvas를 요구**하고, 없으면 **"이 브라우저 미지원" 안내**(2026 사실상 보편 + HEIC 사용자는 모던
> 아이폰/브라우저). 메인스레드 libheif 폴백 경로는 v1에 짓지 않는다(원하면 v1.1). 1차 계획의 "runner 입력타입 분기"가
> 이 갭을 숨겼음. (§3·§4·§7·H9 신설.)
>
> **C. [스코프·내 결정 확정] `heic-to-png` v1 제외.** PNG 출력 되살리기+HEIC 게이팅+PNG 타깃크기 dimension-only =
> 최고비용 미구현 조각, 사진 PNG는 거대·저가치, 압축기 `compress-png` 실수의 재범. **v1 slug = `heic-to-jpg`(primary)
> + `heic-to-webp`**(webp 출력 경로 이미 존재 = 공짜, HEIC→WebP 실수요 有). `heic-to-png`·PNG 출력은 **v1.1**(압축기
> v1.5 PNG+oxipng와 함께 판단). **v1은 `OutputFormat`을 안 건드린다.** (1차 rev #2와 일치·확정.)
>
> **D. [아키텍처·스파이크로 재검증] "전용 워커"는 내 추천일 뿐, 더 가벼운 대안과 스파이크에서 비교한다.** 전용
> `heic.worker.ts`는 **runner 이중화**(두 워커 라우팅+지연 생성)를 강제한다. **대안(ii):** 기존 **단일 워커 유지** +
> `importScripts('/workers/libheif.js')`를 **`onmessage` 안에서 HEIC 올 때만** 호출(클래식 워커 가능) → `runner`
> 무변경, `libheif.js`만 별도 `build()` 산출로 지연. 파일단위 지연·논잰크는 (i)전용워커와 동일. **그리고 libheif가
> iife 클래식 워커로 깨끗이 번들되는지(=`import.meta`/`fetch`/`new URL` 잔재 없이)가 자체 미검증** — 스파이크는
> **실제 산출된 `heic.js`/`libheif.js`로** 테스트해야지 dev `import()`로는 또 거짓통과. **P0 스파이크가 (i) vs (ii)를
> 실산출물로 비교해 확정.** (§2·§4·§8·H1·H6 갱신.)

---

## ⚠️ 착수 전 정직한 현황 (2026-07-18 코드 확인)

계획서의 "압축기 파이프라인 재사용"이 성립하려면 아래가 전제인데, **지금 코드엔 없다** — 그래서 이건 압축기
v1.1처럼 얹는 게 아니라 **WASM 라이브러리 + CSP 변경 + 이음새 신규 + 워커 빌드 파이프라인 확장**이 걸린 진짜 새
서브프로젝트다.

0. **[리뷰가 추가한 최대 갭] 워커 빌드 파이프라인.** as-built 워커는 esbuild iife self-contained(`build-worker.mjs`
   → `public/workers/compress.js`). iife는 코드 스플리팅 불가라 **"워커에서 libheif 지연 import"가 성립 안 함** →
   libheif는 **파일 단위 지연**(별도 esbuild `build()` 산출)이어야 한다. **⚠️ rev2 A/D:** 이건 "entryPoints 하나 추가"가
   아니라 **별도 `build()` 호출**(`outfile`은 단일 엔트리 전용)이고, "전용 워커 vs 단일워커+`importScripts`"는 스파이크가
   실산출물로 정한다. 원래 3-갭 목록이 이걸 놓쳤었다.
0b. **[rev2 B] HEIC엔 메인스레드 폴백이 없다.** `runner`의 워커-사망 폴백은 `encodeImage`→`createImageBitmap(HEIC)`에서
   던진다 → v1은 Worker+OffscreenCanvas 요구 + 미지원 안내(메인스레드 libheif 경로 안 지음).
1. **재사용 이음새 미구현.** `encodeImage(source: Blob)`은 `createImageBitmap(source)`로 브라우저 네이티브
   디코더를 쓰는데 이건 **HEIC를 못 읽는다**(`encode.ts:194`). encode 파이프라인에 **이미 디코드된 픽셀 입력 경로**를
   새로 열어야 한다. **단 orientation은 이 경로로 안 따라온다**(rev #3).
2. **CSP에 `wasm-unsafe-eval` 없음.** 현재 `script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com`.
   libheif WASM 컴파일에 `'wasm-unsafe-eval'` 추가 필요(메인·워커 컨텍스트 공통) → **beacon 안 깨지는지 검증
   대상**(COEP는 계속 안 켠다).
3. **HEIC 라이브러리 미설치.** 신규 런타임 의존성(`libheif-js`).
4. **PNG 출력 경로 부재 → v1 밖으로 해소.** 공유 파이프라인은 `jpeg`|`webp`만 출력. v1은 이걸 안 건드리고
   `heic-to-png`·PNG 출력을 **v1.1로** 미뤄 이 갭을 v1에서 제거함(rev #2·2차 리뷰 C).

---

## 0. 요약 — v1에서 짓는 것

**한 문장:** HEIC/HEIF 파일을 100% 브라우저에서 **JPG(기본)·WebP로 변환**하는 배치 도구(PNG 출력은 v1.1). libheif로 디코드만
새로 하고, **리사이즈·타깃 크기·유스케이스 프리셋·EXIF 제거·ZIP·비교 슬라이더는 압축기 파이프라인을 그대로 재사용.**
libheif WASM(~2–3MB)은 **HEIC 파일이 실제로 들어올 때만 지연로드** → 초기 번들 0.

**빈틈 공략(로드맵):** iPhone 기본 포맷이라 전 시장 수요, **JA·DE 편중.** 현지 경쟁자는 있으나 **배치 한도·데스크톱앱
유도·서버 업로드** 갭 → "무제한 배치 · no upload · 소스 감사가능"이 쐐기.

---

## 1. 스코프 (v1 in / out)

| 영역 | v1 IN | v1 OUT (→ 후속) |
|---|---|---|
| 입력 | **HEIC/HEIF**(단·다중) · 드롭·피커·**붙여넣기·폴더**(압축기서 이미 됨) | 다른 포맷(그건 압축기 담당) |
| 출력 | **JPG(기본)·WebP** — 브라우저 canvas 인코드(`OutputFormat` 그대로) | **PNG 출력(v1.1)** · **HEIC 출력**(브라우저 인코드 불가·범위 밖) |
| 멀티이미지 HEIC | **primary item(pitm)만** 변환 | 버스트/라이브포토 전 프레임·시퀀스 |
| 재사용 기능 | **리사이즈·타깃 KB·프리셋·EXIF제거·ZIP·비교 슬라이더**(압축기 전부) | — |
| 색/HDR | 표준 8비트 RGBA(libheif display 기본) | 10비트/HDR 톤매핑 정밀도 |
| SEO slug | `heic-to-jpg`(primary) **+ `heic-to-webp`**(공짜 재사용) | **`heic-to-png`(v1.1, PNG 출력과 함께)** |
| 인프라 | 지연로드 WASM · CSP `wasm-unsafe-eval` | — |

**v1은 `OutputFormat`을 안 건드린다(2차 리뷰 C 결정).** 공유 파이프라인이 `jpeg`|`webp`뿐이라 JPG·WebP 출력은
**진짜 공짜 재사용**이다. PNG 출력은 파이프라인 되살리기+게이팅이라는 최대 미구현 조각인데다 사진 PNG는 실용가치가
낮아 **`heic-to-png`과 함께 v1.1로** 미룬다(압축기 `compress-png` 교훈의 재범 방지). HEIC→PNG 수요는 v1.1에서 흡수.

---

## 2. 라이브러리 결정 (⚠️ P0 스파이크 게이트)

| 옵션 | 내용 | 번들 | 스레드 | 판정 |
|---|---|---|---|---|
| **libheif-js**(권장) | `/catdad-experiments/libheif-js`. `new HeifDecoder().decode(uint8)` → `image.display({data,width,height}, cb)`로 **RGBA 픽셀**. **`{data,width,height}` 평객체로 받아 DOM 불요 → 워커 가능.** WASM은 `libheif-bundle.mjs`에 **임베드**(별도 `.wasm` fetch 불요) | ~2–3MB(지연) | **워커 가능** | ✅ 압축기 워커와 정합·논잰크 |
| heic2any | 위 라이브러리의 얇은 래퍼, 메인스레드 편의 API | 유사 | 메인스레드(잰크) | 폴백/레퍼런스 |
| elheif | 인코드까지 되나 우린 디코드만 필요 | 더 큼 | — | 과함 |

**권장(rev2 A/D 반영):** libheif-js로 디코드 → RGBA `ImageData` → `createImageBitmap(imageData)` → **기존 압축기
encode 파이프라인**(planDimensions/planCrop/encodeToTarget) + **orientation 처리**(rev #3). **왜 기존 워커에 지연
import가 안 되나:** esbuild iife는 코드 스플리팅 불가 → `compress.worker.ts`에 `import('libheif-js')`를 넣으면 2–3MB가
`compress.js`에 인라인돼 **모든 압축 사용자에게 회귀**. 그래서 libheif는 **파일단위 지연**이어야 하고, **두 접근을 P0
스파이크가 실산출물로 비교·확정**한다:
- **(i) 전용 `heic.worker.ts`** — `build-worker.mjs`에 **별도 `build()` 호출**(⚠️ entryPoints 추가 아님 — `outfile`은
  단일엔트리 전용) → `public/workers/heic.js`. `runner`가 입력 타입으로 HEIC일 때만 `new Worker('/workers/heic.js')`.
- **(ii) 단일 워커 + `importScripts`** — 기존 워커 유지, `onmessage`에서 HEIC 올 때 `importScripts('/workers/libheif.js')`
  (별도 `build()` 산출)로 libheif만 지연 → `runner` 무변경. 클래식 워커라 가능.

둘 다 파일단위 지연·논잰크는 동일. WASM이 bundle.mjs에 임베드라 **`.wasm` 자체호스팅 불필요**(`connect-src` 불변),
단 컴파일에 `script-src 'wasm-unsafe-eval'` 필요. **HEIC 워커 미지원 브라우저는 폴백 없이 미지원 안내**(rev2 B).

> **⚠️ P0-a 스파이크(다른 코드보다 먼저):** 압축기 때 워커 스파이크가 **거짓 통과**한 전례가 있다(self-contained
> echo만 통과). throwaway로 **실제 .heic 1장**을 `output:'export'` **실산출물**(접근 i `heic.js` 또는 ii
> `libheif.js`+`importScripts`)에서 libheif로 디코드 → RGBA 얻고 → 프로덕션 CSP(`wasm-unsafe-eval` 추가)로 서빙되는
> `out/`에서 헤드리스 왕복. **dev `import()`가 아니라 esbuild 산출물로 테스트**(안 그러면 또 거짓통과, rev2 D).
> **합격 기준(rev #4·rev2 D) — "디코드 OK"로는 부족:** ① libheif가 **`compress.js`/초기 island 번들에 들어가지 않음**을
> 파일 크기·네트워크 워터폴로 단언(=진짜 지연) · ② 무거운 워커는 HEIC 나타날 때만 로드 · ③ 디코드된 사진 orientation
> 정상(세로가 안 눕음) · ④ **libheif가 iife 클래식 워커로 깨끗이 번들**(`import.meta`/`fetch`/`new URL` 잔재로 안 깨짐)
> · ⑤ (i)vs(ii) 중 어느 쪽이 서는지. **실 .heic 샘플은 repo에 커밋**(CSP `connect-src 'self'`가 외부 페치 차단). 통과
> 못 하면 heic2any(메인스레드) 폴백 또는 asm.js 변형 검토.

---

## 3. 재사용 이음새 (`encode.ts` + `compress-math.ts` 변경 — 최소 침습 아님, 아래 유의)

- **현재:** `encodeImage(source: Blob)` → `createImageBitmap(source, {imageOrientation:'from-image'})`(`encode.ts:194`)
  → planDimensions → draw → convertToBlob.
- **변경:** 디코드를 분리해 **이미 디코드된 소스**도 받게 한다. 두 가지 방식 중 택1(스파이크 후 확정):
  - (a) `encodeImage(source: Blob | ImageBitmap, req, sourceType?)` — Blob이면 createImageBitmap, ImageBitmap이면
    그대로 사용. `resolveOutputFormat`에 넘길 `sourceType`을 인자로(HEIC는 blob.type이 비어있거나 `image/heic`).
  - (b) 별도 진입점 `encodeBitmap(bitmap, sourceType, req)` — encodeImage가 내부적으로 이걸 호출.
- **HEIC 경로:** libheif 디코드 → RGBA `ImageData` → `createImageBitmap(imageData)` → `encodeBitmap(bitmap,
  'image/heic', req)`. 이러면 **리사이즈·타깃크기·프리셋·크롭이 HEIC에도 그대로** 작동.
- **⚠️ orientation은 공짜가 아니다(rev #3).** `createImageBitmap(imageData)`엔 EXIF가 없어 `imageOrientation`이 무효
  → iPhone HEIC의 irot/EXIF 회전이 유실돼 **세로 사진이 눕는다.** libheif `display`가 irot를 적용하는지 스파이크
  확인, 아니면 디코드 시 회전을 픽셀에 반영(또는 encode에 orientation 인자 추가).
- **⚠️ auto 포맷 수정 필요(rev #5).** 현 `resolveOutputFormat('image/heic','auto')`는 unknown→**`webp`**를 반환한다
  (`compress-math.ts:155`), JPEG 아님. HEIC auto→JPEG를 원하면 `compress-math.ts`에 `image/heic → 'jpeg'` 케이스를
  **추가**한다. 명시 선택은 jpg/png/webp.
- **PNG 출력은 v1 밖(2차 리뷰 C).** 공유 `OutputFormat`은 jpeg|webp뿐이라 v1은 이걸 안 건드린다. PNG 출력(OutputFormat/
  MIME/canvas png 경로/PNG 타깃크기 dimension-only 분기 + HEIC slug 게이팅)은 **v1.1에서 `heic-to-png`과 함께**.

---

## 4. 파일 구성 (파이프라인 재사용, UI는 얇은 별도 껍데기)

HEIC 도구는 압축기와 **UI 흐름은 비슷**(드롭 → 큐 → 설정 → 변환 → 다운로드)하나 **입력 계약이 다르다**(HEIC 전용
accept · 디코드 전단계 · "변환" 프레이밍). 그래서 `ImageCompressorClient` slug 분기(스파게티
위험, rev #7)가 아니라 **얇은 `HeicClient` 껍데기 + 파이프라인/큐/컴포넌트 재사용**을 택한다.

```
src/tools/image/            # 압축기와 같은 디렉토리(형제)
  heic.worker.ts            # (신규) 전용 워커: libheif import → decode(+orientation) → 기존 encode. rev #1.
  scripts/build-worker.mjs  # (수정) ⚠️ 두 번째 build() 호출 추가 — esbuild `outfile`은 단일 엔트리 전용이라
                            #   entryPoints에 못 늘림. 별도 build()로 heic.js 산출(encode/compress-math는 양쪽 중복 번들, 무해).
  runner.ts                 # (수정) 입력 타입 분기: HEIC → heic.js 워커(지연 생성), 그 외 → compress.js.
                            #   ⚠️ HEIC 메인스레드 폴백은 공짜 아님(아래 주의).
  encode.ts                 # (수정) §3 이음새: 디코드된 비트맵 입력 경로 + orientation. (PNG 출력은 v1.1)
  compress-math.ts          # (수정) resolveOutputFormat에 image/heic→jpeg 케이스만 추가. OutputFormat 무변경(PNG=v1.1).
  HeicClient.tsx            # (신규) 얇은 껍데기: DropZone(accept=heic)+큐+SettingsPanel(포맷 auto/jpg/webp)+결과 재사용.
  registry.ts               # (수정) heic-to-jpg(primary)·heic-to-webp 엔트리 — group 'heic'(자체), rev #6.
  HeicTypeNav.tsx           # (신규 or 상호링크) heic 그룹 in-tool 네비.
  labels.ts                 # (수정) HEIC 라벨 — 대부분 기존 재사용.
```

**group = 자체 `'heic'`(primary), 홈 카드 확보(rev #6).** group `'image'` 합류는 `homeTools()`(`!group||primary`)가
홈 카드를 안 만들어 Tier-1 #2를 압축기 밑에 묻는다. 자체 group으로 홈 카드 노출(압축기 ImageTypeNav엔 안 뜸 = 수용).
드롭존 `accept`는 HEIC 전용(`.heic,.heif,image/heic`).

> **⚠️ 착수 전 재확인 3가지(2차 리뷰):**
> - **[A·빌드] esbuild `outfile`은 단일 엔트리 전용** → heic.js는 **별도 `build()` 호출**로. entryPoints 추가는 에러.
> - **[B·폴백] HEIC 메인스레드 폴백은 깨져 있다.** runner의 `encodeImage(heicBlob)` 폴백은 `createImageBitmap(heicBlob)`
>   이 던져 실패(`runner.ts:57,64`·`encode.ts:194`). 압축기의 "워커 죽음→메인스레드 재시도"가 HEIC엔 안 통함.
>   **결정 필요:** (a) 메인스레드용 libheif 경로 추가 or (b) 폴백 포기 + "미지원 브라우저" 안내(권장 — Worker+
>   OffscreenCanvas는 2026 보편, HEIC 사용자는 모던 기기).
> - **[D·워커 형태] 전용 워커 vs 단일 워커+importScripts.** 전용 워커는 runner 이중화(라우팅·지연생성·별도폴백)를
>   강제. 대안: 기존 워커에서 HEIC 올 때 `importScripts('/workers/libheif.js')`로 libheif만 지연(runner 무수술).
>   지연·논잰크는 동일. **P0-a 스파이크가 실제 산출 파일로 둘을 비교**(dev `import()`는 또 거짓통과). + libheif가
>   iife 클래식 워커로 깨끗이 번들되는지(import.meta/fetch/new URL 없이)도 그때 확인.

---

## 5. 인프라 (CSP · 번들 · 배포)

| 변경 | 이유 | 단계 |
|---|---|---|
| `script-src`에 **`'wasm-unsafe-eval'`** 추가 | libheif WASM 컴파일 | **v1 필수** |
| ~~`.wasm` 자체호스팅~~ | bundle.mjs에 WASM 임베드 → **불필요** | — |
| ~~`connect-src` 변경~~ | 별도 fetch 없음 → **불필요** | — |
| **COEP 안 켬** | beacon·크로스오리진 보호(압축기와 동일) | 유지 |

- **지연로드(파일단위):** HEIC 파일 감지 시에만 무거운 워커(접근 i `heic.js`) 또는 `libheif.js`(접근 ii)를 로드 —
  **클라이언트 `import()`가 아니라 워커 파일 지연**(iife는 스플릿 불가, rev2 A/D). 초기 island 번들 증가 0.
- **beacon 회귀 검증:** `wasm-unsafe-eval` 추가 후 라이브에서 beacon 여전히 로드·CSP 위반 0 확인.
- **미지원 브라우저:** Worker+OffscreenCanvas 없으면 HEIC는 폴백 없이 "미지원 안내"(rev2 B).
- 배포: **`pnpm run deploy`**(⚠️ `pnpm deploy` 아님).

---

## 6. i18n & SEO

- 신규 slug **2개**(v1): `heic-to-jpg`(primary) · **`heic-to-webp`**(webp 출력 공짜 재사용). **group 자체 `'heic'` →
  홈 카드 노출**(rev #6). (`heic-to-png`은 v1.1 — PNG 출력과 함께.) dict 블록 × 6로케일(구조동일, `check-i18n` 강제).
- **로케일 프레이밍**(metaTitle/description에만 — 배열은 6로케일 동형): **JA** "HEIC→JPG 変換 · アップロードなし" ·
  **DE** "HEIC in JPG · ohne Upload · DSGVO" · **EN/ES/PT/KO** "convert HEIC to JPG free, no upload".
- **JSON-LD:** `WebApplication` + `FAQPage` + **`HowTo`**(변환 단계). 화면 FAQ/HowTo와 일치.
- 작성: EN·KO 원작성 → es/pt/ja/de 병렬 서브에이전트 번역 → merge → `check-i18n` ALL GOOD.

---

## 7. 검증 계획 (verify, don't claim)

- **P0-a 스파이크(BLOCKING):** 실 .heic → export **실산출물**(접근 i `heic.js` 또는 ii `libheif.js`+importScripts) +
  CSP(`wasm-unsafe-eval`)에서 libheif 디코드 왕복(§2). **합격 기준(rev #4·rev2 D): ① libheif가 `compress.js`/초기
  island 번들에 없음을 크기·네트워크로 단언(진짜 지연) · ② 무거운 워커는 HEIC 나타날 때만 로드 · ③ orientation 정상
  · ④ libheif가 iife 클래식 워커로 깨끗이 번들 · ⑤ (i)vs(ii) 확정.**
- **빌드/구조:** `pnpm test`(디코드 순수 부분 있으면 유닛) · lint · build · `check-i18n` ALL GOOD. `out/` 신규 페이지
  2개(title/meta·JSON-LD WebApplication+FAQPage+HowTo)·ssr:false 마커·sitemap URL 수 갱신·**홈 카드(자체 group이라
  heic-to-jpg 카드 노출)**·HeicTypeNav 링크 · 무거운 워커 산출물 self-contained · **`compress.js` 크기 무회귀**.
- **런타임 E2E(CDP 헤드리스, 압축기서 만든 드라이버 재사용):** 실 .heic 드롭 → JPG 변환 → **출력이 유효한 JPEG·
  dimensions 원본 일치** · **orientation(세로 iPhone 사진이 안 눕음)** · WebP 출력도 왕복 · **리사이즈·타깃 크기가
  HEIC에도 작동**(파이프라인 재사용 증명) · CSP 위반 0·**beacon 로드**(COEP 안 켜짐) · 프라이버시(이미지 나가는
  POST 0) · **모바일-크기 HEIC 피크 메모리**(아이폰이 주 사용자) · **Worker/OffscreenCanvas 없는 환경 = 미지원 안내
  (폴백 아님, rev2 B)**. (PNG 출력은 v1.1이라 v1 검증 대상 아님.)
- **⚠️ 실 .heic 샘플을 repo에 커밋**이 검증 선결(브라우저는 HEIC 인코드 불가 → 합성 불가, CSP `connect-src 'self'`가
  외부 페치 차단). primary item(pitm) 있는 다중이미지 샘플도 하나(대표 프레임 선택 확인).

---

## 8. 단계별 실행 순서

- **P0-a — [스파이크] libheif 디코드 + CSP + 워커 아키텍처 확정.** 다른 무엇보다 먼저(BLOCKING). 실 .heic로 왕복 +
  **libheif가 초기 번들에 없음 단언**(§7 합격 기준) + **(i)전용워커 vs (ii)단일워커+`importScripts`를 실산출물로 비교**
  (rev2 D) + libheif가 iife 클래식 워커로 깨끗이 번들되는지 확인. → 라이브러리·워커 경로 확정.
- **P1 — 이음새:** `encode.ts` §3 변경(디코드된 비트맵 입력 + orientation) + `compress-math.ts`(image/heic→jpeg) +
  유닛/헤드리스로 **기존 압축기 경로 무회귀** 확인. (PNG 출력·게이팅은 v1 밖 — v1은 `OutputFormat` 불변.)
- **P2 — 워커(스파이크 결정 접근) + 클라이언트:** 접근 i면 `heic.worker.ts`(신규) + `build-worker.mjs`에 **별도
  `build()` 호출**(entryPoints 아님) + `runner` 입력타입 분기 / 접근 ii면 `libheif.js` 별도 산출 + 기존 워커
  `importScripts`(runner 무변경). **HEIC 워커 미지원 시 폴백 없음 → 미지원 안내**(rev2 B). 얇은 `HeicClient` 껍데기.
- **P3 — registry/네비/홈:** `heic-to-jpg`(primary)·`heic-to-webp` 엔트리 **group `'heic'`** · HeicTypeNav · **홈 카드**
  · 드롭존 accept=HEIC 전용. (`heic-to-png`은 v1.1.)
- **P4 — i18n + SEO:** dict 2블록 × 6로케일 · HowTo JSON-LD · 로케일 프레이밍.
- **P5 — 검증 → 배포:** §7 전체 → `pnpm run deploy` → 라이브 6로케일·CSP·beacon·프라이버시·**compress.js 무회귀**
  재확인 → 커밋 → `implementation-status.md` 갱신.

---

## 부록 — 결정 로그 요약

| # | 결정 | 근거 |
|---|---|---|
| H1 | libheif = **파일단위 지연**(별도 esbuild `build()` 산출). 전용워커(i) vs 단일워커+`importScripts`(ii)는 **스파이크 결정** | iife는 스플리팅 불가 → 기존 워커 지연 import는 2–3MB를 compress.js에 인라인(회귀). 별도 산출이라야 진짜 지연·논잰크. build() 세부·접근 i/ii는 H9·rev2 A/D |
| H2 | 압축기 파이프라인 재사용(이음새 신규) | 리사이즈·타깃·프리셋·비교를 HEIC에. **단 orientation은 안 따라옴**(rev #3) — encode에 orientation 처리 추가 |
| H3 | **v1 출력 = JPG·WebP** (PNG·HEIC 출력 없음) | webp 출력은 이미 있어 공짜. PNG 출력은 파이프라인 되살리기+게이팅이라 최대 미구현 조각+사진 PNG 저가치 → **`heic-to-png`과 함께 v1.1**(2차 리뷰 C, 압축기 compress-png 재범 방지) |
| H4 | CSP 델타 = `wasm-unsafe-eval` 하나 | WASM 컴파일(메인·워커 공통). bundle 임베드라 connect-src/자체호스팅 불요. COEP 불변(beacon 보호) |
| H5 | slug 2개(**jpg·webp**), **group 자체 `'heic'`(primary)** | webp는 공짜 재사용(png는 v1.1). group 'image' 합류는 홈 카드 소실(`homeTools`=!group\|\|primary) → 자체 group으로 홈 카드(rev #6) |
| H6 | P0 스파이크 BLOCKING, **합격=libheif 초기번들 부재 단언** | "디코드 OK"는 esbuild 인라인으로 거짓통과(압축기 전례 동일 클래스). 지연·orientation까지 확인해야 확정(rev #4) |
| H7 | UI = 얇은 `HeicClient`(slug 분기 아님) | 입력 계약이 이질(accept·디코드·PNG·프레이밍) → 공유 클라이언트 slug 분기 스파게티·PNG 누수 회피(rev #7) |
| H8 | `resolveOutputFormat`에 image/heic→jpeg 추가 | 현 함수는 unknown→webp 반환. auto→JPEG는 함수 수정 필요(rev #5) |
| H9 | 워커 빌드 = **별도 `build()` 호출**(entryPoints 추가 아님) | esbuild `outfile`은 단일 엔트리 전용(2차 리뷰 A). 단일워커+importScripts 대안은 스파이크서 비교(D) |
| H10 | HEIC 폴백: 메인스레드 libheif 없으면 **폴백 포기+미지원 안내** | `encodeImage(heicBlob)` 메인스레드 폴백은 `createImageBitmap`이 던져 깨짐(2차 리뷰 B). 모던 기기 한정 수용 |

*(이 문서는 판단·순서·검증 계층이다. 실제 코드/문구는 착수 시. **P0-a 스파이크로 H1·H3·H4·H6·H9·H10 및
orientation(rev#3) 확정 — 최상단 "✅ P0-a 완료" 배너·`heic-converter-p0a-spike-ko.md` 참조. 다음은 P1.**)*
