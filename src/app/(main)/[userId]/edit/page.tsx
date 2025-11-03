import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EditProfileForm from '@/components/profile/EditProfileForm'
import { type Tag } from '@/components/post/TagSearch'
import { type Profile } from '@/types'
import { type Database } from '@/types/database'
import { getPrimaryArtistFromRelation } from '@/lib/relations'

type ArtistFromDB = Database['public']['Tables']['artists_v2']['Row']

// favorite_songs_v2 の join 結果に合わせて配列前提の型を定義する
type ArtistLite = { id: string; name: string | null }
type SongArtistRelation = { artists_v2: ArtistLite | ArtistLite[] | null }
type SongFromDB = {
  id: string
  title: string | null
  image_url: string | null
  song_artists: SongArtistRelation[] | null
}

type VideoLite = {
  id: string
  title: string | null
  thumbnail_url: string | null
  youtube_video_id: string | null
  artist_id: string | null
  artists_v2: { name: string | null } | null
}

type FavArtistJoinRow = { artists_v2: ArtistFromDB | ArtistFromDB[] | null }

export const dynamic = 'force-dynamic'

export default async function EditProfilePage({
  params,
}: {
  // Next.js 15: params は Promise で渡ってくるため Promise を受ける
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params

  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id_text', userId)
    .single()

  if (!profile || !user || user.id !== profile.id) {
    notFound()
  }

  // --- Favorite Songs ---
  // songs が配列で返る前提に変更
  const { data: favSongsData } = await supabase
    .from('favorite_songs_v2')
    .select('songs_v2(id, title, image_url, song_artists(artists_v2(id, name)))')
    .eq('user_id', profile.id)
    .order('sort_order')

  const favoriteSongRows = (favSongsData ?? []) as { songs_v2: SongFromDB | SongFromDB[] | null }[]
  const initialFavoriteSongs: Tag[] = favoriteSongRows
    .flatMap(({ songs_v2 }) => {
      const songs = Array.isArray(songs_v2) ? songs_v2 : songs_v2 ? [songs_v2] : []
      return songs
    })
    .map((song) => {
        const primaryArtist = getPrimaryArtistFromRelation(song.song_artists)
        const tag: Tag = {
          type: 'song',
          id: song.id,
          name: song.title ?? '',
          artistName: primaryArtist?.name ?? 'Unknown Artist',
          artistId: primaryArtist?.id ?? undefined,
          imageUrl: song.image_url ?? undefined,
        }
        return tag
      })

  // --- Favorite Artists ---
  const { data: favArtistsData } = await supabase
    .from('favorite_artists_v2')
    .select('artists_v2(*)')
    .eq('user_id', profile.id)
    .order('sort_order')

  const favoriteArtistRows = (favArtistsData ?? []) as FavArtistJoinRow[]
  const initialFavoriteArtists: Tag[] = favoriteArtistRows
    .flatMap(({ artists_v2 }) => {
      const artists = Array.isArray(artists_v2) ? artists_v2 : artists_v2 ? [artists_v2] : []
      const artist = artists[0] ?? null
      if (!artist) return []
      const tag: Tag = {
        type: 'artist',
        id: artist.id,
        name: artist.name,
        imageUrl: artist.image_url ?? undefined,
      }
      return [tag]
    })

  // --- Favorite Videos ---
  const { data: favVideosData } = await supabase
    .from('favorite_videos')
    .select(
      'videos(id, title, thumbnail_url, youtube_video_id, artist_id, artists_v2(name))'
    )
    .eq('user_id', profile.id)
    .order('sort_order')

  // videos が配列で返る前提に変更し、フラット化して Tag に変換
  const favoriteVideoRows = (favVideosData ?? []) as { videos: VideoLite | VideoLite[] | null }[]
  const initialFavoriteVideos: Tag[] = favoriteVideoRows
    .flatMap(({ videos }) => {
      const collection = Array.isArray(videos) ? videos : videos ? [videos] : []
      return collection
    })
    .map((video) => {
        const artistRel = video.artists_v2
        const tag: Tag = {
          type: 'video',
          id: video.id,
          name: video.title ?? '',
          imageUrl: video.thumbnail_url ?? undefined,
          youtube_video_id: video.youtube_video_id ?? undefined,
          artistId: video.artist_id ?? undefined,
          artistName: artistRel?.name ?? undefined,
        }
        return tag
      })

  return (
    <EditProfileForm
      profile={profile as Profile}
      initialFavoriteSongs={initialFavoriteSongs}
      initialFavoriteArtists={initialFavoriteArtists}
      initialFavoriteVideos={initialFavoriteVideos}
    />
  )
}
