# QR 코드 생성기 개선 계획 — 웹 리서치 종합

> **문서 성격:** 이건 스펙(구현 지시서)이 아니라 **전략 + 백로그 문서**다. 2026-07 기준 브라우저용 QR
> 생성기들의 기능·UI/UX를 조사하고, 현재 앱(`docs/qr-generator-implementation.md` rev 4에서 구현·검증된
> 상태)과 대조해 "무엇을, 왜, 어떤 순서로" 개선할지 정리했다. 코드는 아직 건드리지 않았다.
>
> 조사 대상: qr-code-generator.com · QRCode Monkey · QR Tiger · Uniqode(Beaconstac) · Flowcode · me-qr ·
> the-qrcode-generator.com · goqr.me · Canva · Adobe Express · Bitly · Shopify, 그리고 라이브러리
> `node-qrcode` / `qr-code-styling` / `qrcode.react` / `jsQR` / `html5-qrcode`.

---

## 진행 현황 업데이트 (2026-07-16 — 구현·배포 완료분)

이 문서는 rev 4 시점의 전략/백로그였고, 그 뒤 아래가 **구현·배포**됐다(라이브: `tools.solisapps.com`):
- ✅ **Tier 1 콘텐츠 타입** — WiFi·vCard·email·SMS·전화·WhatsApp·위치·이벤트 8종(+ URL/텍스트) 전부 shipped.
  각자 전용 폼 + 순수 payload 빌더(단위 테스트) + 개별 SEO 랜딩 페이지. 렌더는 공유 `qr-core`로 통일.
- ✅ **다국어** — ko/en + es·pt-BR·ja·de = **6개 로케일**(원 문서엔 없던 성장 레버).
- ✅ **온페이지 SEO** — 키워드 `metaTitle`/`metaDescription`, 크롤 가능한 사용법·특징·FAQ, JSON-LD(WebApplication+FAQPage).
- ✅ **UX 정리** — 홈 그리드 1개 대표 카드 + 도구 페이지 타입 전환 nav(별개 도구처럼 안 보이도록).
- ⬜ **Tier 2 디자인 깊이**(도트/눈 모양·그라디언트·로고·프레임) — 미착수. **결정 B**(`qr-code-styling` 도입) 선행 필요.
- ⬜ **Tier 3 차별화**(대량 CSV→ZIP·디코드 QA·QR 리더·PWA) — 미착수.
- **결정 A(static-only) 유지 중.** 아래 원 전략은 남은 Tier 2/3 설계 참고용으로 유효하다.

---

## 0. TL;DR — 핵심 논지

1. **현재 앱의 포지셔닝은 이미 "옳다".** 리서치가 말하는 미니멀 툴의 승리 공식(툴 우선, 회원가입 없음,
   무료 SVG, 실시간 미리보기, 명암비 경고)을 **이미 상당 부분 만족**한다. 상용 툴들은 이 지점에서 약하다
   (다크 패턴 범벅). → **전략은 "이 포지셔닝을 버리지 말고, 백엔드 없는 범위 안에서 넓히는 것"**이지,
   dynamic QR로 확장하는 게 아니다.
2. **두 개의 하중을 견디는(load-bearing) 결정이 있다:**
   - **(A) 서버 없이 간다(static-only).** dynamic QR 계열(편집 가능한 목적지, 스캔 분석, 만료, 비밀번호)은
     전부 백엔드가 필요하고, 그건 이 앱의 프라이버시·$0 서버라는 해자(moat)를 희석한다. → **명시적으로
     범위 밖(out of scope)으로 둔다.**
   - **(B) 렌더링 엔진을 `qr-code-styling`으로 승격.** 현재의 `node-qrcode`는 색/EC/크기/여백까지가
     한계다. 도트 모양·눈(finder) 모양·그라디언트·로고 삽입 같은 "디자인 깊이"는 전부 이 라이브러리
     교체(또는 병행)로 한 번에 열린다.
