// src/app/[userId]/followers/page.tsx
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import UserCard from '@/components/profile/UserCard'
import Link from 'next/link'
import { type Profile } from '@/types'

type PageParams = { userId: string }

/**
 * followers テーブルの follower_id → profiles への結合行の型
 * Supabase の select('profiles!follower_id(*)') で profiles は単一の Profile を返す想定
 */
type FollowerJoinRow = {
  profiles: Profile | null
}

export default async function FollowersPage({
  params,
}: {
  // Next.js 15: params は Promise で渡る
  params: Promise<PageParams>
}) {
  const { userId } = await params

  const supabase = createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nickname, user_id_text')
    .eq('user_id_text', userId)
    .single()

  if (!profile) notFound()

  // その人をフォローしているユーザーのリストを取得
  const { data: followerList } = await supabase
    .from('followers')
    .select('profiles!follower_id(*)')
    .eq('following_id', profile.id)

  // any を使わず、明示的な型で profiles を抽出
  const profiles: Profile[] =
    (followerList as FollowerJoinRow[] | null)?.map((row) => row.profiles).filter((p): p is Profile => p !== null) ??
    []

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold">{profile.nickname}</h1>
        <p className="text-sm text-gray-500">@{profile.user_id_text}</p>
      </div>

      <div className="border-b">
        <div className="inline-block p-4 text-sm font-medium text-black border-b-2 border-black">
          フォロワー
        </div>
        <Link
          href={`/${profile.user_id_text}/following`}
          className="inline-block p-4 text-sm font-medium text-gray-500 hover:text-black"
        >
          フォロー中
        </Link>
      </div>

      <div>
        {profiles.length > 0 ? (
          profiles.map((p) => <UserCard key={p.id} profile={p} />)
        ) : (
          <p className="p-4 text-sm text-gray-500">まだフォロワーがいません。</p>
        )}
      </div>
    </div>
  )
}
