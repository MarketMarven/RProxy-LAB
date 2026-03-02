import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { TronWalletProvider } from '@/components/tron-wallet-provider'
import { Toaster } from '@/components/ui/sonner'

import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'SUNDOG Airdrop - Получить бесплатные SUNDOG токены',
  description: 'Эксклюзивная раздача SUNDOG!',
  keywords: ['SUNDOG', 'airdrop', 'TRON', 'криптовалюта', 'токены', 'бесплатно'],
  themeColor: '#facc15',
  icons: {
    icon: [
      {
        url: '/sundog-coin.png',
      },
    ],
    apple: '/sundog-coin.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <TronWalletProvider>
          {children}
        </TronWalletProvider>
        <Toaster />
      </body>
    </html>
  )
}