3. **가장 값싼 큰 승리는 "콘텐츠 타입 템플릿"이다.** WiFi·vCard·이메일·전화·SMS·지오·캘린더 등은 전부
   *순수 문자열 인코딩*일 뿐이라 **100% 클라이언트 사이드**이고, 현재의 `qr-payload.ts`(순수 함수 +
   단위 테스트) 패턴에 그대로 얹힌다. 상용 툴들이 이걸 회원가입/유료 뒤에 숨기는 반면 우리는 공짜로 낼 수 있다.

---

## 1. 현재 앱 상태 — 정직한 진단

### 이미 잘 하고 있는 것 (리서치의 "GOOD 패턴"과 일치)
- **2단 레이아웃**(좌: 컨트롤 / 우: 미리보기) — 브랜드 툴들의 사실상 표준.
- **실시간(디바운스) 미리보기** — 시장 점유 1위 무료 툴인 **QRCode Monkey의 최대 약점**(수동 "Create" 버튼
  클릭해야 갱신됨)을 우리는 이미 넘어섰다.
- **명암비 + 극성(polarity) 경고** — 리서치가 "이 카테고리 최고의 방어 패턴"이라 꼽은 것. 대부분 경쟁사는
  스캔 안 되는 코드를 조용히 만들게 둔다. 우리는 이미 있다.
- **무료 PNG + SVG** — qr-code-generator.com(무료는 JPG만)·Adobe Express(SVG 없음) 대비 명백한 우위.
- **회원가입 없음 · 클립보드 복사 · ko/en i18n · 접근성(네이티브 radio, aria-live)**.

### 한계 (이번 개선의 대상)
- **콘텐츠 타입이 텍스트/URL 단 하나.** WiFi·vCard·이메일·SMS 등 사람들이 실제로 검색하는 타입이 없다.
- **디자인 커스터마이즈가 얕다.** 색 2개(fg/bg)뿐. 도트/눈 모양·그라디언트·로고·프레임 없음. `node-qrcode`의
  구조적 한계.
- **차별화 기능 부재.** 대량(bulk) 생성, 디코드 검증(QA), QR 리더, 히스토리, 공유 가능한 설정 URL, PWA/오프라인.
- **툴 우선 포지셔닝을 광고하지 않음.** "회원가입 없음 / 영구 / 무료 SVG / 데이터가 브라우저를 안 떠남"이
  강력한 신뢰 신호인데 UI에 노출돼 있지 않다.

### 기술 스택 제약 (개선 설계 시 지켜야 할 것)
- **`output:'export'` 정적 export → Cloudflare Workers Static Assets, $0 서버.** 서버 로직 없음.
- QR 도구는 `next/dynamic({ssr:false})` **client island**. → 브라우저 전용 라이브러리(`qr-code-styling`,
  `jsQR`, `JSZip`)를 얹기 좋은 자리다.
- 확장 규약: **툴 추가 = 3개 편집**(`registry.ts` 엔트리 + `ko/en.json` 블록 + client 컴포넌트).
- **순수 로직은 별도 파일 + 단위 테스트**(`qr-payload.ts` / `qr-payload.test.ts`)가 이 repo의 관례.
  payload builder들도 이 패턴을 따라야 한다.
- ⚠️ `AGENTS.md`: "This is NOT the Next.js you know" — 실제 구현 착수 시 `node_modules/next/dist/docs/`의
  해당 가이드를 먼저 읽을 것. 그리고 **라이브러리 도입은 반드시 `output:'export'` + client island 환경에서
  실제로 빌드/동작 검증**(이 repo의 "verify, don't claim" 원칙).

---

## 2. 두 개의 전략적 결정

### 결정 A — Static-only 유지 (dynamic QR은 범위 밖)

QR **이미지 자체는 어느 쪽이든 클라이언트에서 만들어진다.** static/dynamic의 차이는 "코드 안에 무엇이 들어가고
그 뒤에 무엇이 있느냐"뿐이다.

