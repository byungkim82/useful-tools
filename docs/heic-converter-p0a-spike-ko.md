# P0-a 스파이크 결과 — libheif 디코드 + CSP + 워커 아키텍처

> **성격:** `heic-converter-plan-ko.md`의 **BLOCKING 스파이크(P0-a)** 실행 결과. 계획의 미결 질문
> (라이브러리 변형 · 워커 형태 (i) vs (ii) · orientation · CSP 델타)을 **dev `import()`가 아니라
> esbuild 실산출물 + 프로덕션 CSP 헤드리스**로 판정했다(rev2-D의 거짓통과 금지 준수).
>
> **검증 환경:** libheif-js 1.19.8 · esbuild 0.28.1(프로젝트 동일) · Chrome 헤드리스(puppeteer-core) ·
> Node http 서버가 `public/_headers`의 프로덕션 CSP를 그대로 재현(+`wasm-unsafe-eval` 토글) ·
> `connect-src 'self'`라 실 .heic 샘플은 same-origin 서빙. 하네스는 초기 로드에 워커를 안 만들고
> **케이스 실행 시에만** 워커를 생성해 네트워크 워터폴로 지연을 증명.
>
> **샘플(합성, `heif-enc`/ImageMagick):** `portrait.heic`(300×480, 변환 없음, 코너 TL=red/TR=lime/
> BL=blue/BR=yellow) · `orientedA.heic`(480×300 픽셀 + **irot 박스** = 아이폰식 회전 플래그).

---

## 판정 요약 — 5개 합격 기준 전부 통과 ✅

| # | 기준 (계획 §7·rev#4·rev2-D) | 결과 | 근거 |
|---|---|---|---|
| 1 | libheif가 `compress.js`/초기 로드에 없음(진짜 지연) | ✅ | 초기 요청 = `/`, `/favicon.ico` 뿐. `compress.js` **9939 B 불변**. |
| 2 | 무거운 워커/libheif는 HEIC 나타날 때만 로드 | ✅ | 케이스 실행 시에만 워커·libheif 페치(워터폴 확인). |
| 3 | 디코드 orientation 정상(세로가 안 눕음) | ✅ | libheif가 irot를 **레퍼런스와 동일하게 적용**(아래). |
| 4 | libheif가 iife 클래식 워커로 깨끗이 번들 | ✅ | (i) esbuild 번들 **경고 0** · (ii) 벤더 importScripts 무오류, 둘 다 CSP 위반 0. |
| 5 | (i)전용워커 vs (ii)단일워커+importScripts 확정 | ✅ | 둘 다 동작. **(i) 채택**(아래 결정). |

부수 확인: 디코드→RGBA→`OffscreenCanvas`→JPEG **전 왕복**이 워커 안에서 성공(포트레이트 4520 B JPEG) →
압축기 encode 경로가 HEIC 픽셀에 그대로 붙는다는 §3 전제 실증.

---

## 라이브러리 사실 (libheif-js 1.19.8)

- **API:** `new libheif.HeifDecoder().decode(Uint8Array)` → 이미지 배열. `image.get_width()/get_height()`,
  `image.display({data:Uint8ClampedArray(w*h*4), width, height}, cb)`로 RGBA. **평객체라 DOM 불요 = 워커 안전.**
- **세 가지 브라우저 변형:**
  | 변형 | 파일 | 크기 | WASM | esbuild 번들(i) | `<script>`/importScripts(ii) |
  |---|---|---|---|---|---|
  | **wasm-bundle(채택)** | `libheif-wasm/libheif-bundle.{js,mjs}` | ~1.4 MB | 임베드(base64) | ✅ 경고 0 → `heic.js` **1.45 MB** | ✅ 전역 `libheif` 노출 |
  | asm.js(폴백) | `libheif/libheif.js` | 2.1 MB | 없음 | ❌ `require('fs'/'path')` 미해소 | ✅ 전역 노출 |
  | wasm(별도.wasm) | `libheif-wasm/libheif.js`+`.wasm` | — | 별도 fetch | — | node 전용 |
