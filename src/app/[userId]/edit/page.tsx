import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import EditProfileForm from '@/components/profile/EditProfileForm'
import { type Tag } from '@/components/post/TagSearch'
import { type Database } from '@/types/database' // 型をインポート

// Supabaseのテーブルの型を定義
type SongFromDB = Database['public']['Tables']['songs']['Row'] & { artists: { name: string } | null }
type ArtistFromDB = Database['public']['Tables']['artists']['Row']

export default async function EditProfilePage({ params }: { params: { userId: string } }) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user: currentUser } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id_text', params.userId)
    .single()

  if (!profile) { notFound() }
  if (!currentUser || currentUser.id !== profile.id) { redirect('/') }

  // 既存のお気に入りの曲を取得
  const { data: favSongsData } = await supabase
    .from('favorite_songs')
    .select('songs(*, artists(name))')
    .eq('user_id', profile.id)

  // ★★★★★ ここからが修正点 ★★★★★
  // .flatMap()で「リストのリスト」を平坦化し、その後.map()で「Tag」の形に変換する
  const initialFavoriteSongs: Tag[] =
    favSongsData
      ?.flatMap(fav => fav.songs)
      .filter((song): song is SongFromDB => song !== null)
      .map(song => ({
        type: 'song',
        id: song.id,
        name: song.name,
        artistName: song.artists?.name,
        artistId: song.artist_id,
        imageUrl: song.album_art_url ?? undefined,
      })) || []

  // 既存のお気に入りのアーティストを取得
  const { data: favArtistsData } = await supabase
    .from('favorite_artists')
    .select('artists(*)')
    .eq('user_id', profile.id)
  
  // 同様に.flatMap()で平坦化してから.map()で変換する
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
  // ★★★★★ ここまでが修正点 ★★★★★

  return (
    <EditProfileForm
      profile={profile}
      initialFavoriteSongs={initialFavoriteSongs}
      initialFavoriteArtists={initialFavoriteArtists}
    />
  )
}