'use client';

import { useEffect, useState } from 'react'

export function useWalletMobile() {
  const [isMobile, setIsMobile] = useState(false)
  const [mobileOS, setMobileOS] = useState<'ios' | 'android' | null>(null)

  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor
    
    const mobile = /iPhone|iPad|iPod|Android/i.test(userAgent)
    setIsMobile(mobile)
    
    if (/iPhone|iPad|iPod/i.test(userAgent)) {
      setMobileOS('ios')
    } else if (/Android/i.test(userAgent)) {
      setMobileOS('android')
    }
  }, [])

  const openMobileWallet = (walletName: string, uri: string) => {
    const walletLinks: Record<string, { ios: string; android: string }> = {
      metamask: {
        ios: 'metamask://wc?uri=',
        android: 'metamask://wc?uri='
      },
      trust: {
        ios: 'trust://wc?uri=',
        android: 'trust://wc?uri='
      },
      rainbow: {
        ios: 'rainbow://wc?uri=',
        android: 'rainbow://wc?uri='
      }
    }

    const wallet = walletLinks[walletName.toLowerCase()]
    if (!wallet || !mobileOS) {
      return false
    }

    const deepLink = wallet[mobileOS] + encodeURIComponent(uri)
    window.location.href = deepLink
    return true
  }

  return { isMobile, mobileOS, openMobileWallet }
}
