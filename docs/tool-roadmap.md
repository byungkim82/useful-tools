# 도구 로드맵 — 다음에 추가할 유틸리티 도구 (6개 로케일)

> **문서 성격:** QR 스위트 다음에 "무엇을, 어떤 순서로, 어떤 라이브러리로, 어느 로케일을 노려" 추가할지
> 정리한 **로드맵 + 백로그** 문서다. 근거는 2026-07-16 실행한 다중 소스 웹 리서치(아래 방법론)이고, 전부
> 이 사이트의 실제 제약(static export → Cloudflare Workers · $0 서버 · 100% 클라이언트 · 프라이버시 해자 ·
> 6개 로케일 hreflang)으로 걸렀다. 코드는 아직 안 건드렸다.
>
> **짝 문서:** `qr-generator-growth-seo.md`(유입) · `qr-generator-improvements.md`(QR 기능) ·
> `monetization-strategy.md`(수익화) · `.claude/skills/extend-tools/`(도구 추가 실행 규약).
>
> **우선순위 원칙(메모리 고정):** **소비자용 도구 먼저, 시간 남으면 개발자용.** 실사용 빈도가 가장 크고
> 검색 발견 + 프라이버시 해자에 가장 잘 맞기 때문.

---

## 0. 방법론 & 신뢰도 (정직하게)

- **리서치 방식:** deep-research 하네스 — 6개 검색 앵글 팬아웃(글로벌 EN 수요 · 한/일 문화특화 · 독일 DSGVO ·
  브라질/스페인어 · 클라이언트 기술 타당성 · SEO 경쟁) → 27개 소스 페치 → **121개 falsifiable claim** 추출.
- **⚠️ 검증(verify) 생략:** 토큰 절약 위해 3표 적대적 검증 단계를 건너뛰고 ~95% 지점에서 종합했다. 따라서
  아래는 **"다중 소스로 교차 확인된 수집 결과"**이지 정식 검증 완료가 아니다. 여러 소스에서 반복 확인된 큰
  항목(HEIC 클라이언트 타당성, 거인들의 서버 업로드 모델, DE no-upload 수요, KO 평/만나이)은 신뢰할 만하고,
  단일 소스·미확인 항목은 본문에 표시했다. **수치(방문수·KD 등)는 단일 소스 추정 — 실행 전 재확인 대상.**

## 1. TL;DR — 교차 확인된 핵심 3가지

1. **인터랙티브 유틸 도구 = AI Overview가 못 먹는 "do 검색" 트래픽.** 툴 허브는 거대하게 스케일한다(단일 소스:
   Omni Calculator ~월 230만 US 방문, FreeConvert 5년간 38만→150만, Adobe PDF→Word ~38.5만/월). → 전략 유효.
2. **해자가 구조적으로 진짜다.** SERP를 지배하는 거인 전부(iLovePDF·Smallpdf·Adobe·PDF24)가 **파일을 서버로
   업로드**한다(삭제는 1~2시간 뒤). 100% 클라이언트 "no upload"는 리더들이 **아직 안 가져간, 소스로 감사 가능한**
   차별점. **독일(DSGVO)에서 가장 강하게 먹힌다.**
3. **헤드 용어(KD 80+)는 못 이긴다 → 롱테일 + 현지화 + no-upload가 쐐기.** 현지 완전일치 도메인(heic-zu-jpg.de,
   PiliApp ES 등)이 이미 있으나 **배치 한도·프라이버시 미점유** 갭이 열려 있다.

---

## 2. 랭킹된 후보 (소비자용 우선)

효과(수요)·구현성·해자 적합·노력 종합. **모든 항목 CS=클라이언트 사이드**(범위 밖 제외).

### Tier 1 — 지금 지어야 할 코어 (수요·해자·구현성 최상, 전 시장)

