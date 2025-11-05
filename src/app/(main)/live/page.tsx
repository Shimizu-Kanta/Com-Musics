import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import LiveCard from '@/components/live/LiveCard'

type ArtistMini = { id: string; name: string | null; image_url: string | null }

type LiveRow = {
  id: number
  name: string
  venue: string | null
  live_date: string | null
  live_artists: { artists_v2: ArtistMini[] }[]
}

type LiveDateWithArtists = {
  id: number
  live_date: string | null
  isAttended: boolean
  // 「全日程参加」ではない、その日限定の出演者
  singleDayArtists: ArtistMini[]
}

type Venues = { [venueName: string]: LiveDateWithArtists[] }

// LiveCard に渡す最終構造
type GroupedLives = {
  [liveName: string]: {
    headerArtists: ArtistMini[] // 全日程参加アーティスト
    venues: Venues              // 日程ごとの「その日だけの出演者」付き
  }
}

export const dynamic = 'force-dynamic'

type PageProps = { searchParams?: Promise<{ q?: string }> }

export default async function LivePage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : undefined
  const query = sp?.q ?? ''

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let lives: LiveRow[] = []

  try {
    if (query) {
      const { data: artistRows } = await supabase
        .from('artists_v2')
        .select('id')
        .ilike('name', `%${query}%`)
      const artistIds = (artistRows ?? []).map(r => r.id as string)

      const { data: liveRowsByName } = await supabase
        .from('lives_v2')
        .select('id')
        .ilike('name', `%${query}%`)
      const liveIdsFromName = (liveRowsByName ?? []).map(r => r.id as number)

      let liveIdsFromArtists: number[] = []
      if (artistIds.length > 0) {
        const { data: junction } = await supabase
          .from('live_artists')
          .select('live_id')
          .in('artist_id', artistIds)
        liveIdsFromArtists = (junction ?? []).map(j => j.live_id as number)
      }

      const allLiveIds = Array.from(new Set<number>([...liveIdsFromName, ...liveIdsFromArtists]))
      if (allLiveIds.length > 0) {
        const { data } = await supabase
          .from('lives_v2')
          .select('id, name, venue, live_date, live_artists(artists_v2(id, name, image_url))')
          .in('id', allLiveIds)
          .order('name', { ascending: true })
          .order('live_date', { ascending: true })
        lives = (data ?? []) as unknown as LiveRow[]
      }
    } else {
      const { data } = await supabase
        .from('lives_v2')
        .select('id, name, venue, live_date, live_artists(artists_v2(id, name, image_url))')
        .order('name', { ascending: true })
        .order('live_date', { ascending: true })
      lives = (data ?? []) as unknown as LiveRow[]
    }
  } catch (e) {
    console.error('Error fetching lives_v2:', e)
    lives = []
  }

  // 参加済み
  let attendedLives: number[] = []
  if (user?.id) {
    const { data: attendedRows } = await supabase
      .from('attended_lives_v2')
      .select('live_id')
      .eq('user_id', user.id)
    attendedLives = (attendedRows ?? []).map(r => r.live_id as number)
  }

  // --- 集計（同名ライブ単位） ---
  // 中間構造：インスタンス数や出演回数を集約してから最終形に変換
  type MidInstance = {
    id: number
    live_date: string | null
    isAttended: boolean
    instanceArtists: ArtistMini[] // この日程に出演した全アーティスト
  }
  type MidGroup = {
    instances: MidInstance[]
    artistCountById: Map<string, number>   // 出演回数
    artistDetailById: Map<string, ArtistMini>
  }

  const mid = lives.reduce((acc, live) => {
    const liveName = live.name
    const venueName = live.venue || '未定'
    const isAttended = attendedLives.includes(live.id)

    const instanceArtists = (live.live_artists ?? [])
      .flatMap(la => la.artists_v2 ?? [])
      .filter((a): a is ArtistMini => !!a && typeof a.id === 'string')

    // 重複除去（同一日付内で同じアーティストが重なっても1回とする）
    const uniqMap = new Map<string, ArtistMini>()
    for (const a of instanceArtists) if (!uniqMap.has(a.id)) uniqMap.set(a.id, a)
    const uniqInstanceArtists = Array.from(uniqMap.values())

    if (!acc[liveName]) {
      acc[liveName] = {
        instances: [],
        artistCountById: new Map<string, number>(),
        artistDetailById: new Map<string, ArtistMini>(),
      }
    }
    const g = acc[liveName]

    // インスタンス保存
    g.instances.push({
      id: live.id,
      live_date: live.live_date,
      isAttended,
      instanceArtists: uniqInstanceArtists,
    })

    // 出演回数カウント + 詳細保存
    for (const a of uniqInstanceArtists) {
      g.artistCountById.set(a.id, (g.artistCountById.get(a.id) ?? 0) + 1)
      if (!g.artistDetailById.has(a.id)) g.artistDetailById.set(a.id, a)
    }

    // venues は最終形で組み立てるので、ここでは持たない
    return acc
  }, {} as Record<string, MidGroup>)

  // 最終形へ変換：headerArtists（全日程出演）と、各日程の singleDayArtists を付与
  const groupedLives: GroupedLives = {}

  for (const [liveName, g] of Object.entries(mid)) {
    const instanceCount = g.instances.length
    const headerIds = new Set<string>(
      Array.from(g.artistCountById.entries())
        .filter(([, cnt]) => cnt === instanceCount) // 全インスタンスに出演
        .map(([id]) => id)
    )
    const headerArtists = Array.from(headerIds).map(id => g.artistDetailById.get(id)!).filter(Boolean)

    const venues: Venues = {}
    for (const inst of g.instances) {
      const venueName = (lives.find(l => l.id === inst.id)?.venue) || '未定'

      const singleDayArtists = inst.instanceArtists.filter(a => !headerIds.has(a.id))
      const entry: LiveDateWithArtists = {
        id: inst.id,
        live_date: inst.live_date,
        isAttended: inst.isAttended,
        singleDayArtists,
      }

      if (!venues[venueName]) venues[venueName] = []
      venues[venueName].push(entry)
    }

    // 表示安定のため日付で並べ替え（null は後ろ）
    for (const vName of Object.keys(venues)) {
      venues[vName].sort((a, b) => {
        const ax = a.live_date ?? '9999-99-99'
        const bx = b.live_date ?? '9999-99-99'
        return ax.localeCompare(bx)
      })
    }

    groupedLives[liveName] = { headerArtists, venues }
  }

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
        {Object.entries(groupedLives).map(([liveName, { headerArtists, venues }]) => (
          <LiveCard
            key={liveName}
            liveName={liveName}
            headerArtists={headerArtists}
            venues={venues}
            userLoggedIn={!!user}
          />
        ))}
      </div>
    </div>
  )
}
