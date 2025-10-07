import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
// @ts-expect-error - Next.js allows importing CSS files directly
import './globals.css'
import Header from '@/components/layout/Header' // 作成したHeaderをインポート

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Com-Musics',
  description: 'A social media for music lovers.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-1 w-full container mx-auto px-4 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}