| # | 도구 | 수요 / 편중 시장 | 라이브러리(번들) | 경쟁 | 해자 | 노력 |
|---|---|---|---|---|---|---|
| 1 | **✅ 이미지 압축/리사이즈** — **v1 구현·배포 완료**(자체 Canvas 워커, 목표 KB/MB는 v1.1). 상세: `implementation-status.md` §1.3 | 압도적·전 시장. BR/PT·JA 편중(WhatsApp·이메일 첨부) | ~~browser-image-compression / jSquash~~ → **자체 Canvas 워커**(esbuild→public 번들, 순수 store-only ZIP) | 높음, but 대부분 **서버 업로드형** | ✅강 | 중 |
| 2 | **HEIC→JPG 변환** | 높음·전 시장, **JA·DE 편중**(아이폰 기본 포맷) | heic2any(→JPG/PNG/GIF) 또는 libheif-wasm. ⚠️**jSquash엔 HEIC 없음** | 현지 경쟁자 有, but **배치 한도·데스크톱앱 유도** 갭 | ✅강 | 중 |
| 3 | **PDF 합치기/분할/회전/페이지삭제·추출** | 성숙·**6개 로케일 전부**. 미세연산 **개별 검색됨**(rotate, delete pages를 따로 검색) | pdf-lib(브라우저=Node 동일, edit/merge/split 가능) | iLovePDF/PDF24 지배 but **전부 업로드** | ✅강(DE 최강) | 중 |
| 4 | **이미지 ↔ PDF** (이미지→PDF, PDF→이미지) | 서류 제출(비자·학교·관공서). 병합 워크플로에 번들됨 | pdf-lib / pdf.js | 갭 동일 | ✅강 | 중 |
| 5 | **PDF 압축** | **DE 강력**(GMX·Web.de·Moodle·관공서 5–20MB 첨부한도, 입사지원 <5MB) | Ghostscript-WASM(격리 WebWorker) + pdf-lib | 대부분 업로드형 | ✅강 | 중~상 |

### Tier 2 — 강하지만 더 무겁거나 로컬 특화

| # | 도구 | 수요 / 시장 | 라이브러리(번들) | 비고 |
|---|---|---|---|---|
| 6 | **배경 제거** | SERP=유료 독점(remove.bg $0.20/장·Canva $12.99/월·Adobe 계정필요) → **무료+no-upload 미개척** | transformers.js RMBG-1.4(~80MB, IndexedDB 캐시, WebGPU면 MODNet 더 빠름). BiRefNet lite=~150MB | 모델 무거움 → **첫 사용 시 다운로드·lazy-load** 필수. Addy Osmani 레퍼런스 구현 존재 |
| 7 | **🇰🇷 평↔㎡ 면적 변환** | KO 특화·실수요(1평=3.305785㎡, 2007-07-01 법정단위 전환 잔재) | 순수 JS | **승리 바=기능풍부**(가로·세로 계산·비율 1:1/3:2·1~300평 표) |
| 8 | **🇰🇷 만나이 계산기** | KO SEO 수요 큼(고인텐트 키워드 클러스터) | 순수 JS | **만나이+한국나이+띠 번들.** +KO 날짜계산 생태계(음↔양력·D-day·백일·띠궁합·학년) = **다수 랜딩 파생** |
| 9 | **단위 변환기 (로컬 단위 포함)** | 평/근/돈·°C↔°F·kg↔lb·cm↔inch | 순수 JS | ⚠️**환율=실시간 시세=백엔드 → 범위 밖**(본체만 먼저) |
| 10 | **타임존 변환기** | 국경간 일상(한↔미 등) | 순수 JS(Intl) | 트리비얼 |

### Tier 3 — 무겁거나 나중 / 세트용
11. **동영상 압축·변환** — ffmpeg.wasm(~31MB, WASM이라 느림, 2GB 한도). ⚠️MT 코어는 COOP/COEP 헤더 필요(§4).
12. **이미지 포맷 변환** (PNG↔JPG↔WebP↔AVIF) — jSquash(코덱별 로드). 압축과 상보.
13. **.ics 캘린더 이벤트 생성기** — 순수 JS. 다운로드 .ics(기존 event-QR과 상보, 중복 아님).
14. **추첨 / 팀 나누기 / 사다리타기** — 순수 JS(`crypto`). 경쟁 낮고 실사용 높음.

### 범위 밖 (백엔드 필요 → 넣지 않음, QR "결정 A"와 동일)
- **URL 단축기**(KV/D1) · **실시간 환율**(Cron 캐싱) · **OCR**(품질 이슈+무게) · **임시 파일 전송**(R2+TTL, 남용
  리스크) · AI 클라우드 기능(→ `monetization-strategy.md` §6에서 별도 유료 티어로 분리).

---

## 3. 로케일별 인사이트 (핵심 자산)

