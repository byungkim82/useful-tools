# Cloudflare Workers Static Assets — 라우팅 규칙 (확정)

> **문서 성격:** 이 사이트는 `output:'export'` 정적 사이트를 **Cloudflare Workers Static Assets**로 서빙한다.
> 2026-07-19 루트(`/`) 언어 자동 리다이렉트를 넣으면서 "정적 자산 + `main` Worker"가 함께 있을 때의
> 라우팅 우선순위를 조사·확정했다. 이 문서는 그때 확인한 **사실(fact)** 과 이 레포에 적용된 **구성**을
> 남겨, 다음에 Worker 라우팅을 건드릴 때 다시 조사하지 않아도 되게 하는 참조용이다.
>
> **출처:** Cloudflare 공식 문서(`developers.cloudflare.com/workers/static-assets/…`의 `routing/worker-script`,
> `binding`, `headers`) + wrangler **4.54.0** 로컬 `wrangler dev` 실검증. **각 규칙은 아래 §5에서 실제로 curl 검증됨.**

---

## 1. 두 가지 서빙 모드

| 모드 | `wrangler.jsonc` | 동작 |
|---|---|---|
| **순수 정적** (이전) | `assets`만, `main` 없음 | Cloudflare가 `out/` 파일만 배달. 실행되는 우리 코드 없음. |
| **하이브리드** (현재) | `assets` + `main` Worker | 대부분은 정적 자산, 특정 경로만 Worker가 처리. |

`main`(Worker 진입점)이 있느냐 없느냐가 갈림길이다. 지금은 `main: "worker/index.ts"`가 있는 하이브리드다.

## 2. 라우팅 우선순위 — 핵심 규칙

1. **기본은 "정적 자산 우선"이다.** 요청이 오면 Cloudflare가 먼저 매칭되는 정적 자산이 있는지 본다.
   - **매칭되면** → 자산을 그대로 서빙하고 **Worker는 호출되지 않는다.** (`_headers`/`_redirects` 규칙 적용)
   - **매칭 안 되면** → **그때 Worker(`main`)가 호출된다.** (이게 하이브리드에서 Worker가 도는 기본 경로)
2. **`assets.run_worker_first`로 순서를 뒤집을 수 있다.**
   - `true` → **모든** 요청에서 Worker를 자산보다 먼저 실행.
   - **배열**(글롭 패턴) → **나열된 경로만** Worker를 먼저 실행, 나머지는 기본(자산 우선) 유지.
     - `*` = 깊은 매칭, `!` 접두사 = 부정 패턴(부정이 우선). 예: `["/api/*", "!/api/docs/*"]`.
     - **`"/"`는 루트만 정확히 매칭한다(전체가 아님).** ← 이번 조사의 핵심 확인 사항.
3. **`assets.binding`(예: `"ASSETS"`) → Worker에서 `env.ASSETS.fetch(request)`로 자산을 직접 가져온다.**
   - 이 fetch는 `html_handling`·`not_found_handling`(예: `"404-page"`) 설정을 **그대로 적용**한다.
     그래서 Worker가 처리하지 않는 경로를 `return env.ASSETS.fetch(request)`로 넘기면 404 처리까지 정상 동작.

## 3. `_headers` / `_redirects`의 함정 (중요)

- `_headers`·`_redirects`는 **정적 자산 레이어의 기능**이다. 자산 레이어가 서빙하는 응답에만 적용된다.
- **⚠️ Worker 코드가 *직접 생성*한 응답(`new Response(...)`)에는 `_headers`가 적용되지 않는다.**
  → Worker가 만드는 리다이렉트/응답에 헤더가 필요하면 **Worker 코드 안에서 직접** 붙여야 한다.
- `env.ASSETS.fetch()`로 받아 반환하는 응답은 자산 레이어를 거치므로 `_headers`가 **적용된다.**
- 정리: 실제 페이지(`/ko/` 등)는 자산 레이어가 서빙 → `_headers`(CSP 등) 정상. Worker가 만드는 `/` 302만 예외 → §4처럼 헤더를 코드에서 부여.

## 4. 이 레포에 적용된 구성

**`wrangler.jsonc`**

