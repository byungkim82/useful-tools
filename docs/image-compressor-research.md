# 이미지 압축기 — 조사 연구 (경쟁 구성·UI/UX·기능 범위·브라우저 구현·편의기능·로케일)

> **문서 성격:** 로드맵 Tier 1 #1 "이미지 압축/리사이즈"를 짓기 전에 실시한 조사 연구다. 첫 **파일 처리형**
> 도구(지금까지의 QR·단위변환기는 텍스트/숫자 처리)를 어떻게 설계할지의 **근거 문서**이며, 이 위에 별도의
> 세부 구현 계획을 얹는다. 짝 문서: **`image-compressor-implementation-plan.md`**(세부 구현 계획) ·
> `tool-roadmap.md`(도구 우선순위, 이게 Tier1 #1) · `monetization-strategy.md`(수익화).
>
> **방법론:** 3개 병렬 리서치 에이전트 팬아웃 — ① 경쟁 앱 분해(18개 앱, UI/UX·기능·한도·과금) · ② 브라우저
> 전용 구현 기술(라이브러리·코덱·번들·CSP·한계, 11개 토픽) · ③ 편의기능·로케일 GTM·SEO·트러스트. 각 에이전트가
> 실제 페이지/문서/npm/caniuse/GitHub를 페치해 소스 링크를 남겼다.
>
> **⚠️ 신뢰도:** 토큰 절약을 위해 이번엔 **3표 적대적 검증 단계를 생략**했다(단위변환기 run과 달리). 따라서
> 아래는 **"다중 소스로 교차 확인된 수집 결과"**다. 기술 수치(번들 크기·caniuse %·CSP 동작)와 경쟁사 페이지에서
> 직접 읽은 문구·한도는 신뢰도 높음. **검색량·과금 액수·"어느 기능이 제일 원해지나" 류는 단일/2차 소스 추정**이라
> 착수 전 재확인 대상. 본문에 `[V]`(페치 확인)·`[S]`(2차 소스)·`[I]`(추론) 태그로 표시한다.

---

## 0. TL;DR — 설계 결론 6가지

1. **시장은 아키텍처로 깔끔하게 갈린다.** 대형 브랜드(TinyPNG·iLoveIMG·Compressor.io·Kraken·ShortPixel·
   Compress2Go/Img2Go·구 Optimizilla)는 **전부 서버 업로드**. 프라이버시·지역·인디 계열(Squoosh·PiliApp·Karui·
   독일 DSGVO 2종·브라질 WhatsApp 툴·SIA Webby의 신형 imagecompressor.com·인디 compressimage.io 등)은 **전부
   100% 브라우저**. 중간이 거의 없다. `[V]`
2. **"업로드 없음"은 인디+지역 세그먼트에선 이미 table-stakes**가 됐다 — 깨끗한 차별점이 아니다. 오히려
   **"폴리시드 + 광고 없음 + 무제한 + 배치 + 클라이언트"를 동시에 가진 곳이 없다**는 게 진짜 빈틈. `[V/I]`
3. **최대 기능 공백 = 배치.** 가장 유명한 클라이언트 툴 Squoosh가 **단일 이미지 전용**(수년째 최다 요청).
   폴리시드한 배치(큐 + 전역설정 + 이미지별 오버라이드 + 원클릭 ZIP)를 클라이언트로 하면 최강 프라이버시
   경쟁자를 그 약점에서 이긴다. `[V]`
4. **"정확히 X KB로"는 기능인 동시에 최대 롱테일 SEO 표면**이다. 수요는 큰데(WhatsApp·이메일·증명사진·관공서
   폼) **대형 브랜드는 아무도 제공 안 함**, 클라이언트 툴 중에도 4개(PiliApp·Compress2Go·Img2Go·
   bulkimagecompressor)뿐. 구현은 저렴(품질 이진탐색). `[V/I]`
5. **브라우저 100%는 헤더 없이 충분히 가능하다.** Canvas 경로는 번들·헤더 0. jSquash WASM 코덱도
   `SharedArrayBuffer` 없으면 싱글스레드로 자동 폴백 → **COOP/COEP 불필요**. 진짜 무거운 건 AVIF **인코딩**뿐. `[V]`
6. **프라이버시 해자는 "증명 가능"해야 전환된다.** 사용자가 실제로 비행기모드·네트워크탭 테스트를 한다.
   "직접 검증해보세요" + PWA 오프라인 설치를 살아있는 증거로 실으면 배지 한 줄보다 강하다. `[S]`

---

## 1. 경쟁 앱은 어떻게 구성되어 있나 (아키텍처 축)

가장 중요한 축은 **서버 업로드 vs 100% 클라이언트**다. 이게 기능 한도·프라이버시 문구·과금을 전부 결정한다.

| 앱 | 처리 | 출력 포맷 | 배치(무료) | 최대 파일(무료) | 품질 모델 | 광고/과금 |
|---|---|---|---|---|---|---|
| **Squoosh** (Google) | **브라우저 WASM** | AVIF·MozJPEG·WebP·JXL·OxiPNG | **1장(단일)** | RAM 한도 | 슬라이더+리사이즈+라이브 프리뷰 | 없음(Apache-2.0) |
| **imagecompressor.com** (SIA Webby) | **브라우저 WASM** | JPEG·PNG·WebP·GIF·SVG | 20 | 50 MB | 슬라이더 10–100(기본 80) | AdSense |
| **PiliApp** (다국어) | **브라우저** | JPG·PNG·WebP·HEIC→JPG | 무제한 표기 | 없음 | 슬라이더+퀵버튼+**타깃KB**+최대치수 | 없음(툴) |
| **Karui** (JP) | **브라우저**(웹) | JPEG·PNG·WebP | 1일 20장 | — | 3프리셋+리사이즈 | **$29 일회성** 데스크톱 |
| **compressimage.io** (인디) | **브라우저** | JPEG·PNG·+WebP변환 | **무제한** | **없음** | 슬라이더(기본 70)+리사이즈 | 없음 |
| **bulkimagecompressor** (인디) | **브라우저** | JPEG·PNG·WebP | **무제한** | **없음** | 슬라이더+**타깃KB/MB**+최대치수 | 없음 |
| **bild-komprimieren.de** | **브라우저** | JPG·PNG·WebP | 10장 | 10 MB | 슬라이더(기본 80)+리사이즈 | AdSense |
| **TinyPNG** | **서버**(48h 보관) | AVIF·JXL·WebP·PNG·JPEG | 20/세션 | **5 MB** | **자동만**(슬라이더 없음) | 무료에 광고 / Pro $39·$149/yr |
| **iLoveIMG Compress** | **서버**(2h) | JPG·PNG·SVG·GIF | 30/작업 | 200 MB | **자동만** | 무료 광고 / $5/mo |
| **Kraken.io** | **서버**(12h) | JPG·PNG·GIF·SVG·WebP·AVIF·HEIC | 20/배치 | **1 MB** | 로시/로슬리스/**전문가**(크로마 등) | GB종량 $5–79/mo |
| **ShortPixel** | **서버** | JPG·PNG·GIF→+WebP/AVIF | ~50/배치 | 10 MB(로그인시 해제) | **로시/글로시/로슬리스** | 100크레딧/mo 무료 |
| **Compress2Go / Img2Go** (QaamGo, DE) | **서버**(24/72h) | JPG·PNG·GIF(±WebP) | 제한/무료엔 없음 | ~100 MB | 프리셋+로슬리스+**타깃KB**+%+슬라이더 | 크레딧제 |
| **Optimizilla**(구) | **서버**(1h 소거) | JPEG·PNG·GIF | 20 | 50 MB | 자동+이미지별 슬라이더+APPLY | AdSense 13슬롯 |

출처(대표): [squoosh.app](https://squoosh.app) · [github/GoogleChromeLabs/squoosh](https://github.com/GoogleChromeLabs/squoosh) · [imagecompressor.com](https://imagecompressor.com/) · [es.piliapp.com/image/compress](https://es.piliapp.com/image/compress/) · [karui.app/compress](https://karui.app/compress/) · [compressimage.io](https://compressimage.io/) · [bulkimagecompressor.com](https://bulkimagecompressor.com/) · [bild-komprimieren.de](https://bild-komprimieren.de/) · [tinypng.com](https://tinypng.com) · [iloveimg.com/compress-image](https://www.iloveimg.com/compress-image) · [kraken.io/web-interface](https://kraken.io/web-interface) · [shortpixel.com/online-image-compression](https://shortpixel.com/online-image-compression) · [compress2go.com](https://www.compress2go.com/compress-image) · Optimizilla는 [Wayback 2025-12-28](https://web.archive.org/web/20251228073828id_/https://optimizilla.com/).

> **주목:** Optimizilla를 운영하는 **SIA Webby(라트비아)가 서버 엔진 → WebAssembly 100% 클라이언트 스택으로
> 이전 중**(imagecompressor.com·compressjpeg.com·compresspng.com). 즉 우리는 이 지형을 *도입*하는 게 아니라
> 그 위에서 *경쟁*한다. 무기는 "no-upload" 그 자체가 아니라 그것의 **완성도·무제한·무광고·배치·증명**이다. `[V]`

---

## 2. UI/UX 패턴 — 지배적 관례

### 2.1 캐노니컬 3박자 흐름 (배치형 툴의 사실상 표준)
Optimizilla가 정의하고 SIA Webby 계열이 템플릿화, ImageTools·PiliApp·독일 툴이 그대로 답습: `[V]`

```
① 큰 중앙 드롭존           ② 썸네일 큐/그리드                       ③ 다운로드
  "Drop your files here"      각 썸네일 클릭 → 이미지별 품질 슬라이더    파일별 다운로드
  + SELECT FILES              + APPLY + before/after 비교              + SAVE/DOWNLOAD ALL (ZIP)
```

### 2.2 두 가지 비교 관용구
- **(a) 드래그 분할 슬라이더** — 한 이미지 위에서 원본↔압축을 밀어 비교(TinyPNG "move the slider", Squoosh
  2패널 divider, SIA Webby `comparisonThumb`, Compressor.io). **더 "프리미엄/딜라이트"하게 느껴짐.** `[V]`
- **(b) 나란히 패널 + 통계표** — 원본|압축 + % 절감 테이블(Kraken "Original vs Kraked", ShortPixel). **배치에
  더 잘 확장됨.** `[V]`

### 2.3 프리셋 vs 슬라이더
- 소비자·지역 툴은 **네임드 프리셋**으로 수렴(Karui High/Balanced/Smallest, Compress2Go Less/Recommended/
  Extreme, ShortPixel lossy/glossy/lossless) — 생짜 0–100 슬라이더가 비기술 사용자에겐 위압적이라. `[V]`
- 파워툴은 **숫자 슬라이더** 유지(Kraken Expert). **베스트는 둘 다** — 프리셋 버튼이 슬라이더도 같이 움직이게
  (PiliApp의 92/80/60 퀵버튼이 정확히 그렇게 함). `[V]`

### 2.4 훔칠 만한 딜라이트 터치
- **콜드스타트 제거용 데모 이미지** ("Or try one of these" — Squoosh). `[V]`
- **슬라이더 드래그 시 라이브 재인코딩**(압축 버튼 왕복 없이 즉시 피드백 — Squoosh). `[V]`
- 이미지별 **"-68%" 배지**, **Ctrl+V 붙여넣기 시작**(PiliApp/Squoosh/Resizo), **폴더 드롭**(TinyPNG Ultra). `[V]`
- **"자동 변환" + 전체선택**(TinyPNG "Convert my images automatically" + Select all). `[V]`

> **Squoosh는 의도적 이단아:** 단일 이미지 풀블리드 **에디터**(코덱 드롭다운 + 실시간 크기 readout). 가장
> "앱 같고" 가장 사랑받지만 **배치를 통째로 포기**했다. 우리가 취할 교훈: *에디터의 라이브 프리뷰 감성 + 배치의
> 실용성*을 결합. `[V/I]`

---

## 3. 기능 범위 — 어디까지 제공하나

### 3.1 Table stakes (없으면 "고장난 것처럼" 보임)
드래그드롭+클릭 · **JPEG/PNG/WebP** 입출력(WebP는 이제 당연) · **before/after 크기+% 절감 통계** · 어떤 형태든
before/after 프리뷰 · 파일별 다운로드 + **일괄 다운로드(보통 ZIP)** · **계정 불필요·워터마크 없음** · **자동/스마트
기본 압축**(제로컨피그 사용자도 즉시 좋은 결과). `[V]`

### 3.2 차별화 요소 (일부만 가짐)
| 기능 | 보유처 | 비고 |
|---|---|---|
| **타깃 파일 크기("X KB 이하로")** | PiliApp·Compress2Go·Img2Go·bulkimagecompressor | **희소+고가치.** 대형 브랜드 전무. |
| **AVIF 출력** | Squoosh·TinyPNG·ShortPixel·Kraken·bilderkomprimieren.de | 여전히 드묾, 특히 클라이언트. |
| **HEIC 입력**(아이폰 사진) | Kraken·TinyPNG·ShortPixel·PiliApp·Karui(데스크톱) | 실사용 큰 승리; 클라이언트 툴 대부분 미보유(WASM 디코더 필요). → **별도 HEIC 도구**로 분리(로드맵). |
| **전문가 컨트롤**(크로마 서브샘플링·EXIF 유지) | Kraken·Compress2Go·PiliApp | 파워유저 표면. |
| **로시/로슬리스 명시 토글** | Compressor.io·Kraken·ShortPixel | ShortPixel "glossy" 중간티어가 독특. |
| **압축기 내 리사이즈**(치수/%) | Squoosh·Compress2Go·PiliApp·compressimage.io·bulk·Karui·독일툴 | 클라이언트엔 흔함, Kraken은 이상하게 PRO. |
| **WhatsApp/소셜 치수 프리셋** | **Resizo 단독** | BR/LatAm 열린 니치. |
| **Ctrl+V 붙여넣기** | Squoosh·PiliApp·Resizo·Compress2Go | 작은 딜라이터, 대부분 없음. |
| **오프라인 PWA** | Squoosh·compressimage.io | 클라이언트의 자연스러운 확장. |
| **진짜 무제한**(파일/크기/개수 무캡) | Squoosh·compressimage.io·bulk·PiliApp | 로컬 처리라서만 가능. |

### 3.3 빈틈 (기회 지도)
1. **"클라이언트 + 무광고 + 무제한 + 좋은 UX"가 공존하는 곳이 없다.** Squoosh=무광고·무제한이지만 **배치 없음**;
   SIA Webby=배치·클라이언트지만 **광고 8–13개/페이지 + 20파일/50MB 캡**; compressimage.io/bulk=무제한·무광고지만
   빈약·수명 불확실. **← 가장 명확한 쐐기.** `[V/I]`
2. **클라이언트 배치가 미완성.** 폴리시드한 다중파일 큐(이미지별 오버라이드+전역설정+원클릭 ZIP)를 클라이언트로
   하는 열린 레인. `[V]`
3. **타깃 파일 크기 희소+수요 큼.** 소셜/WhatsApp 치수 프리셋(Resizo 단독)과 페어링하면 소비자 세그먼트 장악.
4. **클라이언트 AVIF/HEIC 얇음.** WASM으로 로컬 처리는 진짜 기술 차별화(단, HEIC은 별도 도구).
5. **프라이버시는 주장만 하고 증명은 없다.** "직접 검증"(오프라인·네트워크탭·오픈소스) 각도가 미점유.
6. **대형 무료티어 천장이 약점:** Kraken 1MB·Compressor/ShortPixel 10MB·TinyPNG 5MB+20장+변환 3회·Img2Go
   무료 배치 없음 — 기기 처리 툴에선 전부 사라지는 한도. 포지셔닝에 명시할 것.

---

## 4. 브라우저 전용 구현 방식 (기술 코어)

**결론(BLUF):** 우리 제약(static export → Cloudflare Workers · `ssr:false` island · **COOP/COEP 회피**)에서
**Canvas 우선 + WASM는 필요할 때만 지연로드**로 아주 잘 된다.

### 4.1 후보 접근 비교
| 접근 | 출력 포맷 | 번들(raw / ≈gz-brotli) | 품질 | COOP/COEP | 노력 |
|---|---|---|---|---|---|
| **Canvas `toBlob`** | JPEG·PNG·WebP | **0 KB** | 좋음; 다운스케일 브라우저의존·JPEG 약함·AVIF 불가 | **불필요** | 낮음 |
| **browser-image-compression** | JPEG·PNG·WebP | 56 KB / ≈13 KB | 좋음(canvas 엔진)+실제 타깃크기 루프+EXIF | **불필요** | 낮음 |
| **@jsquash/jpeg**(mozjpeg) | JPEG | 246+163 KB / ≈200 KB | **더 좋은** JPEG·결정론적 | **불필요**(ST 폴백) | 중 |
| **@jsquash/webp** | WebP | 275+135 KB / ≈220 KB | 높음+네이티브 `target_size` | **불필요** | 중 |
| **@jsquash/avif** | AVIF | **3404+1143 KB** / ≈1.5 MB | **최고 압축비**, but 인코딩 느림 | **불필요**(ST폴백) | 중상 |
| **@jsquash/oxipng** | PNG(로슬리스 최적화) | 160 KB / ≈90 KB | 로슬리스 절감 | **불필요** | 하중 |
| **WebCodecs** | (이미지 인코더 없음) | 0 KB | 스틸엔 무의미 | — | 스킵 |
| **fflate (ZIP)** | .zip | 8 KB / ≈4 KB | — | **불필요** | 낮음 |
| **HEIC(libheif/heic2any)** | 디코드 전용 | 2.6–6.2 MB | — | 불필요 | 상 — **별도 도구** |

> WASM/JS 크기는 jsDelivr/npm 실측 raw 바이트. Cloudflare가 Brotli로 전송 시 WASM ≈40–50%, JS ≈30–35%로 줄어듦.
> gz/brotli 수치는 raw에서 추정(`≈`).

### 4.2 핵심 기술 사실
- **`canvas.toBlob(cb, type, quality)`** — PNG 필수, JPEG/WebP 널리 지원. **`image/avif`는 어떤 브라우저도
  toBlob로 인코딩 못함**(알 수 없는 타입은 조용히 PNG 폴백). WebP caniuse **96.15%**, AVIF **93.42%**. `[V]`
  ([MDN toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) · [caniuse webp](https://caniuse.com/webp) · [avif](https://caniuse.com/avif))
- **`OffscreenCanvas.convertToBlob` + Web Worker** — Chrome 69+/FF 105+/**Safari 16.4+**. `createImageBitmap(blob,
  {resizeQuality, imageOrientation:'from-image'})`로 워커에서 디코드+다운스케일+EXIF 방향 자동적용. `[V]`
- **jSquash COOP/COEP 불필요(결정적):** 스레드 코덱이 `wasm-feature-detect`로 **`SharedArrayBuffer` 없으면
  싱글스레드 wasm으로 자동 폴백**. 멀티스레드 빌드는 크로스오리진 격리일 때만 로드. `single-thread-only` 핀
  빌드도 존재. `[V]` ([@jsquash/avif README](https://raw.githubusercontent.com/jamsinclair/jSquash/main/packages/avif/README.md))
- **WebCodecs엔 `ImageEncoder`가 없다** — 스틸 인코딩 불가, 스킵. `ImageDecoder`(디코드)는 있으나 압축기엔 불요. `[V]`

### 4.3 타깃 크기 알고리즘 (X KB 맞추기)
품질 파라미터에 **이진탐색**: 1회만 디코드 → `qLow=0,qHigh=1` → `q=(lo+hi)/2`로 인코딩·바이트측정·이분 →
6–8회에 몇 % 이내 수렴. **함정:** ① **디코드 1회, 재인코딩 다회**(매회 재디코드가 흔한 버그) · ② 품질→크기가
극단부에서 완전 단조는 아님(반복 클램프, "타깃 이하 최근접" 수용) · ③ **최소 품질 바닥** 두고 그래도 초과면
**치수 다운스케일로 폴백**(browser-image-compression의 `maxIteration` 동작) · ④ **WebP는 libwebp `target_size`
(바이트)로 한 번에** — JS 루프 생략 가능. `[V]`

### 4.4 리사이즈 / EXIF / ZIP / 한계
- **리사이즈:** 최대치수(`scale=maxDim/max(w,h)`, ≤1 클램프로 업스케일 방지)·%·정확WxH. Canvas는
  `imageSmoothingQuality='high'` + **단계적 반감**(큰 축소는 절반씩 반복 후 최종 draw)으로 앨리어싱 방지. 더 샤프한
  Lanczos는 `@jsquash/resize`(+34KB, 옵션 토글). `[V]`
- **EXIF:** canvas 재인코딩이 **기본으로 전 메타데이터 제거**(GPS·카메라·타임스탬프 — 프라이버시 이득). **방향
  함정:** EXIF 제거하면 orientation도 사라져 사진이 옆으로 눕는다 → `createImageBitmap(file,{imageOrientation:
  'from-image'})`로 회전을 캔버스에 굽거나 라이브러리의 orientation 처리 사용. `[V]`
- **ZIP:** **fflate**(~8KB, 스트리밍, 워커, 헤더 불요) > JSZip(95KB, 메인스레드 블록). 이미지는 이미 압축돼
  있으니 **store/level 0**(디플레이트 스킵). `[V]` ([fflate](https://github.com/101arrowz/fflate))
- **한계:** iOS/Safari **canvas 최대 면적** — 구형 16.7M px(≈4096²), **iOS 18에서 8192²로 상향**. DPR 주의
  (1600² @DPR3 = 실제 4800²). 디코드 이미지는 `w×h×4` RGBA(12MP ≈ 48MB 라이브) → 모바일 Safari OOM 탭킬.
  **순차 또는 2–3장씩** 처리, `bitmap.close()`·objectURL revoke로 적극 해제. **워커 오프로드는 COOP/COEP 불요**
  (SharedArrayBuffer 멀티스레드만 헤더 필요, 우린 안 씀). `[V]` ([pqina canvas 한계](https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/))

### 4.5 HEIC 경계
jSquash도 browser-image-compression도 **HEIC 디코드 불가**, 브라우저도 canvas로 신뢰성 있게 못 함. libheif
빌드 필요(`heic2any` 2.6MB / `libheif-js` 6.2MB) → **로드맵의 별도 HEIC 도구**로. 거기서 HEIC→ImageData 디코드 후
공유 압축기로 넘긴다. **압축기 메인 번들엔 libheif 넣지 않는다.** `[V]`

---

## 5. 사용자가 좋아하는 편의기능 (우선순위)

클라이언트 처리 노력 메모: `canvas.toBlob()`은 JPEG/PNG/**WebP** 네이티브 인코딩(저렴), EXIF는 재인코딩 시 자동
제거, ZIP은 fflate, "정확히 X KB"는 품질 이진탐색(순수 JS). **AVIF 인코딩·HEIC 디코드만** 무거운 WASM 필요. `[I]`

### Table stakes (v1 — 없으면 미완성)
드래그드롭+파일피커 · **배치/벌크**(Squoosh의 치명적 공백) · 품질 슬라이더+라이브 before/after(크기+% 절감) ·
파일별+총계 "X MB→Y KB / 절감%" · **일괄 다운로드(ZIP)**+원본명 유지 · 아이템 제거/전체 지우기/리셋 ·
**EXIF 제거(기본 ON)+자동 방향보정** · 다크모드·모바일 우선·기본 a11y.

### High-value (가능하면 v1 — 강한 견인 + 저렴)
- **타깃 출력 크기("100KB 이하/정확히")** — 거대한 검색 의도+실수요(관공서 폼·증명사진·독일 지원서·이메일),
  대부분 클라이언트 툴이 스킵 → 차별화. 구현 저렴(품질 이진탐색). `[S/I]`
- **리사이즈**(최대치수/%/정확WxH/비율잠금) — KB 타깃 달성의 최대 레버("리사이즈만으로 종종 90% 절감"). 독일선
  *verkleinern*(치수)≠*komprimieren*(용량)로 **별도 검색 의도**. `[S]`
- **WebP 출력**(네이티브 canvas) — JPEG보다 25–35% 작고 2026 범용 지원, 거의 공짜. `[S]`
- **Ctrl+V 붙여넣기 + 폴더 업로드(`webkitdirectory`) + 시작 후 추가** — 저노력·고딜라이트. `[S]`
- **전역 기본설정 + 이미지별 오버라이드** — Squoosh 유저가 명시적으로 원하는 워크플로. `[S]`
- **PWA/오프라인 설치** — 프라이버시 주장의 *증거* 역할(와이파이 꺼도 작동). `[S]`

### Delight / 차별화 (v1.5–v2)
- **프리셋**(WhatsApp·이메일·웹/블로그·소셜·증명사진) — 로케일 GTM 훅. 구체 타깃: WhatsApp 상태 1080×1920·
  프로필 500×500·스티커 512×512 WebP<100KB; 증명사진 3×4cm=354×472px, ≤500KB. `[S]`
- **HEIC→JPEG/WebP**(libheif) — JA/아이폰 특정 통증, **별도 도구**로. `[S]`
- **AVIF 인코딩**(WASM) — WebP 검증 후. ~JPEG 대비 70% 절감. `[S]`
- **before/after 비교 슬라이더 + 줌/팬**, 키보드 단축키. `[S]`

### v1 범위 밖
이름 패턴/재정렬/실패재시도 세분화 · AI 배경제거·워터마크·업스케일·크롭·얼굴블러(별도 도구, v1 희석) ·
Squoosh식 이미지별 인코더 미세튜닝(소비자 과투자). `[S]`

---

## 6. 로케일별 수요·프레이밍 (6개 시장 = 번역 아님)

키워드 *형태*는 관찰된 랭킹 페이지/쿼리에서 `[I]`(하드 볼륨 없음), 프레이밍 근거는 `[S]`.

| 시장 | 헤드/롱테일 | 각도(랜딩 헤드라인) | 근거 |
|---|---|---|---|
| 🇬🇧🌐 **EN** | "image compressor" / **"compress jpg to 100kb" 사다리**(5·10·20·50·100·200·500KB 동일 패턴)+여권/서명/관공서(20–50KB) | "Compress JPG to exactly 100 KB — free, no upload, in your browser." | [jpeg-optimizer 사다리 인터링크](https://jpeg-optimizer.com/compress-jpeg-to-100kb/) |
| 🇩🇪 **DE**(해자 최강) | **komprimieren**(용량)vs**verkleinern**(치수) 별개 · "ohne Upload"·"DSGVO-konform"·Bewerbungsfoto<100/500KB · 첨부한도 Web.de **4MB**/GMX **20MB** | **DSGVO+no-upload를 메인 헤드라인**으로 | [bild-komprimieren.de](https://bild-komprimieren.de/) · [GMX 한도](https://spacehost.de/max-groesse-einer-mail-25-mb/) |
| 🇧🇷 **PT/BR** | "comprimir/reduzir imagem"·"para enviar no WhatsApp"·"sem perder qualidade" | "Comprima sua imagem para enviar — sem enviar seus arquivos a nenhum servidor." (WhatsApp가 자동압축하니 각도는 "**문서로 보내기 전 직접·품질통제**") | [roundcut WhatsApp](https://roundcut.com.br/blog/como-enviar-foto-whatsapp-sem-perder-qualidade/) |
| 🇪🇸 **ES/LatAm** | "comprimir imagen/foto" · iLoveIMG 지배(**서버 업로드**) | "Comprimir imagen **sin subir archivos** — privado, sin registro." (iLoveIMG 업로드 모델에 정면) | [ComprimeFotos](https://comprimefotos.com/) · [iLoveIMG es](https://www.iloveimg.com/es/comprimir-imagen) |
| 🇯🇵 **JA** | "画像 圧縮/軽量化"·"アップロード不要"·인접 **"HEIC JPEG 変換"**·"iPhone 写真 送れない" | "画像をブラウザだけで軽量化 — アップロードなし" + **HEIC→JPEG 별도 진입점** | [renue HEIC](https://renue.co.jp/posts/heic-to-jpg-conversion) · [jp.piliapp](https://jp.piliapp.com/image/compress/) |
| 🇰🇷 **KO** | "이미지 용량 줄이기"·"사진 압축"·**"증명사진 용량"**·"이력서 사진"·"사진 kb 줄이기" | "이미지 용량 줄이기 — 서버 업로드 없이, 로그인·광고 없이" + **증명사진/이력서 프리셋**(≤500KB) | [ttol82 증명사진](https://ttol82.com/185) · [잡코리아 사진툴](https://www.jobkorea.co.kr/service/user/tool/photo) |

**프레이밍 유형 3가지가 뚜렷:** DE=**법/컴플라이언스**("Ohne Upload/DSGVO-konform"), BR=**유스케이스**(WhatsApp
"sem perder qualidade"), JP=**감성 프라이버시+HEIC**("大切な写真は、あなたの手元に"). **한 엔진 + 로케일별 프레이밍**은
PiliApp이 이미 검증한 저비용 확장 경로이고, 우리 멀티로케일 구조와 정확히 맞는다. `[V]`

---

## 7. SEO 랜딩 패턴 & 트러스트

### 7.1 랭킹 페이지 아키텍처 `[S/I]`
1. **포맷 서브페이지:** `/compress-jpg`·`/compress-png`·`/compress-webp`(+변환 `heic-to-jpg`·`jpg-to-webp`).
   TinyPNG·iLoveIMG·imagecompressor·jpeg-optimizer 표준.
2. **타깃 크기 매트릭스:** `/compress-jpg-to-100kb`와 **전체 KB 사다리(5→500KB)** — jpeg-optimizer가 전부 인터링크,
   최고 수율 롱테일. **단, 우리 아키텍처에선 slug당 6로케일 dict 블록이 필요 → i18n 비용 큼**(구현계획서에서 결정).
3. **유스케이스 페이지:** 여권사진·서명·관공서폼·WhatsApp·이메일첨부 + 현지 쌍둥이(DE *Bewerbungsfoto*, KO
   *증명사진*).

### 7.2 페이지 콘텐츠 `[S]`
툴을 폴드 위 · **how-to 3–4단계**(업로드→품질/타깃설정→before/after 프리뷰→다운로드) · 포맷별 설명(로시vs로슬리스) ·
**FAQ 블록**. **JSON-LD:** `WebApplication`/`SoftwareApplication` + **`HowTo`**(단계) + **`FAQPage`**(Q&A). 우리
페이지는 이미 WebApplication+FAQPage를 실으니 **HowTo만 추가**하면 됨. FAQ는 실제 사용자 질문에서 작성. `[S]`

**실제로 자주 묻는 FAQ:** 무료인가? · **내 이미지가 업로드되나/안전한가?** · 화질 떨어지나? · 어떤 포맷 지원? ·
정확히 X KB로 어떻게? · 파일 개수/크기 제한? · 모바일/오프라인 되나? · 그냥 리사이즈랑 뭐가 다른가?

### 7.3 트러스트 — "업로드 없음"을 *증명*하기 `[S]`
경쟁사 문구: "your files never leave your device"·"processed in your browser using WebAssembly"·ES "nunca ven,
copian ni almacenan"·DE "kein Upload, 100% DSGVO-konform". **업로드하는 경쟁사는 "즉시/20분/30분 후 삭제"로
프레이밍** → 우리 카운터: **"남들은 나중에 삭제한다고 약속한다. 우리는 애초에 받지 않는다."**
증명 장치: ① "직접 검증" 섹션(와이파이 끄기 → 여전히 작동, DevTools Network → 이미지 POST 없음 확인) · ②
**PWA 설치/오프라인** = 가장 강한 증거 · ③ 무가입·무워터마크·무광고 자체가 프라이버시 신호. 로케일별 훅 현지화.

---

## 8. 우리 사이트 제약과의 정합 (요약 — 상세는 구현계획서)
- **`ssr:false` client island** = 브라우저 전용 Canvas/WASM/File API 얹기 완벽한 자리(이미 QR·컨버터가 이 패턴).
- **COOP/COEP 회피 유지** = beacon(`static.cloudflareinsights.com`) 보호. Canvas 우선 + jSquash 싱글스레드 폴백으로
  헤더 0. **유일한 필수 CSP 변경: `img-src`에 `blob:` 추가**(objectURL 프리뷰/다운로드). WASM 지연로드 시
  `script-src 'wasm-unsafe-eval'` 추가(AVIF 단계).
- **UI 라벨 = 코드 맵**(labels.ts 방식), 로케일 JSON = SEO만 — 컨버터가 이미 이렇게. 8슬러그×6로케일이 아니라
  코드 1편집.
- **순수 로직 + Vitest** — 인코딩 자체는 브라우저API지만 **타깃크기 이터레이션·리사이즈 치수계산·파일명 생성·
  바이트 포맷·프리셋 해석은 순수 함수로 분리** 가능(테스트 경계).
- **static export + `pnpm run deploy`**(⚠️ `pnpm deploy` 아님) · 라이브러리 도입은 `output:'export'`에서 실제
  빌드·동작 검증(verify, don't claim).

---

## 9. 미확인 / 재확인 대상
- ⚠️ **모든 검색량·과금 액수는 단일/2차 소스 추정** — 착수 전 GSC/키워드 도구로 재확인. TinyPNG Pro/Ultra
  달러값·Compressor.io(사이트 봇차단, 전부 2차)·ShortPixel 배치수는 특히 약함.
- ⚠️ **"to X KB" 사다리 SEO 수율 vs i18n 비용** — slug당 6로케일 dict가 필요한 우리 구조에서 ROI 판단 필요
  (구현계획서 §8에서 결정: 소수 고가치 유스케이스 slug만 vs 전체 사다리 vs 생성형 블록 인프라).
- ⚠️ **browser-image-compression 워커의 CSP 상호작용**(blob 워커 + 외부 `libURL`) — 실제 빌드에서 검증 필요
  (구현계획서 §9: 자체 워커 or `useWebWorker:false` or 자체호스팅 libURL 중 결정).
- ⚠️ **3표 적대적 검증 생략** — 큰 항목(아키텍처 분기·기술 타당성·번들크기·로케일 프레이밍)은 다중소스 교차확인,
  세부는 구현 중 검증.

---

## 부록 — 핵심 소스
**경쟁/UX:** squoosh.app·github/GoogleChromeLabs/squoosh(+[이슈 #301 배치요청](https://github.com/GoogleChromeLabs/squoosh/issues/301)) · imagecompressor.com · es.piliapp.com/image/compress · karui.app · compressimage.io · bulkimagecompressor.com · bild-komprimieren.de · tinypng.com·tinify.com/pricing · iloveimg.com/compress-image · kraken.io/web-interface · shortpixel.com · compress2go.com·img2go.com · imagetools.com.br · resizo.in.
**기술:** [browser-image-compression npm](https://www.npmjs.com/package/browser-image-compression)·[README](https://github.com/Donaldcwl/browser-image-compression) · [jSquash](https://github.com/jamsinclair/jSquash)·[README](https://raw.githubusercontent.com/jamsinclair/jSquash/main/README.md) · [MDN toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob)·[OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)·[WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) · [caniuse avif](https://caniuse.com/avif)·[webp](https://caniuse.com/webp) · [fflate](https://github.com/101arrowz/fflate) · [canvas 최대면적](https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/).
**편의/로케일/트러스트:** jpeg-optimizer.com · roundcut.com.br · comprimefotos.com · renue.co.jp · ttol82.com · jobkorea 사진툴 · practicaltools.co/trust · sammapix.com privacy guide.

*(도구별 구체 구현 스펙은 `image-compressor-implementation-plan.md`. 이 문서는 "무엇이 있고·무엇이 빈틈이고·
무엇으로 지을 수 있나"의 근거 계층이다.)*
