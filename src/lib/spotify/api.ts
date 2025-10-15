// api.ts
import { Buffer } from 'buffer'

/** ====== 最低限のSpotify型 ====== */
interface SpotifyImage { url: string }
interface SpotifyArtist { id: string; name: string; images?: SpotifyImage[] }
interface SpotifyAlbum { images: SpotifyImage[]; name?: string }
interface SpotifyTrackRaw {
  id: string
  name: string
  artists: SpotifyArtist[]
  album: SpotifyAlbum
  available_markets?: string[]
  external_ids?: { isrc?: string }
}

/** ====== アプリ側で使う返り値の型（MusicSearch.tsx に合わせる） ====== */
export type SearchTrack = {
  id: string
  name: string
  artist: string
  artistId: string         // 必須
  albumArtUrl: string      // 必須
}

const API_BASE = 'https://api.spotify.com/v1'
const SEARCH_ENDPOINT = `${API_BASE}/search`
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'
const MARKET_DEFAULT = process.env.NEXT_PUBLIC_SPOTIFY_MARKET ?? 'JP'

/** ====== 共通ユーティリティ ====== */
const hasJapanese = (s?: string) =>
  !!s && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(s)

const hasJPInTrack = (t: SpotifyTrackRaw) =>
  hasJapanese(t.name) ||
  hasJapanese(t.artists?.[0]?.name) ||
  hasJapanese(t.album?.name)

/** market を自動付与する fetch ラッパー（キャッシュ無効） */
async function sFetch(pathOrUrl: string, token: string, forceNoMarket = false) {
  const url = new URL(pathOrUrl.startsWith('http') ? pathOrUrl : `${API_BASE}/${pathOrUrl}`)
  if (!forceNoMarket && !url.searchParams.has('market')) {
    url.searchParams.set('market', MARKET_DEFAULT)
  }
  return fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
}

/** ====== Client Credentials（ユーザー不要） ====== */
export const getAccessToken = async (): Promise<{ access_token: string }> => {
  const client_id =
    process.env.SPOTIFY_CLIENT_ID || process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID
  const client_secret =
    process.env.SPOTIFY_CLIENT_SECRET || process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_SECRET

  if (!client_id || !client_secret) {
    throw new Error('Spotify client credentials are not configured.')
  }

  const basic = Buffer.from(`${client_id}:${client_secret}`).toString('base64')
  const body = new URLSearchParams({ grant_type: 'client_credentials' })

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
    cache: 'no-store',
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Failed to fetch Spotify token: ${response.status} ${err}`)
  }
  return response.json()
}

/** ====== 詳細取得（ISRC補完用） ====== */
const getTracksFull = async (ids: string[], token: string) => {
  if (!ids.length) return [] as SpotifyTrackRaw[]
  const res = await sFetch(`tracks?ids=${ids.join(',')}`, token)
  const data = await res.json()
  return (data?.tracks ?? []) as SpotifyTrackRaw[]
}

/** ====== ISRCキャッシュ（24h） ====== */
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

/** ====== ISRCまとめ検索（JP→ダメならグローバル→JP可+日本語優先） ====== */
const batchSearchByISRCPreferJP = async (isrcs: string[], token: string) => {
  const result = new Map<string, SpotifyTrackRaw>()

  const targets = isrcs.filter(i => !getCachedISRC(i))
  if (targets.length === 0) {
    for (const i of isrcs) {
      const t = getCachedISRC(i)
      if (t) result.set(i, t)
    }
    return result
  }

  const chunks: string[][] = []
  for (let i = 0; i < targets.length; i += 8) chunks.push(targets.slice(i, i + 8))

  for (const ch of chunks) {
    // 1) JPで OR 検索
    const q = ch.map(i => `isrc:${i}`).join(' OR ')
    const resJP = await sFetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(q)}&type=track&limit=50`, token)
    const dataJP = await resJP.json()
    let itemsJP: SpotifyTrackRaw[] = dataJP?.tracks?.items ?? []

    // external_ids 補完
    if (itemsJP.length && itemsJP.some(t => !t.external_ids?.isrc)) {
      const filled = await getTracksFull(itemsJP.map(t => t.id), token)
      const byId = new Map(filled.map(f => [f.id, f]))
      itemsJP = itemsJP.map(t => byId.get(t.id) ?? t)
    }

    for (const i of ch) {
      const jpCandidates = itemsJP.filter(t => t.external_ids?.isrc === i)
      let best = jpCandidates.find(hasJPInTrack) || jpCandidates[0]

      // 2) グローバル検索 → JPで再生可 & 日本語を優先
      if (!best) {
        const resG = await sFetch(
          `${SEARCH_ENDPOINT}?q=${encodeURIComponent(`isrc:${i}`)}&type=track&limit=50`,
          token,
          /* forceNoMarket */ true
        )
        const dataG = await resG.json()
        const itemsG: SpotifyTrackRaw[] = dataG?.tracks?.items ?? []
        const gJPCanPlay = itemsG.filter(
          t => Array.isArray(t.available_markets) && t.available_markets.includes('JP')
        )
        best = gJPCanPlay.find(hasJPInTrack) || itemsG.find(hasJPInTrack) || gJPCanPlay[0] || itemsG[0]
      }

      if (best) {
        result.set(i, best)
        setCachedISRC(i, best)
      }
    }
  }

  for (const i of isrcs) {
    if (!result.has(i)) {
      const t = getCachedISRC(i)
      if (t) result.set(i, t)
    }
  }
  return result
}