```jsonc
{
  "main": "worker/index.ts",
  "assets": {
    "directory": "./out",
    "not_found_handling": "404-page",
    "binding": "ASSETS",
    "run_worker_first": ["/"]   // 루트만 Worker 우선. 나머지는 자산 우선(빠른 경로).
  }
}
```

**`worker/index.ts`** — 사이트의 **유일한** 서버 사이드 로직(엣지 언어 라우터).

- `/` → `Accept-Language` 파싱 → 지원 로케일(`src/i18n/config.ts`의 `locales`) 중 최우선 매칭 →
  `302 Location: /<locale>/`. 매칭 실패 시 `xDefaultLocale`(**en**, hreflang x-default와 일치)로 폴백.
  - 응답에 `Cache-Control: no-store` + `Vary: Accept-Language`를 **코드에서 직접** 부여(§3 때문).
    방문자마다 달라지는 리다이렉트가 캐시되어 남에게 잘못 서빙되는 것을 방지.
- `/` 외 → `env.ASSETS.fetch(request)`로 위임(자산 서빙 + 404 처리 그대로).
- 로케일 목록·매칭은 페이지가 쓰는 `src/i18n/config.ts`를 그대로 import → **드리프트 없음.**

**흐름 요약**

```
GET /            → (run_worker_first) Worker → Accept-Language 감지 → 302 /<locale>/
GET /ko/         → 자산 매칭 → 자산 레이어가 서빙(_headers 적용), Worker 미호출
GET /ko/qr/      → 위와 동일
GET /없는경로/    → 자산 미매칭 → Worker 폴백 → env.ASSETS.fetch → not_found_handling(404-page)
```

> **이전 방식과의 차이:** 예전엔 `public/_redirects`의 `/  /ko/  302` 한 줄로 **전원 한국어(ko)** 로 보냈다.
> 이제 그 규칙은 제거됐고(Worker가 `/`를 소유), 방문자 언어에 따라 분기하며 폴백은 en이다.

## 5. 검증 결과 (2026-07-19, `wrangler dev` 로컬)

`pnpm build` 성공(TypeScript 통과 = Worker 타입체크 OK) · `pnpm lint` 0 error/0 warning 후,
`wrangler dev --local`에 curl로 아래를 확인:

| 요청 | 기대 | 결과 |
|---|---|---|
| `/` `Accept-Language: de-DE,de;q=0.9,en;q=0.8` | 302 → `/de/` | ✅ |
| `/` `ko` / `ja-JP` / `pt-BR` / `es-ES` / `en-US` | 각 `/ko//ja//pt//es//en/` | ✅ |
| `/` `fr-FR`(미지원) / `zh-CN`(미지원) / **헤더 없음** / `*` | 302 → `/en/`(폴백) | ✅ |
| `/` `fr;q=0.2,de;q=0.9`(q 우선순위) | 302 → `/de/` | ✅ |
| `/ko/`, `/en/` | 200 (자산 직접 서빙, 리다이렉트 아님) | ✅ |
| `/does-not-exist/` | 404 (ASSETS 폴백 + not_found_handling) | ✅ |
| `/` 응답 헤더 | `Cache-Control: no-store` + `Vary: Accept-Language` | ✅ |
| `/ko/` 응답 헤더 | `_headers`의 CSP·`X-Frame-Options` 적용 | ✅ (Worker 미개입 확인) |

## 6. 다음에 건드릴 때 체크리스트

- **Worker가 만드는 응답엔 `_headers`가 안 붙는다** → 필요한 헤더는 코드에서 부여(§3).
- **특정 경로만 Worker로** 보내려면 `run_worker_first`에 글롭 배열로 추가(`"/"`는 루트만, `"/x/*"`는 하위 전체).
- **로케일을 추가/변경**하면 `src/i18n/config.ts`만 고치면 Worker도 자동 반영(공유 import).
- **배포는 `pnpm run deploy`** (`pnpm deploy` 아님 — 워크스페이스가 스크립트를 가림). `wrangler deploy`가 `main`을 번들.
- 정적 export는 Next의 `redirects`/`headers`/`rewrites`를 **지원하지 않는다** → 그 역할은 이 Worker와 `_headers`가 대신한다.
