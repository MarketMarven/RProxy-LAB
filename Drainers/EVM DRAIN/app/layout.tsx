import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { headers } from 'next/headers'
import { Web3Provider } from '@/components/Web3Provider'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Web3 Wallet App',
  description: 'Connect',
  icons: {
    icon: '/favicon15.jpg',
    apple: '/favicon15.jpg',
  },
}
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const headersObj = await headers()
  const cookies = headersObj.get('cookie')

  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <Web3Provider cookies={cookies}>
          {children}
        </Web3Provider>
      </body>
    </html>
  )
}
