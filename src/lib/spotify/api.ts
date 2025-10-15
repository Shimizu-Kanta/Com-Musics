// src/lib/spotify/api.tsx
// 実装方針：
// - クライアント資格情報（Client Credentials）の「アプリトークン」だけで動作
// - まず market=JP で検索 → 日本語が弱い候補は ISRC で「グローバル再検索」して日本語版/JP再生可版を優先
// - それでも英語名しか取れない場合は、ユーザーの日本語クエリを使って「同一ISRCのJP表記」を取り直す
// - さらに表示名は日本語エイリアス（環境変数）で上書き可能（任意）
// - デバッグログは SPOTIFY_DEBUG=1（または NEXT_PUBLIC_SPOTIFY_DEBUG=1）で出力
// - ESLint: no-explicit-any なし、prefer-const 準拠

import { Buffer } from 'buffer'

/** ====== 設定・デバッグ ====== */
const DEBUG =
  (process.env.SPOTIFY_DEBUG ?? process.env.NEXT_PUBLIC_SPOTIFY_DEBUG) === '1'
const MARKET_DEFAULT = process.env.NEXT_PUBLIC_SPOTIFY_MARKET ?? 'JP'
const API_BASE = 'https://api.spotify.com/v1'
const SEARCH_ENDPOINT = `${API_BASE}/search`
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'
const FORCE_JA_HEADER =
  (process.env.SPOTIFY_FORCE_JA_HEADER ??
    process.env.NEXT_PUBLIC_SPOTIFY_FORCE_JA_HEADER) === '1'

const dlog = (...args: unknown[]) => {
  if (DEBUG) console.log('[spotify]', ...args)
}

/** ====== 型定義（必要最小） ====== */
interface SpotifyImage {
  url: string
}
interface SpotifyArtist {
  id: string
  name: string
  images?: SpotifyImage[]
}
interface SpotifyAlbum {
  images: SpotifyImage[]
  name?: string
}
interface SpotifyTrackRaw {
  id: string
  name: string
  artists: SpotifyArtist[]
  album: SpotifyAlbum
  available_markets?: string[]
  external_ids?: { isrc?: string }
  popularity?: number
}
interface TokenResponse {
  access_token: string
}
interface TracksResponse {
  tracks?: SpotifyTrackRaw[]
}
interface SearchTracksResponse {
  tracks?: { items?: SpotifyTrackRaw[] }
}
interface SearchArtistsResponse {
  artists?: { items?: SpotifyArtist[] }
}

/** ====== 返り値のアプリ型（MusicSearch.tsx と互換） ====== */
export type SearchTrack = {
  id: string
  name: string
  artist: string
  artistId: string
  albumArtUrl: string
}

/** ====== 文字種・日本語判定など ====== */
const hasJapanese = (s?: string) =>
  !!s && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(s)

const hasJPInTrack = (t: SpotifyTrackRaw) =>
  hasJapanese(t.name) ||
  (t.artists?.length > 0 && hasJapanese(t.artists[0].name)) ||
  hasJapanese(t.album?.name)

const scoreJP = (t: SpotifyTrackRaw): number => {
  let s = 0
  if (hasJapanese(t.name)) s += 3
  if (t.artists?.length && hasJapanese(t.artists[0].name)) s += 2
  if (hasJapanese(t.album?.name)) s += 1
  if (
    Array.isArray(t.available_markets) &&
    t.available_markets.includes(MARKET_DEFAULT)
  )
    s += 1
  return s
}

