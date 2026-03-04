'use client'

import { wagmiAdapter, projectId, networks } from '@/config/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createAppKit } from '@reown/appkit/react'
import React, { type ReactNode, useState, useEffect } from 'react'
import { cookieToInitialState, WagmiProvider, type Config } from 'wagmi'

// Set up queryClient
const queryClient = new QueryClient()

// Metadata для правильной работы deeplinks и dApp Browser
const getAppUrl = () => {
  if (typeof window === 'undefined') return 'https://твойюрл'
  return window.location.origin
}

const metadata = {
  name: 'Web3 Wallet App',
  description: 'Connect and manage your crypto wallet',
  url: getAppUrl(),
  icons: ['ссылканаиконку'],
}

// Популярные кошельки которые поддерживают Base, Polygon, Arbitrum
const featuredWalletIds = [
  'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96',
  '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0',
  'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa',
  '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
  'ecc4036f814562b41a5268adc86270fba1365471402006302e70169465b7ac18',
  '18388be9ac2d02726dbac9777c96efaac06d744b2f6d580fccdd4127a6d01fd1',
  '38f5d18bd8522c244bdd70cb4a68e0e718865155811c043f052fb9f1c51de662',
  '0b415a746fb9ee99cce155c2ceca0c6f6061b1dbca2d722b3ba16381d0562150',
  'c286eebc742a537cd1d6818363e9dc53b21759a1e8e5d9b263d0c03ec7703576',
  '971e689d0a5be527bac79629b4ee9b925e82208e5168b733496a09c0faed0709',
  '19177a98252e07ddfc9af2083ba8e07ef627cb6103467ffebb3f8f4205fd7927',
  '163d2cf19babf05eb8962e9748f9ebe613ed52ebf9c8107c9a0f104bfcf161b3',
  '225affb176778569276e484e1b92637ad061b01e13a048b35a9d280c3b58970f',
  'be49f0a78d6ea1beed3804c3a6b62ea71f568d58d9df8097f3d61c7c9baf273d',
  '85db431492aa2e8672e93f4ea7acf10c88b97b867b0d373107af63dc4880f041',
  '8308656f4548bb81b3508afe355cfbb7f0cb6253d1cc7f998080601f838ecee3',
  '0x7bE12D4C866a5646F2AA81C53975D0F04ea95d45',
  'dceb063851b1833cbb209e3717a0a0b06f3fadda1a6b5ab65c7996f23e4d9b1e',
  'ef333840daf915aafdc4a004525502d6d49d77bd9c65e0642dbaefb3c2893bef',
  '20459438007b75f4f4acb98bf29aa3b800550309646d375da5fd4aac6c2a2c66',
]


let appKitInitialized = false

function initializeAppKit() {
  if (appKitInitialized) return
  if (typeof window === 'undefined') return
  
  if (!projectId) {
    console.warn('WalletConnect Project ID not set - deeplinks may not work')
    return
  }
  
  try {
    createAppKit({
      adapters: [wagmiAdapter],
      projectId,
      networks,
      metadata,
      featuredWalletIds,
      allWallets: 'ONLY_MOBILE',
      enableWalletConnect: true,
      enableInjected: true,
      enableCoinbase: true,
      themeMode: 'light',
      themeVariables: {
        '--w3m-z-index': '9999',
      },
      enableOnramp: false,
      features: {
        email: false,
        socials: false,
      },
      mobileWallets: [
        {
          id: 'trust',
          name: 'Trust Wallet',
          links: {
            native: 'trust://',
            universal: 'https://link.trustwallet.com/wc',
          },
        },
        {
          id: 'metamask',
          name: 'MetaMask',
          links: {
            native: 'metamask://',
            universal: 'https://metamask.app.link/wc',
          },
        },
        {
          id: 'rainbow',
          name: 'Rainbow',
          links: {
            native: 'rainbow://',
            universal: 'https://rnbwapp.com/wc',
          },
        },
      ] as any,
    })
    
    appKitInitialized = true
  } catch (error: any) {
    console.error('AppKit initialization error:', error?.message || error)
  }
}

export function Web3Provider({
  children,
  cookies
}: {
  children: ReactNode
  cookies: string | null
}) {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    initializeAppKit()
    setMounted(true)
  }, [])

  const initialState = cookieToInitialState(
    wagmiAdapter.wagmiConfig as Config,
    cookies
  )

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        {mounted ? children : null}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
