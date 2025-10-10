import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EditProfileForm from '@/components/profile/EditProfileForm'
import { type Tag } from '@/components/post/TagSearch'
import { type Profile } from '@/types'
import { type Database } from '@/types/database'

// page.tsxが受け取るPropsの型定義
type EditProfilePageProps = {
  params: Promise<{ userId: string }>
}

// DBから取得するデータの型を定義
type SongFromDB = Database['public']['Tables']['songs']['Row'] & { artists: { id: string, name:string | null } | null }
type ArtistFromDB = Database['public']['Tables']['artists']['Row']

// ▼▼▼【重要】'NextPage'などを使わず、単純な'async function'として定義します ▼▼▼
export default async function EditProfilePage({ params }: EditProfilePageProps) {
  const { userId } = await params
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id_text', userId).single()

  // 自分以外のプロフィール編集ページにはアクセスできないようにする
  if (!profile || !user || user.id !== profile.id) {
    notFound()
  }

  // お気に入り曲を取得
  const { data: favSongsData } = await supabase
    .from('favorite_songs')
    .select('songs(*, artists(id, name))')
    .eq('user_id', profile.id)
    .order('sort_order')
  
  const initialFavoriteSongs: Tag[] = favSongsData
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
  
  // お気に入りアーティストを取得
  const { data: favArtistsData } = await supabase
    .from('favorite_artists')
    .select('artists(*)')
    .eq('user_id', profile.id)
    .order('sort_order')
  
  const initialFavoriteArtists: Tag[] = favArtistsData
    ?.flatMap(fav => fav.artists)
    .filter((artist): artist is ArtistFromDB => artist !== null)
    .map(artist => ({
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