| dynamic 기능 | 의미 | 백엔드 필요? |
|---|---|---|
| 편집 가능한 목적지 | 재인쇄 없이 타깃 변경 | **필요** (리다이렉트 레코드 + 저장소) |
| 단축 URL 리다이렉트 | 코드에 `domain/id` | **필요** (도메인 + 엔드포인트) |
| 스캔 분석/추적 | 횟수·시간·지역·기기 | **필요** (서버가 스캔을 봐야 함) |
| 만료 / 비밀번호 / 규칙 기반 라우팅 | — | **필요** (서버 강제) |
| 호스팅 랜딩/메뉴/링크 페이지, 리드 폼 | 툴이 목적지를 호스팅 | **필요** |

**판단: 넣지 않는다.** 이유 —
- $0 서버 + "데이터가 브라우저를 안 떠남" 프라이버시가 이 앱의 **해자**다. 스캔 추적은 그 반대 방향이다.
- 상용 무료 티어는 dynamic이 극도로 빈약하다(the-qrcode-generator = 2개, Bitly = 월 2개). 그리고 대부분
  **다운로드 시점 회원가입 벽 + 체험 종료 시 인쇄된 코드가 죽는** 다크 패턴을 낀다. 여기서 싸울 필요가 없다.
- **탈출구(참고만):** 정말 dynamic이 필요해지면 최소 발자국은 **CF Worker + KV** 하나(이 repo는 이미
  `wrangler.jsonc`로 그 준비가 돼 있음)로 리다이렉트+편집+스캔 카운트를 붙이는 것. 다만 이건 명백히 선을
  넘는 것이고, 프라이버시 카피를 포기해야 한다. **권장하지 않음.** 대안: 사용자가 이미 가진 서드파티 단축
  URL/분석 서비스로 static 코드를 향하게 하면, 편집·분석은 그쪽이 갖고 우리는 serverless를 유지한다.

### 결정 B — 렌더링 엔진을 `qr-code-styling`으로 승격

현재 `node-qrcode`는 **인코더로는 훌륭하지만 디자인 표면이 없다**(색/EC/버전/여백까지). "디자인 깊이" 티어
전체가 이 한계에 막혀 있다.

| 라이브러리 | 역할 | 커스터마이즈 | 출력 | 이 앱에서의 위치 |
|---|---|---|---|---|
| **node-qrcode** (현재) | 인코더 | fg/bg·EC·버전·여백 | PNG(dataURL)·SVG·UTF8 | 심플 경로엔 충분, 디자인엔 막다른 길 |
| **qr-code-styling** (kozakdenys) | 렌더 엔진 | **도트/눈 프레임/눈 볼 모양·요소별 색·선형+방사형 그라디언트·로고(뒤 모듈 제거)·원형 코드·투명 배경** | PNG·JPG·WebP·SVG | **디자인 티어의 사실상 청사진.** client island에 적합 |
| qrcode.react | React 컴포넌트 | fg/bg·level·`imageSettings`(로고) | Canvas·SVG | 가볍지만 shape/gradient 없음 |
| jsQR / html5-qrcode | **리더**(디코드/스캔) | — | — | 디코드-QA + QR 리더 기능용 |

**권장:** 디자인 티어 진입 시 **렌더링을 `qr-code-styling`으로 이관**(square 기본형도 지원하므로 심플 경로도
커버 가능). 트레이드오프 — 번들 무게 증가, SVG/PNG 출력 형태가 `node-qrcode`와 다름, 브라우저/canvas 의존
(client island라 문제 없음). **주의:** SSR 관련 이슈가 과거에 있었으니 `ssr:false` island 안에서 동적 import
해야 하고, `output:'export'`에서 실제로 빌드·동작하는지 반드시 검증할 것. 병행 전략(심플=node-qrcode 유지,
스타일=qr-code-styling)도 가능하나 출력 일관성·유지보수를 위해 **단일 엔진 이관을 선호**.

---

## 3. 기능 로드맵 (티어별)

