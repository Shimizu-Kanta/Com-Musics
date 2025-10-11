import NewLiveForm from '@/components/live/NewLiveForm'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server' // Supabaseクライアントをインポート

function LiveFormFallback() {
  return <p>読み込み中...</p>
}

export const dynamic = 'force-dynamic'

export default async function NewLivePage() {
  // ▼▼▼【重要】ここからが追加部分です ▼▼▼
  const supabase = createClient()

  // 1. livesテーブルから、venue列だけを取得します
  const { data: venuesData } = await supabase.from('lives').select('venue')

  // 2. 取得したデータから重複を取り除き、単純な文字列の配列に変換します
  // 例: ['Aichi Sky Expo', '北海きたえーる', 'さいたまスーパーアリーナ']
  const uniqueVenues = venuesData 
    ? [...new Set(venuesData.map(item => item.venue).filter(Boolean))] as string[]
    : []
  // ▲▲▲

  return (
    <div className="w-full max-w-lg mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">新しいライブを追加</h1>
      <Suspense fallback={<LiveFormFallback />}>
        {/* ▼▼▼ 取得した会場リストを、フォーム部品に渡します ▼▼▼ */}
        <NewLiveForm venues={uniqueVenues} />
      </Suspense>
    </div>
  )
}