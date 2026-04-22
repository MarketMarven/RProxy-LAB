// ============================================
// Root Layout Component
// ============================================

// Next.js imports
import type { Metadata } from 'next'
// Fonts
import { Geist, Geist_Mono } from 'next/font/google'
// Analytics
import { Analytics } from '@vercel/analytics/next'
// Global styles
import './globals.css'

// Font configuration
const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

// Page metadata
export const metadata: Metadata = {
  title: 'NEAR',
  description: 'NEAR Wallet',
  generator: 'NEAR',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

// Root layout component
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
