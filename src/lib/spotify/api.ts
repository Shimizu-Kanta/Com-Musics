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

export const searchTracks = async (query: string) => {
  const { access_token } = await getAccessToken()

  const response = await fetch(
    `${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&type=track&market=JP&limit=10`,
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Accept-Language': 'ja-JP,ja;q=0.9',
      },
    }
  )

  const data = await response.json()

  // ▼▼▼【重要】ここからが今回の主な修正点です ▼▼▼
  return data.tracks.items.map((track: SpotifyTrack) => ({
    id: track.id,
    name: track.name,
    artist: track.artists.map((_artist: SpotifyArtist) => _artist.name).join(', '),
    artistId: track.artists[0]?.id,
    artistName: track.artists[0]?.name,
    // 'imageUrl' を 'albumArtUrl' に変更し、TagSearch.tsxの期待に合わせます
    albumArtUrl: track.album.images[0]?.url, 
  }))
  // ▲▲▲
}

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