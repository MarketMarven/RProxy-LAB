export function isMobile(): boolean {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

export function getCurrentDappUrl(): string {
  if (typeof window === 'undefined') return 'https://your-dapp.com'
  return window.location.origin
}

export function detectWalletEnvironment(): string | null {
  if (typeof window === 'undefined') return null
  
  const ua = navigator.userAgent.toLowerCase()
  const uaOriginal = navigator.userAgent
  
  if ((window as any).tronLink) {
    return 'tronlink'
  }
  
  const isTrustWallet = 
    ua.includes('trust') || 
    ua.includes('trustwallet') ||
    uaOriginal.includes('Trust') ||
    uaOriginal.includes('TrustWallet') ||
    (window as any).trustwallet ||
    (window as any).isTrust
  
  if (isTrustWallet) {
    return 'trustwallet'
  }
  
  if (ua.includes('imtoken')) {
    return 'imtoken'
  }
  
  if (ua.includes('tokenpocket') || (window as any).tokenpocket) {
    return 'tokenpocket'
  }
  
  if ((window as any).tronWeb) {
    return 'generic'
  }
  
  return null
}

export async function waitForWallet(maxAttempts = 10, interval = 100): Promise<string | null> {
  if (typeof window === 'undefined') return null
  
  for (let i = 0; i < maxAttempts; i++) {
    const wallet = detectWalletEnvironment()
    if (wallet) {
      return wallet
    }
    
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  
  return null
}

export function isInWalletBrowser(): boolean {
  return detectWalletEnvironment() !== null
}

export function createTronLinkDeepLink(dappUrl: string = getCurrentDappUrl()): string {
  const urlWithParam = `${dappUrl}?wallet=tronlink`
  
  const params = {
    url: urlWithParam,
    action: 'open',
    protocol: 'tronlink',
    version: '1.0',
    dappName: 'Tron Wallet DApp',
    callbackUrl: urlWithParam
  }
  
  const encodedParams = encodeURIComponent(JSON.stringify(params))
  return `tronlinkoutside://pull.activity?param=${encodedParams}`
}

export function createImTokenDeepLink(dappUrl: string = getCurrentDappUrl()): string {
  const urlWithParam = `${dappUrl}?wallet=imtoken`
  const encodedUrl = encodeURIComponent(urlWithParam)
  return `imtokenv2://navigate?screen=DappView&url=${encodedUrl}`
}

export function createTokenPocketDeepLink(dappUrl: string = getCurrentDappUrl()): string {
  const urlWithParam = `${dappUrl}?wallet=tokenpocket`
  
  const params = {
    url: urlWithParam,
    chain: 'TRON',
    source: 'dapp'
  }
  
  const encodedParams = encodeURIComponent(JSON.stringify(params))
  return `tpdapp://open?params=${encodedParams}`
}

export function createTokenPocketDeepLinkAdvanced(dappUrl: string = getCurrentDappUrl()): string {
  const urlWithParam = `${dappUrl}?wallet=tokenpocket`
  
  const params = {
    url: urlWithParam,
    chain: 'TRON',
    source: 'dapp'
  }
  
  const encodedParams = encodeURIComponent(JSON.stringify(params))
  return `tpoutside://pull.activity?param=${encodedParams}`
}

export function createTrustWalletDeepLink(dappUrl: string = getCurrentDappUrl()): string {
  const urlWithParam = `${dappUrl}?wallet=trustwallet`
  const encodedUrl = encodeURIComponent(urlWithParam)
  return `https://link.trustwallet.com/open_url?url=${encodedUrl}`
}

export function openWalletDeepLink(walletId: string) {
  if (!isMobile()) {
    return false
  }

  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search)
    const walletParam = urlParams.get('wallet')
    if (walletParam) {
      return false
    }
  }

  const currentWallet = detectWalletEnvironment()
  if (currentWallet) {
    return false
  }

  const dappUrl = getCurrentDappUrl()
  let deepLink: string

  switch (walletId.toLowerCase()) {
    case 'tronlink':
      deepLink = createTronLinkDeepLink(dappUrl)
      break
    case 'imtoken':
      deepLink = createImTokenDeepLink(dappUrl)
      break
    case 'tokenpocket':
      deepLink = createTokenPocketDeepLink(dappUrl)
      break
    case 'trustwallet':
      deepLink = createTrustWalletDeepLink(dappUrl)
      break
    default:
      return false
  }
  
  try {
    const link = document.createElement('a')
    link.href = deepLink
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    return true
  } catch {
    return false
  }
}

export async function checkWalletInstalled(walletId: string): Promise<boolean> {
  if (!isMobile()) return false

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(false)
    }, 2000)

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearTimeout(timeout)
        resolve(true)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    openWalletDeepLink(walletId)
  })
}