const normalize = (s: string) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(
      /[()\[\]{}'"“”‘’・･.,!?！？。、「」『』～〜:：;；／/\\\-＿_]/g,
      ''
    )
    .replace(/\s+/g, '')

/** Spotifyの“トップヒットっぽい”並びを模倣（完全一致/前方一致/部分一致＋人気度＋日本語加点） */
const scoreLikeSpotify = (query: string, t: SpotifyTrackRaw): number => {
  const q = normalize(query)
  const title = normalize(t.name)
  const artist0 = t.artists?.[0]?.name ?? ''
  const artistN = normalize(artist0)
  const albumN = normalize(t.album?.name ?? '')

  let s = 0
  if (title === q) s += 60
  else if (title.startsWith(q)) s += 40
  else if (title.includes(q)) s += 25

  if (artistN === q) s += 30
  else if (artistN.includes(q)) s += 15
  if (albumN.includes(q)) s += 6

  if (hasJapanese(t.name)) s += 4
  if (t.artists?.length && hasJapanese(t.artists[0].name)) s += 3

  const pop = t.popularity ?? 0
  s += Math.floor(pop / 10) // 0~10
  return s
}

/** ====== fetch ラッパー（market自動付与＋詳細ログ＋Nextデータキャッシュ抑止） ====== */
async function sFetch(
  pathOrUrl: string,
  token: string,
  opts?: { forceNoMarket?: boolean; tag?: string }
) {
  const start = Date.now()
  const url = new URL(
    pathOrUrl.startsWith('http') ? pathOrUrl : `${API_BASE}/${pathOrUrl}`
  )
  const hadMarket = url.searchParams.has('market')
  if (!opts?.forceNoMarket && !hadMarket) {
    url.searchParams.set('market', MARKET_DEFAULT)
  }
  const tag = opts?.tag ?? 'request'
  dlog(tag, '→', {
    url: url.toString(),
    hadMarket,
    forceNoMarket: !!opts?.forceNoMarket,
  })

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  }
  if (FORCE_JA_HEADER) headers['Accept-Language'] = 'ja-JP,ja;q=0.9'

  const res = await fetch(url.toString(), {
    headers,
    cache: 'no-store',
    next: { revalidate: 0 },
  })
  dlog(tag, '←', res.status, `${Date.now() - start}ms`)
  return res
}

/** ====== Artist/Track 日本語エイリアス（任意、環境変数で上書き） ====== */
// --- Artist ---
type ArtistJaAliases = {
  byId: Record<string, string>
  byName: Record<string, string>
}
function loadArtistAliases(): ArtistJaAliases {
  try {
    const raw =
      process.env.NEXT_PUBLIC_SPOTIFY_ARTIST_JA_ALIASES ||
      process.env.SPOTIFY_ARTIST_JA_ALIASES ||
      ''
    if (!raw) return { byId: {}, byName: { 'Gen Hoshino': '星野源' } }
    const parsed = JSON.parse(raw) as Partial<ArtistJaAliases>
    return { byId: parsed.byId ?? {}, byName: parsed.byName ?? {} }
  } catch {
    return { byId: {}, byName: {} }
  }
}
const ARTIST_ALIASES: ArtistJaAliases = loadArtistAliases()
dlog(
  'alias.artist',
  `byId=${Object.keys(ARTIST_ALIASES.byId).length}`,
  `byName=${Object.keys(ARTIST_ALIASES.byName).length}`
)
const jaNameForArtist = (a: SpotifyArtist): string =>
  ARTIST_ALIASES.byId[a.id] ?? ARTIST_ALIASES.byName[a.name] ?? a.name

// --- Track ---
type TrackJaAliases = {
  byIsrc: Record<string, string>
  byId: Record<string, string>
  byName: Record<string, string>
}
function loadTrackAliases(): TrackJaAliases {
  try {
    const raw =
      process.env.NEXT_PUBLIC_SPOTIFY_TRACK_JA_ALIASES ||
      process.env.SPOTIFY_TRACK_JA_ALIASES ||
      ''
    if (!raw) return { byIsrc: {}, byId: {}, byName: {} }
    const parsed = JSON.parse(raw) as Partial<TrackJaAliases>
    return {
      byIsrc: parsed.byIsrc ?? {},
      byId: parsed.byId ?? {},
      byName: parsed.byName ?? {},
    }
  } catch {
    return { byIsrc: {}, byId: {}, byName: {} }
  }
}
const TRACK_ALIASES: TrackJaAliases = loadTrackAliases()
dlog(
  'alias.track',
  `byIsrc=${Object.keys(TRACK_ALIASES.byIsrc).length}`,
  `byId=${Object.keys(TRACK_ALIASES.byId).length}`,
  `byName=${Object.keys(TRACK_ALIASES.byName).length}`
)
const jaTitleForTrack = (t: SpotifyTrackRaw): string => {
  const isrc = t.external_ids?.isrc
  if (isrc && TRACK_ALIASES.byIsrc[isrc]) return TRACK_ALIASES.byIsrc[isrc]
  if (TRACK_ALIASES.byId[t.id]) return TRACK_ALIASES.byId[t.id]
  return TRACK_ALIASES.byName[t.name] ?? t.name
}

