import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import UserTimeline from '@/components/post/UserTimeline'
import Link from 'next/link'
import Image from 'next/image'
import FollowButton from '@/components/profile/FollowButton'
import { type Database } from '@/types/database'
import { UserCircleIcon } from '@heroicons/react/24/solid'

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

  const supabase = createClient()
  
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id_text', userId)
    .single()
  
  if (error || !profile) { notFound() }
  const isMyProfile = currentUser && currentUser.id === profile.id

  // フォロー数を取得
  const { count: followingCount } = await supabase
    .from('followers')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', profile.id)

  // フォロワー数を取得
  const { count: followersCount } = await supabase
    .from('followers')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', profile.id)

  let isFollowing = false
  if (currentUser) {
    const { data: follow } = await supabase
      .from('followers')
      .select('follower_id')
      .eq('follower_id', currentUser.id)
      .eq('following_id', profile.id)
      .single()
    isFollowing = !!follow // followデータがあればtrue、なければfalse
  }

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
      <div className="w-full max-w-lg bg-white border-b border-gray-200">
        {/* --- ヘッダー画像 --- */}
        <div className="relative h-48 bg-gray-200">
          {profile.header_image_url ? (
            <Image
              src={profile.header_image_url}
              alt="ヘッダー画像"
              layout="fill"
              objectFit="cover"
              priority // ページの主要な画像として優先的に読み込みます
            />
          ) : (
            // ヘッダー画像がない場合はグレーの背景を表示
            <div className="w-full h-full bg-gray-300"></div>
          )}
        </div>

        {/* --- プロフィール情報全体 --- */}
        <div className="p-4 pt-0">
          {/* --- アイコンと編集ボタン --- */}
          <div className="relative flex justify-between items-end -mt-12">
            <div className="relative h-24 w-24 rounded-full border-4 border-white bg-gray-200">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt="プロフィール画像"
                  layout="fill"
                  objectFit="cover"
                  className="rounded-full"
                />
              ) : (
                // アイコンがない場合は、人型のアイコンを表示
                <UserCircleIcon className="h-full w-full text-gray-400" />
              )}
            </div>
            <div>
              {isMyProfile ? (
                <Link href={`/${profile.user_id_text}/edit`} className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-full hover:bg-gray-50">
                  プロフィールを編集
                </Link>
              ) : (
                <FollowButton targetUserId={profile.id} isFollowing={isFollowing} />
              )}
            </div>
          </div>

          {/* --- ユーザー名とID --- */}
          <div className="mt-4">
            <h1 className="text-2xl font-bold">{profile.nickname}</h1>
            <p className="text-md text-gray-500">@{profile.user_id_text}</p>
          </div>
          
          {/* --- 自己紹介 --- */}
          <p className="mt-2 text-gray-800">{profile.bio || '自己紹介がありません。'}</p>

          {/* --- フォロー/フォロワー数 --- */}
          <div className="mt-4 flex space-x-4">
            <Link href={`/${profile.user_id_text}/following`} className="hover:underline">
              <div className="text-sm">
                <span className="font-bold">{followingCount ?? 0}</span>
                <span className="text-gray-500 ml-1">フォロー中</span>
              </div>
            </Link>
            <Link href={`/${profile.user_id_text}/followers`} className="hover:underline">
              <div className="text-sm">
                <span className="font-bold">{followersCount ?? 0}</span>
                <span className="text-gray-500 ml-1">フォロワー</span>
              </div>
            </Link>
          </div>

          {/* --- お気に入りアーティスト・曲 --- */}
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
        </div>
      </div>
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