효과(Value) / 노력(Effort) / 클라이언트 사이드 가능 여부(CS) / 비고. **모든 티어 1~3 항목은 CS=✅**(서버 불필요).

### Tier 1 — 현재 엔진(node-qrcode) 그대로, 낮은 노력·높은 가치

| 기능 | Value | Effort | 비고 |
|---|---|---|---|
| **콘텐츠 타입 템플릿** (URL·텍스트·이메일·전화·SMS·WiFi·vCard·MeCard·지오·캘린더 VEVENT·WhatsApp·암호화폐) | ★★★ | 중 | **최우선.** 각 타입은 payload 문자열 빌더(순수 함수) + 폼. 부록 A의 템플릿 그대로 구현. 렌더 파이프라인은 그대로 재사용 |
| **회원가입 없음/오프라인/무료 SVG 신뢰 신호** UI 노출 | ★★ | 하 | 카피만. 헤더/툴 상단 배지 |
| **localStorage 히스토리** (최근 생성 설정/payload) | ★★ | 하 | 무료 툴 중 잘 하는 곳 없음(로그인 유도 때문). 오프라인 차별점 |
| **공유 가능한 설정 URL** (해시에 config 직렬화) | ★★ | 하 | 계정·서버 없이 북마크/공유. 매우 저렴 |
| **다운로드 해상도 선택** (미리보기와 분리된 export px) | ★ | 하 | 인쇄용 고해상 PNG |

**콘텐츠 타입 구현 노트:** 각 타입 = `buildWifiPayload()` / `buildVCardPayload()` 같은 **순수 함수 +
단위 테스트**(WiFi 이스케이프 순서, vCard 개행 등은 반드시 테스트 대상). UI는 상단 **탭 바 / 아이콘 그리드**로
타입 전환 → 타입별 폼 → 동일 렌더 파이프라인. → §5 UI 참고.

**SEO 곁가지(중요):** 이 scaffold는 검색 발견을 위해 만들어졌다(sitemap·per-locale·keywords). 사람들은
"wifi qr code generator", "vcard qr code" 같은 걸 **개별적으로 검색**한다. 옵션:
- **(1) 단일 QR 툴 + 타입 탭** — 단순, 코드 중복 없음. 단, 타입별 검색 랜딩이 약함.
- **(2) 타입별 별도 slug**(`wifi-qr`, `vcard-qr` …)로 registry에 추가(툴 추가 = 3편집) → 각자 검색 랜딩
  페이지. 내부적으론 같은 QR 엔진에 프리셋 타입을 주입. **검색 포착엔 유리하나 콘텐츠 중복 관리 필요.**
- 권장: **하이브리드** — 코어는 단일 QR 툴(탭), 트래픽 큰 소수(WiFi·vCard)만 전용 slug로 얇게 분기.

### Tier 2 — 디자인 깊이 (qr-code-styling 도입, 중간 노력)

| 기능 | Value | Effort | 비고 |
|---|---|---|---|
| **도트(모듈) 모양** (square·dots·rounded·classy…) | ★★★ | 중 | 시각적 썸네일 피커 |
| **눈(finder) 모양+색** (외곽 프레임 / 내부 볼 독립) | ★★★ | 중 | 업계 표준 "Eyes" 패널 |
| **선형/방사형 그라디언트** (전경·배경) | ★★ | 중 | 요소별 gradient |
| **로고/중앙 이미지 삽입** (뒤 모듈 자동 제거) | ★★★ | 중 | 드래그-드롭 + 제약을 드롭존에 표기(≤2MB, ≤30% 커버). 로고 추가 시 **EC 자동 H 승격** |
| **프레임 + "Scan me" CTA 텍스트** | ★★ | 중 | 라이브러리 없이 자체 SVG/canvas 래퍼로도 가능. 레스토랑 등 스캔율 상승 사례 |
| **투명 배경 / 원형 코드** | ★★ | 하 | qr-code-styling 옵션 |
| **프리셋 템플릿 갤러리** (스캔 검증된 JSON 프리셋) | ★★ | 중 | 빈 캔버스 문제 해소 |
| **PDF / EPS export** | ★ | 중 | jsPDF/svg2pdf, EPS 직렬화 |

