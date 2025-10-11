import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EditProfileForm from '@/components/profile/EditProfileForm'
import { type Tag } from '@/components/post/TagSearch'
import { type Profile } from '@/types'
import { type Database } from '@/types/database'

type SongFromDB = Database['public']['Tables']['songs']['Row'] & {
  artists: { id: string; name: string | null } | null
}
type ArtistFromDB = Database['public']['Tables']['artists']['Row']

export const dynamic = 'force-dynamic'

export default async function EditProfilePage({
  params,
}: {
  // Next.js 15: params は Promise で渡ってくるため Promise を受ける
  params: Promise<{ userId: string }>
  // searchParams を使わないなら受け取らなくて OK（必要なら Promise<...> で追加）
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

  const { data: favSongsData } = await supabase
    .from('favorite_songs')
    .select('songs(*, artists(id, name))')
    .eq('user_id', profile.id)
    .order('sort_order')

  const initialFavoriteSongs: Tag[] =
    favSongsData
      ?.flatMap((fav) => fav.songs)
      .filter((song): song is SongFromDB => song !== null && song.artists !== null)
      .map((song) => ({
        type: 'song',
        id: song.id,
        name: song.name,
        artistName: song.artists!.name || 'Unknown Artist',
        artistId: song.artists!.id,
        imageUrl: song.album_art_url ?? undefined,
      })) || []

  const { data: favArtistsData } = await supabase
    .from('favorite_artists')
    .select('artists(*)')
    .eq('user_id', profile.id)
    .order('sort_order')

  const initialFavoriteArtists: Tag[] =
    favArtistsData
      ?.flatMap((fav) => fav.artists)
      .filter((artist): artist is ArtistFromDB => artist !== null)
      .map((artist) => ({
        type: 'artist',
        id: artist.id,
        name: artist.name,
        imageUrl: artist.image_url ?? undefined,
      })) || []

  return (
    <EditProfileForm
      profile={profile as Profile}
      initialFavoriteSongs={initialFavoriteSongs}
      initialFavoriteArtists={initialFavoriteArtists}
    />
  )
}
