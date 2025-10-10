import { createClient } from '@/lib/supabase/server'
import { type Database } from '@/types/database'
import Link from 'next/link'
import LiveCard from '@/components/live/LiveCard'

type Live = Database['public']['Tables']['lives']['Row'] & {
  artists: { id: string; name: string | null; image_url: string | null } | null
}

type LiveDateInfo = {
  id: number
  live_date: string | null
  isAttended: boolean
}

type GroupedLives = {
  [liveName: string]: {
    artistId: string | null
    artistName: string | null
    artistImageUrl: string | null
    venues: {
      [venueName: string]: LiveDateInfo[]
    }
  }
}

export default async function LivePage({
  searchParams,
}: {
  // Next.js 15: searchParams は Promise で渡る
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q ?? ''

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // lives + artists を取得（昇順）
  let queryBuilder = supabase
    .from('lives')
    .select('*, artists(id, name, image_url)')
    .order('live_date', { ascending: true })

  if (query) {
    // ライブ名/アーティスト名の部分一致検索
    queryBuilder = queryBuilder.or(
      `name.ilike.%${query}%,artists.name.ilike.%${query}%`,
    )
  }

  const { data: livesData } = await queryBuilder
  const lives: Live[] = (livesData as Live[] | null) ?? []

  // ユーザーがログインしていれば参加済みライブIDを取得
  let attendedLiveIds: number[] = []
  if (user) {
    const { data: attendedData } = await supabase
      .from('attended_lives')
      .select('live_id')
      .eq('user_id', user.id)

    attendedLiveIds = attendedData ? attendedData.map((a) => a.live_id) : []
  }

  // ライブ名 → 会場ごとに日付をグルーピング
  const groupedLives = lives.reduce<GroupedLives>((acc, live) => {
    const liveName = live.name || '不明なライブ'
    const artistId = live.artists?.id ?? null
    const artistName = live.artists?.name ?? '不明なアーティスト'
    const artistImageUrl = live.artists?.image_url ?? null
    const venueName = live.venue || '不明な会場'
    const isAttended = attendedLiveIds.includes(live.id)

    if (!acc[liveName]) {
      acc[liveName] = { artistId, artistName, artistImageUrl, venues: {} }
    }
    if (!acc[liveName].venues[venueName]) {
      acc[liveName].venues[venueName] = []
    }

    acc[liveName].venues[venueName].push({
      id: live.id,
      live_date: live.live_date,
      isAttended,
    })

    return acc
  }, {} as GroupedLives)

  return (
    <div className="w-full max-w-lg mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">ライブ一覧</h1>
        <Link
          href="/live/new"
          className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          ライブを追加
        </Link>
      </div>

      <form method="get" className="mb-8">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="ライブ名、アーティスト名で検索"
          className="block w-full rounded-md border-gray-300 shadow-sm"
        />
      </form>

      <div className="space-y-4">
        {Object.entries(groupedLives).map(
          ([liveName, { artistId, artistName, artistImageUrl, venues }]) => (
            <LiveCard
              key={liveName}
              liveName={liveName}
              artistId={artistId}
              artistName={artistName}
              artistImageUrl={artistImageUrl}
              venues={venues}
              userLoggedIn={!!user}
            />
          ),
        )}
        {lives.length === 0 && (
          <p className="text-center text-gray-500">
            {query
              ? '検索結果が見つかりませんでした。'
              : 'まだライブが登録されていません。'}
          </p>
        )}
      </div>
    </div>
  )
}
