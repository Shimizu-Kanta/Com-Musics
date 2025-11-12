import { Suspense } from 'react'
import Sidebar from '@/components/layout/Sidebar'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 md:grid-cols-[auto,1fr]">
        <Suspense fallback={<div className="p-4 text-sm text-gray-500">読み込み中...</div>}>
          <Sidebar />
        </Suspense>
        {/* ▼▼▼【重要】border-l を md:border-l に変更します ▼▼▼ */}
        <main className="flex w-full flex-col items-center bg-gray-50 md:min-h-[calc(100vh-4rem)] md:border-l md:border-gray-200">
          {children}
        </main>
      </div>
    </>
  )
}