6개 로케일은 "번역"이 아니라 **검색 행동이 다른 6개 시장**이다. (✅=claim으로 확인, ⚠️=가설/미확인)

| 시장 | 편중·특화 도구 | 근거 |
|---|---|---|
| 🇰🇷 **KO** | ✅**평↔㎡** · ✅**만나이(+한국나이+띠)**. 추가 생태계: 음↔양력·D-day·백일·띠궁합·학년 계산 | 평=법정단위 전환 잔재, 만나이=고SEO 클러스터 |
| 🇯🇵 **JA** | ✅**이미지 압축+HEIC**(Karui가 JA현지화+프라이버시 훅으로 이미 운영), 이미지+PDF 압축 번들, 배치 100+는 유료앱. 아이폰↑→HEIC 편중. ⚠️和暦↔西暦은 **이번 run 미확인**(별도 확인 필요) | Karui teardown |
| 🇩🇪 **DE/DACH** | ✅**no-upload/DSGVO가 THE 쐐기.** PDF 스위트 전반 + PDF압축(첨부한도), HEIC→JPG를 DSGVO 각도로. 프라이버시 **지불의향 최고** | 독일 테크미디어가 "PDF ohne Upload" 카테고리 적극 보도, PDF24조차 웹은 서버 업로드 |
| 🇧🇷 **PT/BR** | ✅**WhatsApp/이메일용 이미지 압축**, "정확한 KB/MB로 줄이기", /pt/ 현지 랜딩 | 다국어 압축 툴이 PT 랜딩을 WhatsApp 각도로 현지화 |
| 🇪🇸 **ES/LatAm** | ✅HEIC(PiliApp "sin subir archivos"), PDF 병합·이미지→PDF(iLovePDF 스페인어 지배). 대형 애그리게이터(184툴) 경쟁 but **no-upload 미점유** | iLovePDF 30+툴 스페인어, but 업로드 모델 |
| 🇬🇧🌐 **EN/글로벌** | 전부. 툴허브 수백만 스케일. **롱테일 KD≤30 + no-upload** 전략(니치 변형 KD 1~한자리) | Omni/FreeConvert 트래픽, KD 사례 |

---

## 4. 이 프로젝트 기술 제약 (구현 전 반드시)

1. **HEIC은 jSquash로 안 됨** → **libheif 계열(heic2any)** 별도. jSquash는 AVIF/JPEG/WebP/PNG/JXL 담당.
2. **스레드 WASM(ffmpeg MT 등)은 `COOP`+`COEP` 헤더로 cross-origin isolation 필요.** ⚠️**우리는 COOP은 있으나
   `COEP: require-corp`를 켜면 크로스오리진 로드가 깨진다** — 특히 **CF Web Analytics beacon**(`static.cloudflareinsights.com`)
   같은 외부 스크립트가 막힐 수 있음. → **대부분 싱글스레드 WASM 코어로 가서 헤더 요구 자체를 회피** 권장.
   정말 스레딩이 필요한 도구만 별도 라우트에서 COEP를 켜는 격리 전략 검토.
3. **무거운 모델·코어는 도구 실행 시점 `dynamic import` lazy-load** 필수(배경제거 80MB·BiRefNet 150MB·ffmpeg 31MB).
   홈/랜딩 초기 번들에 절대 포함 금지(CWV 방어).
4. **`ssr:false` client island 유지** — 브라우저 전용 WASM/Canvas가 얹히는 자리. 순수 payload/변환 로직은 별도
   파일 + Vitest(이 repo 관례, extend-tools 규약).
