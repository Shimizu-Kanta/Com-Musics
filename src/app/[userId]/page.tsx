import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import UserTimeline from '@/components/post/UserTimeline'
import Link from 'next/link'
import Image from 'next/image'
import { type Database } from '@/types/database'

type Song = Database['public']['Tables']['songs']['Row'] & { artists: { name: string } | null }
type Artist = Database['public']['Tables']['artists']['Row']

type ProfilePageProps = {
  params: {
    userId: string
  }
}

type AttendedLive = {
  lives: {
    id: number;
    name: string;
    live_date: string | null;
    artists: {
      name: string | null;
    } | null;
  } | null;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { userId } = params
  if (!userId) { notFound() }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id_text', userId)
    .single()
  
  if (error || !profile) { notFound() }
  const isMyProfile = currentUser && currentUser.id === profile.id

  // お気に入りの曲を取得
  const { data: favoriteSongsData } = await supabase
    .from('favorite_songs')
    .select('songs(*, artists(name))')
    .eq('user_id', profile.id)

  // .mapを.flatMapに変更して、リストの入れ子を解消します
  const songs: Song[] = favoriteSongsData?.flatMap(fav => fav.songs).filter((s): s is Song => s !== null) || []

  // お気に入りのアーティストを取得
  const { data: favoriteArtistsData } = await supabase
    .from('favorite_artists')
    .select('artists(*)')
    .eq('user_id', profile.id)

    // ユーザーが参戦したライブの情報を取得
  const { data: attendedLivesData } = await supabase
    .from('attended_lives')
    .select('lives(*, artists(name))') // attended_livesから、関連するlivesとartistsの情報を取得
    .eq('user_id', profile.id)
    .order('live_date', { referencedTable: 'lives', ascending: false, nullsFirst: false })
  
  const attendedLives = attendedLivesData as AttendedLive[] | null

  // .mapを.flatMapに変更して、リストの入れ子を解消します
  const artists: Artist[] = favoriteArtistsData?.flatMap(fav => fav.artists).filter((a): a is Artist => a !== null) || []

  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-gray-50">
      <header className="w-full max-w-lg p-8 bg-white border-b border-gray-200">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">{profile.nickname}</h1>
            <p className="text-md text-gray-600 mt-1">@{profile.user_id_text}</p>
          </div>
          {isMyProfile && (
            <Link href={`/${profile.user_id_text}/edit`} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
              編集する
            </Link>
          )}
        </div>
        <p className="mt-4 text-gray-800">{profile.bio || '自己紹介がありません。'}</p>
        
        {artists.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-bold text-gray-600 mb-2">Favorite Artists</h3>
            <div className="flex flex-wrap gap-2">
              {artists.map((artist) => (
                <div key={artist.id} className="flex items-center bg-gray-100 rounded-full p-1 pr-3">
                  {artist.image_url && <Image src={artist.image_url} alt={artist.name} width={24} height={24} className="rounded-full mr-2"/>}
                  <span className="text-sm font-medium">{artist.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {songs.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-bold text-gray-600 mb-2">Favorite Songs</h3>
            <div className="flex flex-wrap gap-2">
              {songs.map((song) => (
                <div key={song.id} className="flex items-center bg-gray-100 rounded-lg p-1 pr-3">
                  {song.album_art_url && <Image src={song.album_art_url} alt={song.name} width={40} height={40} className="rounded-md mr-2"/>}
                  <div>
                    <p className="text-sm font-bold">{song.name}</p>
                    <p className="text-xs text-gray-500">{song.artists?.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="w-full flex-1">
        {/* 参戦したライブ一覧 */}
        <div className="py-8">
          <h2 className="text-xl font-bold px-4 mb-4">参戦したライブ</h2>
          <div className="space-y-2">
            {attendedLives && attendedLives.length > 0 ? (
              attendedLives.map(item => item.lives && (
                <div key={item.lives.id} className="p-4 hover:bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-500">{item.lives.live_date}</p>
                  <h3 className="font-bold text-gray-800">{item.lives.name}</h3>
                  <p className="text-sm text-gray-600">{item.lives.artists?.name}</p>
                </div>
              ))
            ) : (
              <p className="px-4 text-sm text-gray-500">まだ参戦したライブはありません。</p>
            )}
          </div>
        </div>

        <div className="w-full max-w-lg mx-auto mt-8">
          <h2 className="text-xl font-bold px-4 mb-4">投稿一覧</h2>
          <Suspense fallback={<p className="p-4">読み込み中...</p>}>
            <UserTimeline userId={profile.id} />
          </Suspense>
        </div>
      </main>
    </div>
  )
}