### Tier 3 — 무료 툴 중 드문 차별화 (중~높은 노력)

| 기능 | Value | Effort | 비고 |
|---|---|---|---|
| **대량 생성 CSV → ZIP** (JSZip) | ★★★ | 중 | 브라우저 안에서 파싱→N개 생성→zip. 여기선 **공짜**, 경쟁사는 유료(QR Tiger 3,000/배치) |
| **디코드-백 스캔 검증(QA)** (렌더 결과를 jsQR로 재디코드) | ★★★ | 중 | 로고/그라디언트/모양이 스캔을 깼는지 **오프라인 검증**. 무료 툴 대부분 없음 |
| **QR 리더/디코더** (이미지 업로드/카메라로 읽어 payload 복제) | ★★ | 중 | jsQR / html5-qrcode. **별도 slug `qr-reader`로 suite에 추가**하기 좋음(3편집 규약에 맞음) |
| **PWA / 오프라인 설치** | ★★ | 중 | "완전 오프라인" 프라이버시 포지셔닝 완성 |

### 범위 밖 (백엔드 필요 → 넣지 않음)
편집 가능한 목적지 · 단축 URL · 스캔 분석/추적 · 만료 · 비밀번호 · 규칙 기반 멀티-URL · 호스팅 랜딩/메뉴/링크
페이지 · 리드 캡처 폼 · 리타게팅 픽셀 · **AI 아트 QR**(GPU/Stable Diffusion 필요). → §2 결정 A 참고.

---

## 4. 스캔 신뢰성(scannability) — 우리의 방어 우위를 더 키우기

이미 명암비+극성 경고가 있다(경쟁 우위). 이걸 **QA 계층**으로 확장:
- **명암비 임계 상향 안내:** 목표 ≥4.5:1(현재 코드는 <3에서 low-contrast 경고). 로고/디자인 추가 시 특히.
- **로고 커버리지 경고:** 로고가 코드의 ~30% 초과 시 경고 + EC를 H로 자동 승격 권유.
- **콰이어트 존/최소 크기 경고:** 순수 계산. 인쇄 가이드 노출 — 최소 2×2cm, ≥300DPI(600 이상 이상적),
  "스캔 거리 ≈ 코드 폭×10" 규칙. (SVG는 무한 해상도라 인쇄 권장.)
- **디코드-백 검증(Tier 3):** 렌더된 canvas를 `jsQR`로 다시 디코드해 "이 스타일 코드가 실제로 읽히는가"를
  확인. 커스텀 디자인의 최종 안전장치.

---

## 5. UI/UX 개선

현재 앱은 이미 "미니멀 툴 승리 공식"에 부합한다. 개선은 **① 넓이(콘텐츠 타입·디자인 패널)를 감당할 IA**와
**② 신뢰/무마찰 강화**다.

### 5.1 레이아웃 & IA
- **2단 유지**(좌 컨트롤 / 우 미리보기). 우측 미리보기를 **sticky 사이드바**로 만들어 긴 컨트롤 컬럼을
  스크롤해도 코드가 항상 보이게(현재는 그리드 2열, sticky 아님).
- **모바일: 스택 + 미리보기 우선.** 리서치상 아무 툴도 모바일에서 sticky 미리보기를 안 함 → **기회.**
- 미리보기 코드는 **여백(quiet zone)이 시각적으로 보이도록** 패딩 있는 카드/타일 위에 격리(현재도 카드
  있음 — 유지·강화).

### 5.2 콘텐츠 타입 선택
- **상단 가로 탭 바** 또는 **8–12개 아이콘 그리드**(라벨 포함). QRCode Monkey식 상단 탭이 마찰 최저.
- **유용한 타입(WiFi·vCard)을 무료·전면에.** 경쟁사는 이걸 dynamic/유료 뒤에 숨긴다 — 우리의 대비점.
- 첫 화면은 URL 탭 기본 + **동작하는 샘플 QR 즉시 렌더**(도착하자마자 "된다"는 신호).

