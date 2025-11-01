import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EditProfileForm from '@/components/profile/EditProfileForm'
import { type Tag } from '@/components/post/TagSearch'
import { type Profile } from '@/types'
import { type Database } from '@/types/database'

type ArtistFromDB = Database['public']['Tables']['artists']['Row']

// favorite_songs の join 結果に合わせて配列前提の型を定義
type ArtistLite = { id: string; name: string | null }
type SongFromDB = {
  id: string
  name: string | null
  album_art_url: string | null
  artists: ArtistLite[]
}

// videos_test は select した列だけに合わせた軽量型
type VideoLite = {
  id: string
  title: string | null
  thumbnail_url: string | null
  youtube_video_id: string | null
  artist_id: string | null
  // artists_test は 1件 or 配列 or null の可能性を吸収
  artists_test: { name: string | null } | { name: string | null }[] | null
}

// favorite_artists の join は artists が配列で返る前提
type FavArtistJoinRow = { artists: ArtistFromDB[] }

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
    .from('favorite_songs')
    .select('songs(id, name, album_art_url, artists(id, name))')
    .eq('user_id', profile.id)
    .order('sort_order')

  const initialFavoriteSongs: Tag[] =
    ((favSongsData ?? []) as unknown as { songs: SongFromDB[] }[])
      .flatMap(({ songs }) => songs ?? [])
      .map((song) => {
        const artist = song.artists?.[0] ?? null
        const tag: Tag = {
          type: 'song',
          id: song.id,
          name: song.name ?? '',
          artistName: artist?.name ?? 'Unknown Artist',
          artistId: artist?.id ?? undefined,
          imageUrl: song.album_art_url ?? undefined,
        }
        return tag
      })

  // --- Favorite Artists ---
  const { data: favArtistsData } = await supabase
    .from('favorite_artists')
    .select('artists(*)')
    .eq('user_id', profile.id)
    .order('sort_order')

  const initialFavoriteArtists: Tag[] =
    ((favArtistsData ?? []) as unknown as FavArtistJoinRow[])
      .flatMap(({ artists }) => {
        const artist = artists?.[0] ?? null
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
    .from('favorite_videos_test')
    .select(
      'videos_test(id, title, thumbnail_url, youtube_video_id, artist_id, artists_test(name))'
    )
    .eq('user_id', profile.id)
    .order('sort_order')

  // videos_test が配列で返る前提に変更し、フラット化して Tag に変換
  const initialFavoriteVideos: Tag[] =
    ((favVideosData ?? []) as unknown as { videos_test: VideoLite[] }[])
      .flatMap(({ videos_test }) => videos_test ?? [])
      .map((video) => {
        const artistRel = Array.isArray(video.artists_test)
          ? video.artists_test[0] ?? null
          : video.artists_test
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