- **wasm-bundle 채택 이유:** WASM 임베드라 **별도 `.wasm` fetch 불요**(`connect-src` 불변) · asm.js보다
  작고(1.4 vs 2.1 MB) 빠름 · esbuild가 **깨끗이 번들**(node-polyfill 플러그인 불요). asm.js는
  `wasm-unsafe-eval`을 피하는 유일 옵션이나 **esbuild 번들 시 node builtin 미해소** → importScripts로만 가능.
  CSP 델타가 토큰 하나뿐(아래)이라 asm.js는 **문서화된 폴백**으로만 남긴다.

---

## 결정 1 — orientation: libheif가 이미 처리한다 (계획 rev#3 우려 **REFUTED**)

`orientedA.heic`(480×300 저장 + irot):

| 디코더 | dims | 코너(TL/TR/BL/BR) |
|---|---|---|
| **libheif-js 1.19.8** (우리 스택) | **300×480** | yellow / blue / lime / red |
| **heif-dec** (libheif C 1.21 레퍼런스) | 300×480 | yellow / blue / lime / red — **완전 동일** |

- libheif-js의 `display()`는 **irot를 픽셀·dims 모두에 적용**하며 레퍼런스 C 라이브러리와 일치.
  → **orientation은 libheif 내부에서 이미 처리됨.** RGBA는 이미 회전된 상태로 나온다.
- **이음새 함의:** HEIC 경로는 `createImageBitmap(imageData)`의 `imageOrientation`에 의존하지 않아도 되고
  (ImageData엔 EXIF가 없어 어차피 no-op) **수동 회전도 넣지 말아야 한다**(넣으면 이중 적용). `get_width/
  get_height`(변환된 dims)와 display 버퍼를 그대로 쓰면 정방향.
- **남는 리스크(P1에서 해소):** ① 합성 샘플은 irot 기반. `sips`(Apple)는 이 파일을 480×300으로 읽어
  **magick의 irot 인코딩이 Apple과 다름**을 시사 — libheif 계열끼리는 일치하므로 우리 스택엔 무관하나,
  **진짜 아이폰 .heic를 repo에 커밋해 재확인**(계획 §7 이미 요구). ② **EXIF-only orientation**(irot 없는
  경우) 적용 여부는 미검증 — 아이폰은 irot을 쓰므로 저위험이나 실샘플로 확인.

## 결정 2 — CSP: `wasm-unsafe-eval` 필요·충분 (계획 H4 확정)

- **대조 실험(토큰 OFF):** 두 접근 모두 `WebAssembly.Module(): Compiling ... violates ... 'unsafe-eval'`로
  **차단** → WASM 컴파일에 `script-src 'wasm-unsafe-eval'`이 **진짜 필요**. **ON이면 위반 0.**
- WASM은 bundle에 임베드 → `connect-src`·자체호스팅 불요. **COEP는 계속 안 켠다**(beacon 보호).
- **⚠️ 감지 주의:** WASM CSP 차단은 문서의 `securitypolicyviolation` 이벤트가 **아니라 워커
  `CompileError`로** 표면화한다. 앱의 "미지원/실패" 감지는 **워커 `onerror`/reject**를 잡아야 한다.
- **P1 잔여 검증:** 라이브에서 `wasm-unsafe-eval` 추가 후 **CF beacon 여전히 로드 · CSP 위반 0** 재확인.

## 결정 3 — 워커 아키텍처: **(i) 전용 워커 채택** (계획 H1·H9 확정)

두 접근 **모두 실산출물로 동작**(디코드 정확 · 지연 로드 · CSP 위반 0 · 디코드 ~11–14 ms/소형):