### 5.3 커스터마이즈 컨트롤 (업계 표준 어휘 채택)
- 패널 구성: **Pattern / Eyes / Colors / Logo / Frame** — 사용자가 이미 학습한 어휘(Bitly·QR Tiger·Uniqode·
  Flowcode 공통). 아코디언/탭으로 **점진적 노출**(한 컬럼 스택, 접기 가능).
- **도트/눈 모양 = 시각 썸네일 그리드**(드롭다운 금지 — 리서치 강한 합의).
- **색 = 세 부분 모델**(본문 dots / 눈 eyes / 배경) 각각 **스와치 팔레트 우선 → "고급"에서 hex/피커**.
  Flowcode(24색)·Adobe(5색)처럼 **제한된 스와치가 저명암(스캔 불가) 조합을 예방**한다. 현재의 raw
  `<input type=color>`는 "고급" 탈출구로 유지.
- **로고 업로드 = 드롭존 + 흔한 아이콘 갤러리**, **제약을 드롭존에 즉시 표기**(≤2MB·PNG/JPG/SVG·≤30%).
- **Frame 패널:** "Scan me" 등 CTA 텍스트 + 폰트/색. 프리셋 문구("View Menu","Order Here") + 커스텀.

### 5.4 실시간 미리보기 & 피드백
- 현재의 실시간(디바운스) 유지 — **QRCode Monkey의 수동 갱신 약점을 계속 이긴다.** qr-code-styling은
  `.update()`로 즉시 재렌더 가능.
- **인라인 스캔 경고**(명암/로고 커버리지/콰이어트 존)를 편집 중에 노출 — 이미 방향이 맞음, §4로 확장.
- 모호한 입력 시 **N개 변형 동시 제시**(Flowcode 인사이트: 사용자는 QR 부위 용어가 없으니 시각으로 소통).
  프리셋 갤러리가 이 역할을 저비용으로 대체 가능.

### 5.5 다운로드 / Export UX
- **모든 포맷 무료 유지**(PNG·SVG, 나중에 PDF). qr-code-generator.com(무료 JPG만)·Adobe(SVG 없음) 대비
  차별점 — **절대 게이팅하지 말 것.**
- 버튼은 미리보기 바로 아래(현재대로). 포맷은 **개별 버튼**(한눈에 보임) 유지, 늘어나면 드롭다운 고려.

### 5.6 온보딩 · 신뢰 · 무마찰 (지켜야 할 가드레일)
- **첫 로드 샘플 QR · URL 붙여넣기 우선 · 2–3클릭 다운로드 · 회원가입 0.** 이게 미니멀 툴의 전부다.
- 상단에 **신뢰 신호 배지**: "No signup · Never expires · Free SVG · Works offline · Your data never
  leaves your browser." (이미 `en.json` 태그라인 "Your files never leave your device."와 정합.)

### 5.7 피해야 할 다크 패턴 (경쟁사 관찰 → 우리의 안티-체크리스트)
1. 툴 앞의 마케팅 벽(qr-code-generator.com) — **툴을 히어로로.**
2. 디자인 다 시킨 뒤 **다운로드 시점 회원가입 벽.**
3. 흔한 포맷(PNG/SVG) 계정 게이팅, 무료는 JPG만.
4. 사용자를 **유료 dynamic로 기본 지정**해놓고 뒤늦게 유료 공개.
5. **체험 종료 시 인쇄된 코드가 죽음**(만료 dynamic).
6. 결과를 **이메일로 보냄**(인라인 다운로드 대신 — Shopify).
7. 리다이렉트 전 광고/인터스티셜.
8. 비실시간 미리보기(Monkey의 약점).

→ 현재 앱은 위 전부를 **이미 안 한다.** 개선 과정에서도 이 가드레일을 깨지 말 것.

