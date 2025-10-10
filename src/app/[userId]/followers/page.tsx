import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import UserCard from '@/components/profile/UserCard'
import Link from 'next/link'
import { type Profile } from '@/types'

type FollowersPageProps = {
  params: {
    userId: string
  }
}

export default async function FollowersPage({ params }: FollowersPageProps) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nickname, user_id_text')
    .eq('user_id_text', params.userId)
    .single()

  if (!profile) notFound()

  // その人をフォローしているユーザーのリストを取得
  const { data: followerList } = await supabase
    .from('followers')
    .select('profiles!follower_id(*)')
    .eq('following_id', profile.id)

  // ▼▼▼ ここからが修正点 ▼▼▼
  // .flatMap()を使って、ネストされた配列を平坦なリストに変換する
  const profiles =
    followerList
      ?.flatMap((item) => item.profiles)
      .filter((p): p is Profile => p !== null) || []
  // ▲▲▲ ここまで ▲▲▲

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
        <Link href={`/${profile.user_id_text}/following`} className="inline-block p-4 text-sm font-medium text-gray-500 hover:text-black">
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