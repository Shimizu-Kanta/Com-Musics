import { Buffer } from 'buffer'

// --- Spotifyから返ってくるデータの「設計図（型）」を定義 ---
// これにより、コードが安全になり、エディタの入力補完も効くようになります

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

// --- APIと通信するための準備 ---

// .env.localファイルから、あなたのSpotifyアプリのIDとシークレットキーを安全に読み込みます
const client_id = process.env.SPOTIFY_CLIENT_ID
const client_secret = process.env.SPOTIFY_CLIENT_SECRET
// 読み込んだIDとキーを、Spotifyが要求する特殊な形式（Base64）に変換します
const basic = Buffer.from(`${client_id}:${client_secret}`).toString('base64')

// SpotifyのAPIの窓口となるURLを定義します
const TOKEN_ENDPOINT = `https://accounts.spotify.com/api/token`
const SEARCH_ENDPOINT = `https://api.spotify.com/v1/search`


// --- 実際にSpotifyと通信する機能 ---

// 1. アクセストークンを取得する関数
//    これがSpotify APIと会話するための「一時的な許可証」です
const getAccessToken = async () => {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    // Next.jsのキャッシュ機能を無効にし、毎回新しい許可証を取得するようにします
    cache: 'no-store'
  });
  return response.json()
}

// 2. 楽曲を検索する関数
export const searchTracks = async (query: string) => {
  // まず、許可証（アクセストークン）を取得します
  const { access_token } = await getAccessToken()

  // 取得した許可証を使って、Spotifyに検索リクエストを送ります
  const response = await fetch(
    // ▼▼▼ ここで日本のカタログを指定しています ▼▼▼
    `${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&type=track&market=JP&limit=10`,
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
        // ▼▼▼ ここで日本語を優先するよう伝えています ▼▼▼
        'Accept-Language': 'ja-JP,ja;q=0.9',
      },
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

  // アプリで扱いやすいように、必要な情報だけを抽出して返します
  return data.tracks.items.map((track: SpotifyTrack) => ({
    id: track.id,
    name: track.name,
    artist: track.artists.map((_artist: SpotifyArtist) => _artist.name).join(', '),
    artistId: track.artists[0]?.id,
    artistName: track.artists[0]?.name,
    albumArtUrl: track.album.images[0]?.url, // アルバムアートワークのURL
  }))
}

// 3. アーティストを検索する関数
export const searchArtists = async (query: string) => {
  const { access_token } = await getAccessToken()

  const response = await fetch(
    // ▼▼▼ アーティスト検索でも同様に指定しています ▼▼▼
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