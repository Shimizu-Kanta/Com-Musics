import { Buffer } from 'buffer'

interface SpotifyArtist {
    id: string
    name: string
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

// .env.localからキーを読み込む
const client_id = process.env.SPOTIFY_CLIENT_ID
const client_secret = process.env.SPOTIFY_CLIENT_SECRET
const basic = Buffer.from(`${client_id}:${client_secret}`).toString('base64')

// Spotifyの認証APIのエンドポイント
const TOKEN_ENDPOINT = `https://accounts.spotify.com/api/token`
// Spotifyの検索APIのエンドポイント
const SEARCH_ENDPOINT = `https://api.spotify.com/v1/search`

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
    // Next.jsのキャッシュ機能を無効にし、毎回新しいトークンを取得するようにする
    cache: 'no-store',
  })

  return response.json()
}

// 2. 楽曲を検索する関数
export const searchTracks = async (query: string) => {
  // まず、許可証（アクセストークン）を取得
  const { access_token } = await getAccessToken()

  // 取得した許可証を使って、Spotifyに検索リクエストを送る
  const response = await fetch(
    // 日本の楽曲を優先的に検索し、結果を10件に絞る
    `${SEARCH_ENDPOINT}?q=${query}&type=track&market=JP&limit=10`,
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    }
  )

  const data = await response.json()

  // 扱いやすいように、必要な情報だけを抽出して返す
  return data.tracks.items.map((track: SpotifyTrack) => ({
    id: track.id,
    name: track.name,
    // こちらもSpotifyArtist型を使います
    artist: track.artists.map((_artist: SpotifyArtist) => _artist.name).join(', '),
    artistId: track.artists[0]?.id,
    albumArtUrl: track.album.images[0]?.url,
  }))
}