/**
 * Helper functions for mobile wallet deeplinks
 * Важно: для iOS Safari window.open() должен вызываться СИНХРОННО в ответ на клик
 */

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

export function isIOS(): boolean {
  if (typeof window === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

/**
 * Открывает Trust Wallet через deeplink с URL сайта для dApp browser
 * ВАЖНО: эта функция должна вызываться СИНХРОННО в обработчике клика
 */
export function openTrustWalletDeeplink(uri: string) {
  const appUrl = typeof window !== 'undefined' ? window.location.href : ''
  const deepLink = `https://link.trustwallet.com/wc?uri=${encodeURIComponent(uri)}&redirectUrl=${encodeURIComponent(appUrl)}`
  
  if (isIOS()) {
    window.location.href = deepLink
  } else {
    window.open(deepLink, '_blank', 'noreferrer noopener')
  }
}

/**
 * Получает universal link для Trust Wallet WalletConnect с dApp URL
 */
export function getTrustWalletUniversalLink(uri: string): string {
  const appUrl = typeof window !== 'undefined' ? window.location.href : ''
  return `https://link.trustwallet.com/wc?uri=${encodeURIComponent(uri)}&redirectUrl=${encodeURIComponent(appUrl)}`
}

/**
 * Универсальная функция для открытия любого кошелька с dApp browser
 */
export function openWalletInDappBrowser(walletName: string, uri: string) {
  const appUrl = typeof window !== 'undefined' ? window.location.href : ''
  
  const walletLinks: Record<string, string> = {
    'trust': `https://link.trustwallet.com/wc?uri=${encodeURIComponent(uri)}&redirectUrl=${encodeURIComponent(appUrl)}`,
    'metamask': `https://metamask.app.link/wc?uri=${encodeURIComponent(uri)}&redirectUrl=${encodeURIComponent(appUrl)}`,
    'rainbow': `https://rnbwapp.com/wc?uri=${encodeURIComponent(uri)}&redirectUrl=${encodeURIComponent(appUrl)}`,
    'coinbase': `https://go.cb-w.com/wc?uri=${encodeURIComponent(uri)}&redirectUrl=${encodeURIComponent(appUrl)}`,
  }
  
  const deepLink = walletLinks[walletName.toLowerCase()] || walletLinks.trust
  
  if (isIOS()) {
    window.location.href = deepLink
  } else {
    window.open(deepLink, '_blank', 'noreferrer noopener')
  }
}
