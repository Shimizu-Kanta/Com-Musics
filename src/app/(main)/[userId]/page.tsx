import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import FollowButton from '@/components/profile/FollowButton'
import { type Database } from '@/types/database'
import { UserCircleIcon } from '@heroicons/react/24/solid'
import InteractiveTag from '@/components/shared/InteractiveTag'
import { type Tag } from '@/components/post/TagSearch'
import Image from 'next/image'
// ▼▼▼【重要】ここからが今回の主な修正点です ▼▼▼
import PostList from '@/components/post/PostList'       // 共通部品をインポート
import { type PostWithRelations } from '@/types'     // 型定義をインポート

const POSTS_PER_PAGE = 20;
// ▲▲▲

type PageParams = { userId: string }

// (DB 派生型定義は変更ありません)
type Song = Database['public']['Tables']['songs']['Row'] & {
  artists: { name: string; id: string } | null
}
type Artist = Database['public']['Tables']['artists']['Row']
type Live = { id: number; name: string; live_date: string | null; artists: { name: string | null } | null }
type AttendedLivesJoinRow = | { lives: Live | null } | { lives: Live[] | null }
type FavoriteSongRow = { songs: Song | null }
type FavoriteArtistRow = { artists: Artist | null }

export const dynamic = 'force-dynamic'

export default async function ProfilePage({ params }: { params: PageParams }) {
  const supabase = createClient()
  const { data: { user: loggedInUser } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id_text', params.userId)
    .single()

  if (!profile) {
    notFound()
  }

  let isFollowing = false
  if (loggedInUser && loggedInUser.id !== profile.id) {
    const { data: followingRecord } = await supabase
      .from('followers')
      .select('id')
      .eq('follower_id', loggedInUser.id)
      .eq('following_id', profile.id)
      .single()
    isFollowing = !!followingRecord
  }
  
  // (お気に入りや参戦ライブのデータ取得ロジックは一切変更ありません)
  const { data: attendedLivesData } = await supabase.from('attended_lives').select('lives(*, artists(name))').eq('user_id', profile.id)
  const attendedLives = (attendedLivesData as AttendedLivesJoinRow[] | null)?.map(row => row.lives).flat().filter((live): live is Live => !!live) ?? []
  const { data: favSongsData } = await supabase.from('favorite_songs').select('songs(*, artists(id, name))').eq('user_id', profile.id).order('sort_order')
  const favoriteSongTags: Tag[] = (favSongsData as FavoriteSongRow[] | null)?.map(row => { const song = row.songs; return { id: song?.id || '', name: song?.name || '', type: 'song' as const, artistId: song?.artists?.id, artistName: song?.artists?.name, } }).filter(tag => tag.id) ?? []
  const { data: favArtistsData } = await supabase.from('favorite_artists').select('artists(*)') .eq('user_id', profile.id) .order('sort_order')
  const favoriteArtistTags: Tag[] = (favArtistsData as FavoriteArtistRow[] | null)?.map(row => { const artist = row.artists; return { id: artist?.id || '', name: artist?.name || '', type: 'artist' as const, imageUrl: artist?.image_url ?? undefined, } }).filter(tag => tag.id) ?? []

  // ▼▼▼【重要】このユーザーの最初の投稿20件だけを取得します ▼▼▼
  const { data: initialPostsData } = await supabase
    .from('posts')
    .select('*, profiles!inner(*), likes(user_id), tags(*, songs(*, artists(*)), artists(*), lives(*, artists(*)))')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .range(0, POSTS_PER_PAGE - 1)
  
  const initialPosts: PostWithRelations[] = (initialPostsData ?? []).map((post) => ({
    ...post,
    is_liked_by_user:
      !!loggedInUser && Array.isArray(post.likes)
        ? post.likes.some((like: { user_id: string }) => like.user_id === loggedInUser.id)
        : false,
  }))

  return (
    <div className="w-full">
      {/* (プロフィールヘッダーなどの表示部分は一切変更ありません) */}
      <div className="relative h-48 w-full bg-gray-200">{profile.header_image_url && (<Image src={profile.header_image_url} alt="Header" fill className="object-cover" priority />)}</div>
      <div className="mx-auto w-full max-w-lg -translate-y-16 px-4">
        <div className="flex items-end justify-between">
          <div className="relative h-32 w-32 flex-shrink-0 rounded-full border-4 border-white bg-white">{profile.avatar_url ? (<Image src={profile.avatar_url} alt={profile.nickname} fill className="rounded-full object-cover" priority />) : (<UserCircleIcon className="text-gray-400" />)}</div>
          <div className="pb-2">{loggedInUser?.id === profile.id ? (<Link href={`/${profile.user_id_text}/edit`} className="rounded-full border px-4 py-2 text-sm font-bold">プロフィールを編集</Link>) : (<FollowButton targetUserId={profile.id} isFollowing={isFollowing} />)}</div>
        </div>
        <div className="mt-2"><h1 className="text-2xl font-bold">{profile.nickname}</h1><p className="text-sm text-gray-500">@{profile.user_id_text}</p></div>
        <div className="mt-4 whitespace-pre-wrap text-sm">{profile.bio}</div>
        <div className="mt-8 space-y-8">{favoriteArtistTags.length > 0 && (<div><h3 className="mb-2 text-sm font-bold text-gray-600">Favorite Artists</h3><div className="flex flex-wrap gap-2">{favoriteArtistTags.map((tag) => (<InteractiveTag key={tag.id} tag={tag} />))}</div></div>)}{favoriteSongTags.length > 0 && (<div><h3 className="mb-2 text-sm font-bold text-gray-600">Favorite Songs</h3><div className="flex flex-wrap gap-2">{favoriteSongTags.map((tag) => (<InteractiveTag key={tag.id} tag={tag} />))}</div></div>)}</div>
      </div>
      <div className="mx-auto w-full max-w-lg">
        <div className="py-8"><h2 className="mb-4 px-4 text-xl font-bold">参戦したライブ</h2><div className="space-y-2">{attendedLives.length > 0 ? (attendedLives.map((live) => (<div key={live.id} className="rounded-md p-4 hover:bg-gray-50"><p className="text-sm text-gray-500">{live.live_date}</p><h3 className="font-bold text-gray-800">{live.name}</h3><p className="text-sm text-gray-600">{live.artists?.name}</p></div>))) : (<p className="px-4 text-sm text-gray-500">まだ参戦したライブはありません。</p>)}</div></div>

        {/* ▼▼▼【重要】投稿一覧の表示を、新しいPostList部品に置き換えます ▼▼▼ */}
        <div className="w-full border-t border-gray-200 pt-4">
          <h2 className="mb-4 px-4 text-xl font-bold">投稿</h2>
          <PostList 
            initialPosts={initialPosts} 
            userId={loggedInUser?.id}
            profileUserId={profile.id} // 表示しているプロフィールIDを渡す
          />
        </div>
        {/* ▲▲▲ */}
      </div>
    </div>
  )
}