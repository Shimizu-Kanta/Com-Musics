import Link from 'next/link'
import Image from 'next/image'
import { type Profile } from '@/types' // types.tsからProfile型をインポート

export default function UserCard({ profile }: { profile: Profile }) {
  return (
    <Link href={`/${profile.user_id_text}`} className="block hover:bg-gray-50">
      <div className="flex items-center p-4">
        <Image
          src={profile.avatar_url || '/default-avatar.png'}
          alt={profile.nickname || 'User avatar'}
          width={48}
          height={48}
          className="rounded-full mr-4"
        />
        <div>
          <h3 className="font-bold text-gray-900">{profile.nickname}</h3>
          <p className="text-sm text-gray-500">@{profile.user_id_text}</p>
        </div>
      </div>
    </Link>
  )
}