---

## 6. 우선순위 로드맵 (단계별)

| 단계 | 내용 | 엔진 | 성과 |
|---|---|---|---|
| **Phase 1** | 콘텐츠 타입 템플릿(WiFi·vCard·email·tel·SMS·geo·VEVENT·WhatsApp·crypto) + 타입 탭 UI · 신뢰 배지 · localStorage 히스토리 · 공유 URL · §4 경고 확장(로고 제외) | node-qrcode 유지 | **가장 값싼 큰 승리.** 검색 트래픽·실사용 타입 확보 |
| **Phase 2** | `qr-code-styling` 이관 → Pattern/Eyes/Colors/Logo/Frame 패널(썸네일·스와치·hex 탈출구) · 로고+EC 자동 H · 프레임 CTA · 프리셋 갤러리 · sticky/모바일 미리보기 | qr-code-styling | 디자인 깊이로 상용 무료 티어와 동급/우위 |
| **Phase 3** | 대량 CSV→ZIP · 디코드-백 QA(jsQR) · QR 리더 별도 툴(`qr-reader`) · PWA/오프라인 · PDF/EPS export | +JSZip·jsQR | **무료 툴이 드물게 갖는 차별화** |

각 Phase는 이 repo의 관례를 따른다: **순수 로직 = 별도 파일 + Vitest**, UI = client island, 라이브러리 도입은
`output:'export'` 실제 검증. 콘텐츠 타입/리더를 별도 slug로 낼 땐 **3편집 규약**(registry + ko/en.json + 컴포넌트).

---

## 부록 A — Payload 문자열 템플릿 (구현 즉시 참고용)

> 모든 타입은 *순수 문자열 인코딩*이라 100% 클라이언트 사이드. 각 빌더는 순수 함수 + 단위 테스트로.

**URL / 텍스트** — 원문 그대로(텍스트는 접두사 없음).

**이메일(mailto, RFC 6068)** — subject/body는 URL 인코딩(공백 `%20`):
```
mailto:addr@example.com?subject=Subject%20Text&body=Body%20text
```

**전화(tel, RFC 3966)** — `tel:+13035551212`

**SMS** — 스캐너 지원 편차 있음. **`SMSTO:`가 가장 호환성 높음:**
```
SMSTO:+13035551212:Message text          ← 권장(NTT DoCoMo, 광범위 지원)
sms:+13035551212?body=Message%20text     ← RFC 5724 스타일(대체)
```

**WiFi** — 대소문자 구분 `WIFI:` 접두사, 반드시 `;;`로 종료:
```
WIFI:T:WPA;S:MyNetworkSSID;P:MyPassword;H:false;;
```
- `T`: `WPA`(WPA/2/3 포괄)·`WEP`·`nopass`(개방). `S`: SSID. `P`: 비번. `H`: 히든(`true`/`false`, 아니면 생략).
- **이스케이프(순서 중요):** `\`를 **먼저**, 그다음 `;` `:` `,` `"` 각각 앞에 백슬래시. 예) SSID `My;Network`,
  비번 `Pass:word` → `WIFI:T:WPA;S:My\;Network;P:Pass\:word;;` *(이스케이프는 반드시 테스트 케이스로.)*

**vCard 3.0** (호환성 최상, 실제 CRLF 개행; payload 큼 → 밀도↑):
```
BEGIN:VCARD
VERSION:3.0
N:Last;First;;;
FN:First Last
ORG:Company Inc.
TITLE:Job Title
TEL;TYPE=CELL:+13035551212
EMAIL:person@example.com
URL:https://example.com
ADR;TYPE=WORK:;;123 Main St;City;State;12345;Country
END:VCARD
```

**MeCard** (vCard보다 훨씬 compact → 밀도 낮추고 싶을 때):
```
MECARD:N:Doe,John;TEL:13035551212;EMAIL:john@example.com;URL:https://example.com;;
```