/** ====== 楽曲検索（日本語優先・アプリトークン対応） ====== */
export const searchTracks = async (query: string): Promise<SearchTrack[]> => {
  const { access_token } = await getAccessToken()

  // 段階的に広げる（早期終了）
  const limits = [10, 30, 50]
  let baseItems: SpotifyTrackRaw[] = []
  for (const limit of limits) {
    const res = await sFetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&type=track&limit=${limit}`, access_token)
    const data = await res.json()
    baseItems = data?.tracks?.items ?? []
    const jpEnough = baseItems.filter(hasJPInTrack).length >= 10
    if (jpEnough || limit === limits[limits.length - 1]) break
  }

  // 先頭20件の詳細（ISRC取得）
  const top = baseItems.slice(0, 20)
  const fulls = await getTracksFull(top.map(t => t.id), access_token)
  const byId = new Map(fulls.map(f => [f.id, f]))

  // 非日本語の上位5件だけ ISRC フォールバック
  const needFallback = top
    .filter(t => !hasJPInTrack(t))
    .slice(0, 5)
  const needISRC = needFallback
    .map(t => byId.get(t.id)?.external_ids?.isrc)
    .filter((i): i is string => !!i)

  if (needISRC.length) {
    const map = await batchSearchByISRCPreferJP(needISRC, access_token)
    for (let i = 0; i < top.length; i++) {
      const isrc = byId.get(top[i].id)?.external_ids?.isrc
      const repl = isrc ? map.get(isrc) : undefined
      if (repl) top[i] = repl
    }
  }

  // 返り値は MusicSearch.tsx の Track 型に合わせて「必ず string」を保証
  const seen = new Set<string>()
  const out: SearchTrack[] = []

  for (const t of top) {
    const full = byId.get(t.id)
    const key = full?.external_ids?.isrc || t.id
    if (seen.has(key)) continue
    seen.add(key)

    const artist0 = t.artists?.[0]
    out.push({
      id: t.id,
      name: t.name,
      artist: t.artists.map(a => a.name).join(', '),
      artistId: artist0?.id ?? '',                        // ← 空文字でフォールバック
      albumArtUrl: t.album?.images?.[0]?.url ?? '',       // ← 空文字でフォールバック
    })
    if (out.length >= 10) break
  }

  return out
}

/** ====== アーティスト検索（既存UI互換：imageUrl を返す） ====== */
export const searchArtists = async (query: string) => {
  const { access_token } = await getAccessToken()
  const res = await sFetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&type=artist&limit=5`, access_token)
  const data = await res.json()
  return (data?.artists?.items ?? []).map((a: SpotifyArtist) => ({
    id: a.id,
    name: a.name,
    imageUrl: a.images?.[0]?.url ?? '',
  }))
}
