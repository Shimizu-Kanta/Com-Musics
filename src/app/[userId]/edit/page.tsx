import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EditProfileForm from '@/components/profile/EditProfileForm'
import { type Tag } from '@/components/post/TagSearch'
import { type Profile, type Song, type Artist } from '@/types'
import { type Database } from '@/types/database'

// 参照コードで使われていた、より正確な型定義を導入します
type SongFromDB = Database['public']['Tables']['songs']['Row'] & { artists: { id: string, name: string | null } | null }
type ArtistFromDB = Database['public']['Tables']['artists']['Row']

type EditProfilePageProps = {
  params: { userId: string }
}

export default async function EditProfilePage({ params }: EditProfilePageProps) {
  const { userId } = params
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id_text', userId)
    .single()

  if (!profile || !user || user.id !== profile.id) {
    notFound()
  }

  // --- お気に入り曲のリストを取得 ---
  const { data: favSongsData } = await supabase
    .from('favorite_songs')
    .select('songs(*, artists(id, name))')
    .eq('user_id', profile.id)

  // ▼▼▼【ここからが今回の唯一の修正点です】▼▼▼
  // 送っていただいた「動いていた」コードの、.flatMap()を使った正しいデータ変換ロジックに置き換えます。
  const initialFavoriteSongs: Tag[] =
    favSongsData
      ?.flatMap(fav => fav.songs)
      .filter((song): song is SongFromDB => song !== null && song.artists !== null)
      .map(song => ({
        type: 'song',
        id: song.id,
        name: song.name,
        artistName: song.artists!.name || 'Unknown Artist',
        artistId: song.artists!.id,
        imageUrl: song.album_art_url ?? undefined,
      })) || []

  // --- お気に入りアーティストのリストを取得 (こちらも同様に修正) ---
  const { data: favArtistsData } = await supabase
    .from('favorite_artists')
    .select('artists(*)')
    .eq('user_id', profile.id)
  
  // 同様に.flatMap()で平坦化してから.map()で変換します
  const initialFavoriteArtists: Tag[] =
    favArtistsData
      ?.flatMap(fav => fav.artists)
      .filter((artist): artist is ArtistFromDB => artist !== null)
      .map(artist => ({
        type: 'artist',
        id: artist.id,
        name: artist.name,
        imageUrl: artist.image_url ?? undefined,
      })) || []
  // ▲▲▲【ここまでが修正点です】▲▲▲

  return (
    <EditProfileForm
      profile={profile as Profile}
      initialFavoriteSongs={initialFavoriteSongs}
      initialFavoriteArtists={initialFavoriteArtists}
    />
  )
}