- **(i) 전용 워커** — `heic.worker.ts`가 libheif를 esbuild로 번들 → `public/workers/heic.js`(1.45 MB).
  runner가 입력 타입으로 HEIC일 때만 `new Worker('/workers/heic.js')`.
- **(ii) 단일 워커 + importScripts** — 작은 워커(2.1 KB)가 런타임에 벤더 `libheif-bundle.js`(1.4 MB)를
  `importScripts` → runner 무변경.

**채택 = (i).** 이유: ① **헤르메틱** — libheif가 `node_modules`에서 esbuild로 번들돼 package.json으로
버전 고정(ii는 1.4 MB 벤더 파일을 `public/workers`로 복사·커밋해야 함) · ② `build-worker.mjs`의 명시적
설계("우리 워커는 우리가 esbuild로 self-contained 번들")를 **그대로 확장**(ii의 importScripts+벤더 블롭은
새 패턴) · ③ 디코드+encode가 한 워커에 공존(compress.worker.ts가 encode를 번들하는 방식과 동형) · ④
[[worker-build-constraint]]("heavy WASM dep needs its own worker entry")와 일치.

**⚠️ 빌드 파이프라인(H9·rev2-A 실증):** esbuild에서 **두 entryPoints + `outfile`은 에러**
(`Must use "outdir" when there are multiple input files`). 따라서 `heic.js`는 `build-worker.mjs`에
**두 번째 `build()` 호출**로 뽑는다(entryPoints에 추가 불가). 부수효과: `encode`/`compress-math`가
`compress.js`·`heic.js` 양쪽 중복 번들(같은 소스라 드리프트 0, `heic.js`에 ~9 KB — 무시 가능).
**별도 build()라 `compress.js`는 바이트 불변(9939 B 확인).**

**(ii)는 검증된 폴백:** 전용 build()/runner 라우팅 부담이 문제가 되면 importScripts 경로로 선회 가능
(벤더 `libheif-bundle.js`가 전역 `libheif` 노출 확인).

---

## P1이 상속하는 것 (이 스파이크로 확정)

1. **라이브러리:** `libheif-js`(runtime dep) — `libheif-js/wasm-bundle`(WASM 임베드) 사용.
2. **워커:** 전용 `heic.worker.ts` → `build-worker.mjs`에 **별도 `build()` 호출**로 `public/workers/heic.js`.
3. **runner:** 입력 타입 분기(HEIC→`heic.js`, 그 외→`compress.js`). HEIC는 **Worker+OffscreenCanvas 요구,
   없으면 미지원 안내**(메인스레드 폴백은 `createImageBitmap(HEIC)`가 던져 무의미 — rev2-B). 감지는 워커
   `onerror`/reject 기준(CSP·미지원 모두 이 경로로 표면화).
4. **이음새(§3):** libheif 디코드 → `{data,width,height}` RGBA → `createImageBitmap(imageData)` →
   기존 encode. **orientation 수동 처리 넣지 않음**(libheif가 이미 적용). `resolveOutputFormat`에
   `image/heic→'jpeg'` 케이스 추가(현재 unknown→webp, rev#5).
5. **CSP:** `script-src`에 `'wasm-unsafe-eval'` 하나 추가. connect-src/COEP 불변. 라이브 beacon 재확인.
6. **검증 자산:** **진짜 아이폰 .heic를 repo에 커밋**(합성 불가·`connect-src`가 외부 페치 차단) — orientation
   최종 확인 + primary item(pitm) 다중이미지 샘플 하나.

## 재현 (스크래치패드 하네스)

`scratchpad/heic-spike/`: `build.mjs`(별도 build() ×3) · `serve.mjs`(프로덕션 CSP 재현, `WASM_EVAL` 토글)
· `drive.mjs`(puppeteer-core 헤드리스: 네트워크 워터폴 + CSP 위반 + 코너 픽셀). 실행:
`node build.mjs` → `PORT=8791 WASM_EVAL=1 node serve.mjs &` → `PORT=8791 node drive.mjs`.