/** ====== 認証（Client Credentials） ====== */
export const getAccessToken = async (): Promise<TokenResponse> => {
  const client_id =
    process.env.SPOTIFY_CLIENT_ID || process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID
  const client_secret =
    process.env.SPOTIFY_CLIENT_SECRET ||
    process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_SECRET
  if (!client_id || !client_secret) {
    throw new Error('Spotify client credentials are not configured.')
  }

  const basic = Buffer.from(`${client_id}:${client_secret}`).toString('base64')
  const body = new URLSearchParams({ grant_type: 'client_credentials' })

  const start = Date.now()
  dlog('token →', 'client_credentials')
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
    cache: 'no-store',
    next: { revalidate: 0 },
  })
  dlog('token ←', response.status, `${Date.now() - start}ms`)

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Failed to fetch Spotify token: ${response.status} ${err}`)
  }
  return (await response.json()) as TokenResponse
}

/** ====== 詳細取得（ISRC/markets補完） ====== */
const getTracksFull = async (ids: string[], token: string) => {
  if (!ids.length) return [] as SpotifyTrackRaw[]
  const res = await sFetch(`tracks?ids=${ids.join(',')}`, token, { tag: 'tracks' })
  const data: TracksResponse = await res.json()
  return (data?.tracks ?? []) as SpotifyTrackRaw[]
}

/** 足りないプロパティ（ISRC/available_markets等）を補完 */
const fillTracksDetails = async (tracks: SpotifyTrackRaw[], token: string) => {
  const needIds = tracks
    .filter(
      (t) =>
        !t.external_ids?.isrc || typeof t.available_markets === 'undefined'
    )
    .map((t) => t.id)
  if (!needIds.length) return tracks
  const filled = await getTracksFull(needIds, token)
  const byId = new Map<string, SpotifyTrackRaw>(filled.map((f) => [f.id, f]))
  return tracks.map((t) => byId.get(t.id) ?? t)
}

/** ====== ISRCキャッシュ（メモリ / 24h） ====== */
const ISRC_CACHE_TTL = 24 * 60 * 60 * 1000
const isrcCache = new Map<string, { ts: number; track: SpotifyTrackRaw }>()
const getCachedISRC = (isrc: string) => {
  const hit = isrcCache.get(isrc)
  if (hit && Date.now() - hit.ts < ISRC_CACHE_TTL) return hit.track
  if (hit) isrcCache.delete(isrc)
  return null
}
const setCachedISRC = (isrc: string, track: SpotifyTrackRaw) =>
  isrcCache.set(isrc, { ts: Date.now(), track })

/**
 * ISRC → 日本語版の優先選択
 * 1) JP検索（OR）→ 日本語候補がなければ
 * 2) グローバル検索 → JP再生可＆日本語表記を最優先
 * ログ: usedGlobalFallback / chosen / counts
 */
const batchSearchByISRCPreferJP = async (isrcs: string[], token: string) => {
  const result = new Map<string, SpotifyTrackRaw>()
  const targets = isrcs.filter((i) => !getCachedISRC(i))
  if (targets.length === 0) {
    for (const i of isrcs) {
      const t = getCachedISRC(i)
      if (t) result.set(i, t)
    }
    dlog('isrc.cacheOnly', { count: isrcs.length })
    return result
  }

  // 8件ずつ
  const chunks: string[][] = []
  for (let i = 0; i < targets.length; i += 8) chunks.push(targets.slice(i, i + 8))

  for (const ch of chunks) {
    // 1) JP OR検索
    const q = ch.map((i) => `isrc:${i}`).join(' OR ')
    const resJP = await sFetch(
      `${SEARCH_ENDPOINT}?q=${encodeURIComponent(q)}&type=track&limit=50`,
      token,
      { tag: 'searchJP' }
    )
    const dataJP: SearchTracksResponse = await resJP.json()
    let itemsJP: SpotifyTrackRaw[] = dataJP?.tracks?.items ?? []
    dlog('searchJP.items', { total: itemsJP.length })
    itemsJP = await fillTracksDetails(itemsJP, token)

    for (const i of ch) {
      const jpCandidates = itemsJP.filter((t) => t.external_ids?.isrc === i)
      const jpJa = jpCandidates.filter(hasJPInTrack)
      const jpBest = jpJa.sort((a, b) => scoreJP(b) - scoreJP(a))[0]
      let best: SpotifyTrackRaw | undefined = jpBest
      let usedGlobalFallback = false

      // 2) JPで日本語が見つからない/候補がない → グローバル
      if (!jpBest) {
        usedGlobalFallback = true
        const resG = await sFetch(
          `${SEARCH_ENDPOINT}?q=${encodeURIComponent(`isrc:${i}`)}&type=track&limit=50`,
          token,
          { forceNoMarket: true, tag: 'searchGL' }
        )
        const dataG: SearchTracksResponse = await resG.json()
        let itemsG: SpotifyTrackRaw[] = dataG?.tracks?.items ?? []
        dlog('searchGL.items', { total: itemsG.length })
        itemsG = await fillTracksDetails(itemsG, token)

        const gJPCanPlay = itemsG.filter(
          (t) =>
            Array.isArray(t.available_markets) &&
            t.available_markets.includes('JP')
        )
        const sortedPref = [
          ...gJPCanPlay
            .filter(hasJPInTrack)
            .sort((a, b) => scoreJP(b) - scoreJP(a)),
          ...itemsG.filter(hasJPInTrack).sort((a, b) => scoreJP(b) - scoreJP(a)),
          ...gJPCanPlay.sort((a, b) => scoreJP(b) - scoreJP(a)),
          ...itemsG,
        ]
        best = sortedPref[0] || jpCandidates[0]
      }

      if (best) {
        result.set(i, best)
        setCachedISRC(i, best)
        dlog('isrc.choose', {
          isrc: i,
          usedGlobalFallback,
          jpCandidates: jpCandidates.length,
          chosen: best.name,
          artist: best.artists?.[0]?.name ?? '',
        })
      } else {
        dlog('isrc.noResult', { isrc: i, jpCandidates: jpCandidates.length })
      }
    }
  }
  return result
}

/** ====== “日本語取り直し”：JPクエリで同一ISRCの日本語表記を探す ====== */
async function tryRelabelFromQueryJP(
  q: string,
  artistName: string | undefined,
  token: string,
  targetIsrc: string
): Promise<SpotifyTrackRaw | null> {
  const parts: string[] = [`track:${q}`]
  if (artistName && artistName.trim()) parts.push(`artist:"${artistName}"`)
  const url = `${SEARCH_ENDPOINT}?q=${encodeURIComponent(
    parts.join(' ')
  )}&type=track&limit=10`
  const res = await sFetch(url, token, { tag: 'relabelJP' })
  const data: SearchTracksResponse = await res.json()
  let items: SpotifyTrackRaw[] = data?.tracks?.items ?? []
  items = await fillTracksDetails(items, token)
  const hit = items.find(
    (t) => t.external_ids?.isrc === targetIsrc && hasJPInTrack(t)
  )
  return hit ?? null
}

/** ====== 楽曲検索（日本語優先＋疑似ランキング＋詳細ログ） ====== */
export const searchTracks = async (query: string): Promise<SearchTrack[]> => {
  const { access_token } = await getAccessToken()
  dlog('searchTracks.start', { query, market: MARKET_DEFAULT })

  // 段階的に広げる（早期終了）
  const limits = [10, 30, 50]
  let baseItems: SpotifyTrackRaw[] = []
  for (const limit of limits) {
    const res = await sFetch(
      `${SEARCH_ENDPOINT}?q=${encodeURIComponent(
        query
      )}&type=track&limit=${limit}`,
      access_token,
      { tag: `search:${limit}` }
    )
    const data: SearchTracksResponse = await res.json()
    baseItems = data?.tracks?.items ?? []
    const jpCount = baseItems.filter(hasJPInTrack).length
    dlog('searchTracks.batch', { limit, got: baseItems.length, jpCount })
    if (jpCount >= 10 || limit === limits[limits.length - 1]) break
  }

  // 先頭20件の詳細（ISRC取得）
  const top = baseItems.slice(0, 20)
  const fulls = await getTracksFull(top.map((t) => t.id), access_token)
  const byId = new Map<string, SpotifyTrackRaw>(fulls.map((f) => [f.id, f]))

  // 非日本語の上位候補（最大12件）を ISRC フォールバック
  const needFallback = top.filter((t) => !hasJPInTrack(t)).slice(0, 12)
  const isrcs = Array.from(
    new Set(
      needFallback
        .map((t) => byId.get(t.id)?.external_ids?.isrc ?? undefined)
        .filter((i): i is string => typeof i === 'string')
    )
  )
  dlog('searchTracks.fallbackPlan', {
    candidates: needFallback.length,
    isrcs: isrcs.length,
  })

  if (isrcs.length) {
    const map = await batchSearchByISRCPreferJP(isrcs, access_token)
    let replaced = 0
    for (let i = 0; i < top.length; i++) {
      const isrc = byId.get(top[i].id)?.external_ids?.isrc
      const repl = isrc ? map.get(isrc) : undefined
      if (repl) {
        top[i] = repl
        replaced++
      }
    }
    dlog('searchTracks.fallbackDone', { replaced })
  }

  // まだ英語名のものだけ、日本語表記の「取り直し」を最大3件まで試す
  if (hasJapanese(query)) {
    let relabeled = 0
    for (let i = 0; i < top.length && relabeled < 3; i++) {
      const t = top[i]
      const isrc = t.external_ids?.isrc ?? byId.get(t.id)?.external_ids?.isrc
      if (!isrc) continue
      if (hasJapanese(t.name)) continue // 既に日本語
      const artist0 = t.artists?.[0]?.name
      const jp = await tryRelabelFromQueryJP(query, artist0, access_token, isrc)
      if (jp) {
        top[i] = jp
        relabeled++
      }
    }
    dlog('searchTracks.relabelJP', { relabeled })
  }

  // 疑似Spotifyランク + 日本語スコアで並べ替え（安定ソート）
  const withScore = top.map((t, i) => ({
    t,
    i,
    s: scoreLikeSpotify(query, t) + scoreJP(t),
  }))
  withScore.sort((a, b) => b.s - a.s || a.i - b.i)
  const sortedTop: SpotifyTrackRaw[] = withScore.map((x) => x.t)
  dlog(
    'searchTracks.sortedHead',
    sortedTop.slice(0, 3).map((t) => ({
      name: t.name,
      a: t.artists?.[0]?.name ?? '',
    }))
  )

  // 重複除去して10件返す（artistId/albumArtUrlは必ず string）
  const seen = new Set<string>()
  const out: SearchTrack[] = []
  for (const t of sortedTop) {
    const key = t.external_ids?.isrc || t.id
    if (seen.has(key)) continue
    seen.add(key)
    const artist0 = t.artists?.[0]
    out.push({
      id: t.id,
      name: jaTitleForTrack(t),
      artist: t.artists.map((a) => jaNameForArtist(a)).join(', '),
      artistId: artist0?.id ?? '',
      albumArtUrl: t.album?.images?.[0]?.url ?? '',
    })
    if (out.length >= 10) break
  }

  dlog('searchTracks.done', { returned: out.length })
  return out
}

/** ====== アーティスト検索（任意：必要箇所で使用可。日本語別名適用） ====== */
export const searchArtists = async (query: string) => {
  const { access_token } = await getAccessToken()
  const url = `${SEARCH_ENDPOINT}?q=${encodeURIComponent(
    `artist:${query}`
  )}&type=artist&market=${MARKET_DEFAULT}&limit=5`
  const start = Date.now()
  dlog('searchArtists →', url)
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${access_token}`,
      ...(FORCE_JA_HEADER ? { 'Accept-Language': 'ja-JP,ja;q=0.9' } : {}),
    },
    cache: 'no-store',
    next: { revalidate: 0 },
  })
  dlog('searchArtists ←', res.status, `${Date.now() - start}ms`)
  const data: SearchArtistsResponse = await res.json()
  const items = (data?.artists?.items ?? []).map((a) => ({
    id: a.id,
    name: jaNameForArtist(a),
    imageUrl: a.images?.[0]?.url ?? '',
  }))
  dlog('searchArtists.done', { returned: items.length })
  return items
}
