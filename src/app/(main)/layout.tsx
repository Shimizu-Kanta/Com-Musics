import { Suspense } from 'react'
import Sidebar from '@/components/layout/Sidebar'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[auto,1fr]">
        <Suspense fallback={<div className="p-4 text-sm text-gray-500">読み込み中...</div>}>
          <Sidebar />
        </Suspense>
        {/* ▼▼▼【重要】border-l を md:border-l に変更します ▼▼▼ */}
        <main className="flex flex-col items-center w-full min-h-screen bg-gray-50 md:border-l border-gray-200">
          {children}
        </main>
      </div>
    </>
  )
}