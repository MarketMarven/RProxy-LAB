import { NextResponse } from "next/server";

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
    console.error("[LOG] Telegram error:", JSON.stringify(result));
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { event } = body;

    if (!event || typeof event !== "string") {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }

    if (event !== "installed") {
      return NextResponse.json({ ok: true, silent: true });
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const ua = request.headers.get("user-agent") || "unknown";
    const device = parseUserAgent(ua);
    const time = new Date().toLocaleString("en-GB", { timeZone: "Europe/Moscow" });

    const message =
      `🟢 <b>New Installation</b>\n` +
      `⏱ ${time}\n` +
      `🌐 IP: <code>${ip}</code>\n` +
      `🖥 ${device}`;

    await sendToTelegram(message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[LOG] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
