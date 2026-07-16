/**
 * Manual Google auth path recorder.
 * Opens a visible Chromium window — you sign in normally.
 * Records: navigations, request paths, cookies, form selectors.
 *
 * Usage:
 *   node scripts/record-google-auth.mjs
 * Stop: close the browser window OR press Ctrl+C here.
 *
 * Output:
 *   .phishforge/auth-recordings/google-auth-<timestamp>.json
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(ROOT, '.phishforge', 'auth-recordings');
const TARGET =
  process.env.GOOGLE_AUTH_URL
  || 'https://accounts.google.com/v3/signin/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin&hl=en&continue=https%3A%2F%2Fwww.google.com%2F';

fs.mkdirSync(OUT_DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outFile = path.join(OUT_DIR, `google-auth-${stamp}.json`);

const record = {
  startedAt: new Date().toISOString(),
  targetUrl: TARGET,
  navigations: [],
  network: [],
  cookiesSnapshots: [],
  notes: [],
};

function pathOnly(url) {
  try {
    const u = new URL(url);
    return { host: u.hostname, pathname: u.pathname, search: u.search, href: u.href };
  } catch {
    return { href: String(url || '') };
  }
}

function pushNav(kind, url, extra = {}) {
  const row = {
    t: new Date().toISOString(),
    kind,
    ...pathOnly(url),
    ...extra,
  };
  record.navigations.push(row);
  const short = `${row.pathname || ''}${row.search || ''}`.slice(0, 120);
  console.log(`[nav] ${kind.padEnd(10)} ${row.host || ''} ${short}`);
}

function pushNet(method, url, status, resourceType) {
  const p = pathOnly(url);
  // Keep Google auth / accounts traffic only (avoid huge noise)
  if (!/google\.|gstatic\.|googleapis\./i.test(p.host || '')) return;
  if (/\.(png|jpg|jpeg|gif|webp|ico|woff2?|ttf|svg)(\?|$)/i.test(p.pathname || '')) return;
  const row = {
    t: new Date().toISOString(),
    method,
    status,
    resourceType,
    host: p.host,
    pathname: p.pathname,
    search: p.search,
  };
  record.network.push(row);
  if (
    /signin|challenge|identifier|rejected|password|ServiceLogin|accounts|CheckCookie|batchexecute|browserinfo/i
      .test(`${p.pathname}${p.search}`)
  ) {
    console.log(`[net] ${String(status).padStart(3)} ${method} ${p.pathname}${String(p.search || '').slice(0, 60)}`);
  }
}

async function snapshotCookies(context, label) {
  const cookies = await context.cookies();
  record.cookiesSnapshots.push({
    t: new Date().toISOString(),
    label,
    count: cookies.length,
    names: cookies.map((c) => `${c.name}@${c.domain}`),
    cookies,
  });
  console.log(`[cookies] ${label}: ${cookies.length} cookies`);
}

function save() {
  record.endedAt = new Date().toISOString();
  // Unique path sequence (auth spine)
  const spine = [];
  for (const n of record.navigations) {
    const key = `${n.pathname || ''}`;
    if (!key) continue;
    if (spine[spine.length - 1] !== key) spine.push(key);
  }
  record.pathSpine = spine;
  fs.writeFileSync(outFile, JSON.stringify(record, null, 2), 'utf8');
  console.log(`\n[saved] ${outFile}`);
  console.log('[spine]', spine.join(' → '));
}

async function main() {
  console.log('=== Google auth path recorder ===');
  console.log('A Chrome window will open. Sign in manually (email → password → 2FA if any).');
  console.log('When done, CLOSE the browser window. Paths will be saved.\n');
  console.log(`Target: ${TARGET}`);
  console.log(`Output: ${outFile}\n`);

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--start-maximized',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const context = await browser.newContext({
    viewport: null,
    locale: 'en-US',
    ignoreHTTPSErrors: true,
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();

  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return;
    pushNav('navigate', frame.url());
  });

  page.on('request', (req) => {
    // only document + xhr/fetch for path discovery
    const t = req.resourceType();
    if (!['document', 'xhr', 'fetch'].includes(t)) return;
    pushNet(req.method(), req.url(), null, t);
  });

  page.on('response', async (res) => {
    const req = res.request();
    const t = req.resourceType();
    if (!['document', 'xhr', 'fetch'].includes(t)) return;
    pushNet(req.method(), res.url(), res.status(), t);
  });

  // Periodic cookie + URL snapshots while you work
  const tick = setInterval(async () => {
    try {
      if (page.isClosed()) return;
      record.notes.push({ t: new Date().toISOString(), url: page.url() });
      await snapshotCookies(context, 'tick');
      save();
    } catch { /* */ }
  }, 8_000);

  process.on('SIGINT', async () => {
    clearInterval(tick);
    try { await snapshotCookies(context, 'sigint'); } catch { /* */ }
    save();
    try { await browser.close(); } catch { /* */ }
    process.exit(0);
  });

  await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  pushNav('start', page.url());
  await snapshotCookies(context, 'start');

  // Wait until user closes browser
  await new Promise((resolve) => {
    browser.on('disconnected', resolve);
  });

  clearInterval(tick);
  save();
  console.log('\nDone. Share/use the JSON — next step builds automation from pathSpine.');
}

main().catch((e) => {
  console.error('FATAL', e.message);
  try { save(); } catch { /* */ }
  process.exit(1);
});
