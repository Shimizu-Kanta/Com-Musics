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

export const dynamic = 'force-dynamic'

export default async function LivePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q ?? ''

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  
  let lives: Live[] = []
  
  // ▼▼▼【重要】ここからが今回の主な修正点です ▼▼▼
  try {
    if (query) {
      // 1. 検索クエリに一致するアーティストのIDを探す
      const { data: artistIdsData } = await supabase
        .from('artists')
        .select('id')
        .ilike('name', `%${query}%`);
      const artistIds = artistIdsData?.map(a => a.id) ?? [];

      // 2. ライブ名が直接クエリに一致するライブのIDを探す
      const { data: liveIdsFromNameData } = await supabase
        .from('lives')
        .select('id')
        .ilike('name', `%${query}%`);
      const liveIdsFromName = liveIdsFromNameData?.map(l => l.id) ?? [];
      
      // 3. アーティストIDに一致するライブのIDを探す (artist_idカラムを検索)
      let liveIdsFromArtist: number[] = [];
      if (artistIds.length > 0) {
        const { data: liveIdsFromArtistData } = await supabase
          .from('lives')
          .select('id')
          .in('artist_id', artistIds);
        liveIdsFromArtist = liveIdsFromArtistData?.map(l => l.id) ?? [];
      }

      // 4. 全てのライブIDを統合し、重複を削除
      const allLiveIds = Array.from(new Set([...liveIdsFromName, ...liveIdsFromArtist]));

      // 5. 最終的なライブの情報を取得して返す
      if (allLiveIds.length > 0) {
        const { data, error } = await supabase
          .from('lives')
          .select('*, artists(id, name, image_url)')
          .in('id', allLiveIds)
          .order('name', { ascending: true })
          .order('live_date', { ascending: true });
        if (error) throw error;
        lives = data as Live[] || [];
      }
    } else {
      // 検索クエリがない場合は、全てのライブを取得
      const { data, error } = await supabase
        .from('lives')
        .select('*, artists(id, name, image_url)')
        .order('name', { ascending: true })
        .order('live_date', { ascending: true });
      if (error) throw error;
      lives = data as Live[] || [];
    }
  } catch (error) {
    console.error('Error fetching lives:', error);
    lives = []; 
  }
  // ▲▲▲

  const attendedLives =
    user?.id
      ? (
          await supabase
            .from('attended_lives')
            .select('live_id')
            .eq('user_id', user.id)
        ).data?.map((row) => row.live_id) ?? []
      : []

  const groupedLives = lives.reduce((acc, live) => {
    const liveName = live.name
    const venueName = live.venue || '未定'
    const isAttended = attendedLives.includes(live.id)

    if (!acc[liveName]) {
      acc[liveName] = {
        artistId: live.artists?.id || null,
        artistName: live.artists?.name || null,
        artistImageUrl: live.artists?.image_url || null,
        venues: {},
      }
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
          )
        )}
      </div>
    </div>
  )
}