**지오(geo, RFC 5870)** — `geo:37.7749,-122.4194` (선택: `?q=Label`)

**캘린더(iCalendar VEVENT, RFC 5545)** — 날짜 `YYYYMMDDTHHmmSS`, UTC는 끝에 `Z`:
```
BEGIN:VEVENT
SUMMARY:Event Title
DTSTART:20260901T090000Z
DTEND:20260901T100000Z
LOCATION:Venue Name
DESCRIPTION:Details
END:VEVENT
```
(타임존: `DTSTART;TZID=America/New_York:20260901T090000`. 일부 툴은 `BEGIN:VCALENDAR…` 봉투로 감쌈.)

**WhatsApp** — `https://wa.me/13035551212?text=Pre-filled%20message`

**암호화폐 / 결제**
```
bitcoin:bc1q...?amount=0.001&label=Coffee&message=Note      (BIP-21; ethereum:/litecoin: 동형)
upi://pay?pa=name@bank&pn=Payee&am=100.00&cu=INR&tn=Note    (인도 UPI)
```
(SEPA/EPC069-12 "Girocode"는 다줄 구조 — 필요 시 별도.)

---

## 부록 B — 경쟁사 요약 매트릭스

| 툴 | 무료 static | dynamic/분석 | 디자인 깊이 | Export | 대량 | 포지셔닝/특징 |
|---|---|---|---|---|---|---|
| qr-code-generator.com | 제한적(무료 JPG만) | 유료(핵심) | 높음 | PNG/SVG/PDF/EPS(유료) | 유료 | 마케팅 벽 + 최다 타입(~30) |
| **QRCode Monkey** | 무제한 | 유료 | 높음(눈별 모양·그라디언트·로고) | PNG/SVG/EPS/PDF **무료** | 유료 | 최고 무료 디자인. **단, 비실시간(약점)** |
| QR Tiger | 무료 | 유료(강한 분석) | 높음 | PNG/SVG 등 | 3,000/배치 | static/dynamic 분리 = 업셀 퍼널 |
| Uniqode/Flowcode/Bitly | 제한적 | 유료(핵심) | 높음 | 다양 | 유료/API | 다운로드 계정 게이팅 |
| the-qrcode-generator | 무제한 | 무료 2개 | 중 | 래스터/벡터 | 유료 | 관대한 무료 static, no-signup |
| Adobe Express | 무료(영구) | 없음 | 중 | PNG/JPG/PDF(**SVG 없음**) | 없음 | 영구 static 초점 |
| **(이 앱)** | **무제한·회원가입 0** | (범위 밖) | 낮음→개선 대상 | **PNG/SVG 무료** | (Tier 3) | **프라이버시·오프라인·다크패턴 0** |

---

## 부록 C — 출처 (리서치 URL)

**기능:** qr-code-styling(github/npm) · node-qrcode(github) · qrcode.react · goqr.me/api · qrcode-monkey.com ·
qr-code-generator.com(solutions/wifi·social) · qrcode-tiger.com(+bulk) · uniqode.com/features · flowcode.com ·
me-qr.com · the-qrcode-generator.com · bitly.com/blog · MeCard(Wikipedia) · BIP-21(bitcoin.it) · WiFi 포맷
가이드(wifiqrcode.app·feeding.cloud.geek.nz) · html5-qrcode·jsqrcode(github) · quickchart bulk · qr-verse 인쇄 가이드.

**UI/UX:** qrcode-monkey.com · qr-code-generator.com · the-qrcode-generator.com · qrcode-tiger.com(+teardown) ·
uniqode.com · flowcode.com/blog(building-ai-qr-tool·custom-shape) · canva.com/help · adobe express help ·
bitly.com/blog(customization) · shopify.com/tools · jotform 베스트 라운드업 · uxmatters(QR UX) · pageloot
usability · dribbble(qr 개념 갤러리).

*(전체 URL 목록은 리서치 원본에 있음. 이 문서는 그 종합·판단 계층이다.)*
