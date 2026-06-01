import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { PwaRegistration } from '@/components/layout/PwaRegistration'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: { default: 'SBC Files', template: '%s | SBC Files' },
  description: 'Enterprise-grade Secure Document Sharing Platform',
  robots: 'noindex, nofollow',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/icons/icon-192x192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SBC Files',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="theme-color" content="#020617" />
      </head>
      <body className="min-h-full app-bg text-slate-100 antialiased">
        <PwaRegistration />
        {children}
      </body>
    </html>
  )
}
