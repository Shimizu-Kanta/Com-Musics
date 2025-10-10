import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Header from '@/components/layout/Header' // Headerだけをインポートします

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
        {/* ▼▼▼【重要】ヘッダーの呼び出しを、この一行だけにします ▼▼▼ */}
        <Header />

        <main className="flex flex-col items-center w-full min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}