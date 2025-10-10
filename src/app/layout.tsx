import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Header from '@/components/layout/Header'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Com-Musics',
  description: 'Your music community',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <Header />
        
        {/* ▼▼▼【重要】ここに min-h-screen を移動させます ▼▼▼ */}
        <main className="flex flex-col items-center w-full min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}