// Post-build step: overwrite Next's default (unbranded, English) out/404.html with a branded page.
// Cloudflare serves this on every unmatched path (not_found_handling: "404-page"). A single static
// file can carry only one <html lang>, so it's Korean-default with explicit links to both locales.
import { writeFileSync } from 'node:fs';

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>페이지를 찾을 수 없습니다 · 유용한 도구 모음</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100dvh; display:flex; align-items:center; justify-content:center;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background:#fff; color:#171717; }
  @media (prefers-color-scheme: dark) { body { background:#0a0a0a; color:#ededed; } }
  main { max-width:32rem; padding:2rem; text-align:center; }
  h1 { font-size:1.5rem; margin:0 0 .5rem; }
  p { margin:0 0 1.5rem; color:#737373; }
  a { display:inline-block; margin:0 .25rem; padding:.5rem 1rem; border-radius:.375rem;
    text-decoration:none; font-size:.875rem; font-weight:500; }
  .primary { background:#171717; color:#fff; }
  @media (prefers-color-scheme: dark) { .primary { background:#fff; color:#171717; } }
  .secondary { border:1px solid #d4d4d4; color:inherit; }
</style>
</head>
<body>
<main>
  <h1>페이지를 찾을 수 없습니다 · Page not found</h1>
  <p>요청하신 페이지가 존재하지 않습니다. / The page you requested doesn’t exist.</p>
  <a class="primary" href="/ko/">홈으로</a>
  <a class="secondary" href="/en/">English home</a>
</main>
</body>
</html>
`;

writeFileSync('out/404.html', html);
console.log('branded out/404.html written');