5. **AGENTS.md:** "This is NOT the Next.js you know" — 착수 시 `node_modules/next/dist/docs/` 해당 가이드 먼저.
   그리고 **라이브러리 도입은 `output:'export'`에서 실제 빌드·동작 검증**(verify, don't claim).

---

## 5. 추천 착수 순서 (소비자용 우선 — 메모리 고정)

```
이미지 압축  →  HEIC 변환  →  PDF 합치기/분할  →  이미지↔PDF  →  PDF 압축
      └ (병렬) 🇰🇷 평↔㎡ · 만나이  ← 순수 JS·트리비얼, KO 트래픽 즉효
                                  →  배경 제거  →  타임존 / 단위 / 추첨
                                  →  (Phase B) 개발자용: JWT·hash·base64·JSON·UUID
```

이유: 앞 5개가 **실사용 빈도·전 시장 코어**이고 전부 클라이언트라 껍데기까지 빠르게 나옴(붙여주신 원안
"QR→압축→HEIC→PDF"와 동일, QR 완료됨). KO 계산기 2종은 노력 대비 KO 유입 효율이 최고라 병렬로.

각 도구 추가 = **extend-tools 규약**: 순수 로직(+테스트) → client island → `registry.ts` 엔트리 →
`QrTypeNav`류 네비/홈그리드 → **전 로케일 dict 블록**(구조 동일) + per-tool SEO 랜딩(metaTitle/FAQ/JSON-LD).

---

## 6. 수익화 훅 매핑 (→ `monetization-strategy.md`)

각 도구가 어떤 수익 레버에 연결되는지(수익화 문서의 단/중/장기와 대응):

| 도구군 | 단기(제휴/광고) | 중기(Pro) | 장기(AI) |
|---|---|---|---|
| 이미지 압축·변환·HEIC | 디자인/스톡 SaaS 제휴 | **배치·고해상·워터마크 제거·EXIF 옵션** | AI 업스케일/화질개선(클라우드 옵트인) |
| PDF 스위트 | — | **대량 병합·고용량·OCR** | PDF 요약·번역·Q&A(Claude API, 6로케일=번역 수요) |
| 배경 제거 | — | 고품질/배치 | 클라우드 고해상 모델 |
| KO 계산기·변환기 | 로컬 제휴(부동산·쿠팡) | — | — |
| 추첨/타임존/.ics | 낮음(유입·브랜드용) | — | — |

**가드레일:** 무료 티어는 100% 클라이언트·프라이버시 유지, AI 클라우드는 옵트인·명시 분리. 다크패턴 금지.

---

## 부록 A — 핵심 증거 (수집 claim 요약, 검증 생략)

**타당성(클라이언트 100%로 가능 확인):** heic2any(HEIC→JPG/PNG/GIF, no server) · browser-image-compression
(canvas+WebWorker, maxSizeMB 타깃, EXIF 보존) · jSquash(Squoosh 코덱, HEIC 없음) · pdf-lib(브라우저 edit/merge/split) ·
Ghostscript-WASM(PDF 압축, 격리 워커) · transformers.js RMBG-1.4(~80MB, WebGPU MODNet) · BiRefNet lite(~150MB) ·
ffmpeg.wasm(~31MB, 2GB 한도, MT는 COOP/COEP).

**시장 수요:** DE — 독일 테크미디어가 "PDF ohne Upload" 적극 보도, PDF24조차 웹은 서버 업로드(오프라인은 별도 데스크톱앱),
첨부한도(GMX·Web.de·Moodle·관공서 5–20MB)가 PDF압축 수요 유발, 입사지원 <5MB. ES — iLovePDF 스페인어 30+툴 지배(업로드
모델), PiliApp "sin subir", 184툴 애그리게이터. PT/BR — 압축 툴이 WhatsApp/이메일 각도로 PT 현지화. JA — Karui가
압축+HEIC를 JA현지화+프라이버시 훅으로 운영, 배치 100+ 유료. KO — 평↔㎡(1평=3.305785㎡, 2007 전환), 만나이(만/한국나이/띠 번들).

**경쟁 구조:** 거인 전부 서버 업로드(iLovePDF·Smallpdf·Adobe·PDF24, 삭제 1~2h) → no-upload 미점유. 헤드 KD 80+,
니치 변형 KD 한자리~30 winnable. 인터랙티브 툴=durable "do" 트래픽.

## 부록 B — 미확인·재확인 대상
- ⚠️ **和暦↔西暦(일본 연호 변환):** 앵글에 넣었으나 이번 run에 확정 claim 미수집 → JA 착수 전 별도 확인.
- ⚠️ **모든 트래픽·KD 수치는 단일 소스 추정** → 도구 착수 전 GSC/키워드 도구로 재확인.
- ⚠️ verify 단계 생략 → 상기 결론은 교차확인 수준. 큰 항목은 신뢰, 세부는 구현 중 검증.

---

*(도구별 구체 구현 스펙은 착수 시 별도 실행 문서로. 이 문서는 "무엇을·어떤 순서로·무엇을 지키며"의 판단 계층이다.)*
