'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { isMobile, openWalletDeepLink, isInWalletBrowser } from '@/lib/deeplinks'
import { openWalletConnectModal } from '@/lib/walletconnect'

const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

export interface WalletOption {
  id: string
  name: string
  icon: string
  adapter: string
  bgColor: string
  deepLinkSupport?: boolean
}

const WALLET_OPTIONS: WalletOption[] = [
  {
    id: 'tronlink',
    name: 'TronLink',
    icon: 'https://avatars.githubusercontent.com/u/46257271?s=200&v=4',
    adapter: 'TronLink',
    bgColor: '#2980FE',
    deepLinkSupport: true
  },
  {
    id: 'tokenpocket',
    name: 'TokenPocket',
    icon: 'https://play-lh.googleusercontent.com/D752bekSu2KR_ERPvFiMve7UoQ-5isqXC7v1SP6eVMUaOhCGHJcgjc1k_o8qf1CH_VeFLecOXylysCA05VnY0Sk',
    adapter: 'TokenPocket',
    bgColor: '#2980FE',
    deepLinkSupport: true
  },
  {
    id: 'imtoken',
    name: 'imToken',
    icon: 'https://play-lh.googleusercontent.com/GLZ8GXzaIlCrbnhnTFOlEddrzYEhllePyA3BiiBOoxeQbrq9cOXFzolz4KY57goWSALb',
    adapter: 'imToken Wallet',
    bgColor: '#11C4D1',
    deepLinkSupport: true
  },
  {
    id: 'walletconnect',
    name: 'WalletConnect',
    icon: 'https://storage.googleapis.com/papyrus_images/6880cf2aa4ab998e722037ef5e2d694715961d24d0f13bdad0ac85f555a33bae.png',
    adapter: 'WalletConnect',
    bgColor: '#3B99FC',
    deepLinkSupport: false
  }
]

interface WalletSelectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectWallet: (adapterName: string) => void
  isConnecting?: boolean
  availableWallets?: string[]
}

export function WalletSelectModal({ 
  open, 
  onOpenChange, 
  onSelectWallet,
  isConnecting = false,
  availableWallets = []
}: WalletSelectModalProps) {
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null)
  const [isMobileDevice, setIsMobileDevice] = useState(false)

  useEffect(() => {
    setIsMobileDevice(isMobile())
  }, [])

  const handleWalletClick = (wallet: WalletOption) => {
    setSelectedWallet(wallet.adapter)
    
    if (wallet.id === 'walletconnect') {
      if (PROJECT_ID) {
        openWalletConnectModal(PROJECT_ID)
      }
      return
    }
    
    if (!isMobileDevice) {
      onSelectWallet(wallet.adapter)
      return
    }
    
    if (isInWalletBrowser()) {
      onSelectWallet(wallet.adapter)
      return
    }
    
    if (wallet.deepLinkSupport) {
      const success = openWalletDeepLink(wallet.id)
      
      if (success) {
        setTimeout(() => {
          onOpenChange(false)
        }, 500)
      } else {
        onSelectWallet(wallet.adapter)
      }
    } else {
      onSelectWallet(wallet.adapter)
    }
  }
  
  const isWalletAvailable = (adapter: string) => {
    if (adapter === 'WalletConnect') {
      return true
    }
    return availableWallets.length === 0 || availableWallets.includes(adapter)
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="border-0 bg-transparent p-0 shadow-none sm:max-w-[440px] [&>button]:hidden
          max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:top-auto 
          max-sm:translate-y-0 max-sm:translate-x-0 max-sm:rounded-b-none 
          max-sm:w-screen max-sm:max-w-none max-sm:m-0"
        style={{ zIndex: 99999 }}
      >
        <div className="relative overflow-hidden rounded-[20px] sm:rounded-[20px] max-sm:rounded-t-[20px] max-sm:rounded-b-none bg-[#131313] z-[99999]">
          <div className="flex items-center justify-between px-5 py-4">
            <button
              onClick={() => window.open('https://walletconnect.network/', '_blank')}
              className="flex h-8 w-8 items-center justify-center text-white/70 hover:text-white transition-colors"
              title="Learn more about WalletConnect"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="9" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="17" r="0.5" fill="currentColor" />
              </svg>
            </button>

            <h3 className="text-[17px] font-semibold text-white tracking-tight">Connect Wallet</h3>

            <button
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center text-white/70 hover:text-white transition-colors"
              title="Close"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col">
            {WALLET_OPTIONS.map((wallet) => {
              const available = isWalletAvailable(wallet.adapter)
              return (
              <button
                key={wallet.id}
                onClick={() => handleWalletClick(wallet)}
                disabled={!available}
                className="flex items-center gap-4 w-full px-5 py-3.5 transition-all hover:bg-white/5 active:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div
                  className="flex h-[44px] w-[44px] items-center justify-center rounded-xl overflow-hidden"
                  style={{ backgroundColor: wallet.bgColor }}
                >
                  <img
                    src={wallet.icon || "/placeholder.svg"}
                    alt={wallet.name}
                    width={44}
                    height={44}
                    className="h-full w-full object-cover"
                  />
                </div>

                <span className="flex-1 text-left text-[16px] font-medium text-white">{wallet.name}</span>

                {available && (
                  <span className="px-2.5 py-1 rounded-md bg-[#1a3d1a] text-[11px] font-semibold text-[#22c55e] uppercase tracking-wide">
                    POPULAR
                  </span>
                )}
                
                {isConnecting && selectedWallet === wallet.adapter && (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
              </button>
            )}
            )}
          </div>

          <div className="h-4" />
        </div>
      </DialogContent>
    </Dialog>
  )
}
