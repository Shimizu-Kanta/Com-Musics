import { Buffer } from 'buffer'

interface SpotifyArtist {
  id: string
  name: string
  images?: SpotifyImage[] 
}

interface SpotifyImage {
  url: string
}

interface SpotifyAlbum {
  images: SpotifyImage[]
}

interface SpotifyTrack {
  id: string
  name: string
  artists: SpotifyArtist[]
  album: SpotifyAlbum
}

const client_id = process.env.SPOTIFY_CLIENT_ID
const client_secret = process.env.SPOTIFY_CLIENT_SECRET
const basic = Buffer.from(`${client_id}:${client_secret}`).toString('base64')

const TOKEN_ENDPOINT = `https://accounts.spotify.com/api/token`
const SEARCH_ENDPOINT = `https://api.spotify.com/v1/search`

const getAccessToken = async () => {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store'
  });
  return response.json()
}

// 追加: 日本語判定
const hasJapanese = (s?: string) =>
  !!s && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(s);

// 追加: シンプルなTTL付きメモリキャッシュ
const ISRC_CACHE_TTL = 24 * 60 * 60 * 1000;
const isrcCache = new Map<string, { ts: number; track: SpotifyTrack }>();
const getCachedISRC = (isrc: string) => {
  const hit = isrcCache.get(isrc);
  if (hit && Date.now() - hit.ts < ISRC_CACHE_TTL) return hit.track;
  if (hit) isrcCache.delete(isrc);
  return null;
};
const setCachedISRC = (isrc: string, track: SpotifyTrack) =>
  isrcCache.set(isrc, { ts: Date.now(), track });

// 追加: 複数トラックの詳細取得（ISRC用）
type SpotifyTrackFull = SpotifyTrack & { external_ids?: { isrc?: string } };

const getTracksFull = async (ids: string[], token: string) => {
  if (!ids.length) return [] as SpotifyTrackFull[];
  const url = `https://api.spotify.com/v1/tracks?ids=${ids.join(',')}&market=JP`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  const data = await res.json();
  return (data?.tracks ?? []) as SpotifyTrackFull[];
};

// 追加: ISRC をまとめて “OR検索” → ISRCごとに日本語優先で最適1件を返す
const batchSearchByISRCPreferJP = async (isrcs: string[], token: string) => {
  const result = new Map<string, SpotifyTrack>();

  // キャッシュ済みはスキップ
  const targets = isrcs.filter(i => !getCachedISRC(i));
  if (targets.length === 0) {
    for (const i of isrcs) {
      const t = getCachedISRC(i);
      if (t) result.set(i, t);
    }
    return result;
  }

  // 長くなりすぎないように8件ずつ
  const chunks: string[][] = [];
  for (let i = 0; i < targets.length; i += 8) chunks.push(targets.slice(i, i + 8));

  for (const ch of chunks) {
    const q = ch.map(i => `isrc:${i}`).join(' OR ');
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&market=JP&limit=50`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    const data = await res.json();
    let items: SpotifyTrackFull[] = data?.tracks?.items ?? [];

    // external_ids が落ちてる環境でも対応（安全策）
    const needISRC = items.some(t => !t.external_ids?.isrc);
    if (needISRC && items.length) {
      const filled = await getTracksFull(items.map(t => t.id), token);
      const byId = new Map(filled.map(f => [f.id, f]));
      items = items.map(t => byId.get(t.id) ?? t);
    }

    // ISRCごとに日本語を含む候補を優先して1件
    for (const i of ch) {
      const candidates = items.filter(t => t.external_ids?.isrc === i);
      if (!candidates.length) continue;
      const best =
        candidates.find(t => hasJapanese(t.name) || hasJapanese(t.artists?.[0]?.name)) || candidates[0];
      result.set(i, best);
      setCachedISRC(i, best);
    }
  }

  // 既存キャッシュも戻す
  for (const i of isrcs) {
    if (!result.has(i)) {
      const t = getCachedISRC(i);
      if (t) result.set(i, t);
    }
  }
  return result;
};

export const searchTracks = async (query: string) => {
  const { access_token } = await getAccessToken();

  // 1) 段階的に広げる（まず軽く）
  const limits = [10, 30, 50];
  let baseItems: SpotifyTrack[] = [];
  for (const limit of limits) {
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&market=JP&limit=${limit}`,
      { headers: { Authorization: `Bearer ${access_token}` }, cache: 'no-store' }
    );
    const data = await res.json();
    baseItems = data?.tracks?.items ?? [];

    // すでに日本語が十分あれば早期終了
    const jpEnough = baseItems.filter(t => hasJapanese(t.name) || hasJapanese(t.artists?.[0]?.name)).length >= 10;
    if (jpEnough || limit === limits[limits.length - 1]) break;
  }

  // 2) 先頭20件だけ詳細取得 → ISRC入手
  const top = baseItems.slice(0, 20);
  const fulls = await getTracksFull(top.map(t => t.id), access_token);
  const byId = new Map(fulls.map(f => [f.id, f]));

  // 3) 非日本語の上位5件のみ、ISRCフォールバック（まとめ撃ち）
  const needFallback = top
    .filter(t => !(hasJapanese(t.name) || hasJapanese(t.artists?.[0]?.name)))
    .slice(0, 5)
    .map(t => byId.get(t.id)?.external_ids?.isrc)
    .filter((i): i is string => !!i);

  if (needFallback.length) {
    const map = await batchSearchByISRCPreferJP(needFallback, access_token);
    // 差し替え
    for (let i = 0; i < top.length; i++) {
      const isrc = byId.get(top[i].id)?.external_ids?.isrc;
      const repl = isrc ? map.get(isrc) : undefined;
      if (repl) top[i] = repl;
    }
  }

  // 4) ISRC（無ければ id）で重複除去しつつ10件に整形
  const seen = new Set<string>();
  const out = [];
  for (const t of top) {
    const full = byId.get(t.id) as SpotifyTrackFull | undefined;
    const key = full?.external_ids?.isrc || t.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: t.id,
      name: t.name,
      artist: t.artists.map(a => a.name).join(', '),
      artistId: t.artists[0]?.id,
      artistName: t.artists[0]?.name,
      albumArtUrl: t.album.images?.[0]?.url,
    });
    if (out.length >= 10) break;
  }
  return out;
};


// (アーティスト検索の関数は、元々imageUrlを使っているので変更ありません)
export const searchArtists = async (query: string) => {
  const { access_token } = await getAccessToken()

  const response = await fetch(
    `${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&type=artist&market=JP&limit=5`,
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Accept-Language': 'ja-JP,ja;q=0.9',
      },
    }
  )
  const data = await response.json()
  return data.artists.items.map((_artist: SpotifyArtist) => ({
    id: _artist.id,
    name: _artist.name,
    imageUrl: _artist.images?.[0]?.url,
  }))
}