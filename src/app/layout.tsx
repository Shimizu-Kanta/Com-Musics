import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Header from '@/components/layout/Header' // Headerだけをインポートします
import { SidebarProvider } from '@/components/layout/SidebarContext'

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
        <SidebarProvider>
          {/* ▼▼▼【重要】ヘッダーの呼び出しを、この一行だけにします ▼▼▼ */}
          <Header />

          <main className="col-span-1 md:col-span-3 flex flex-col items-center w-full min-h-screen bg-gray-50 md:border-l border-gray-200">
            {children}
          </main>
        </SidebarProvider>
      </body>
    </html>
  )
}