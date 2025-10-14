import Link from 'next/link'
import Image from 'next/image'
import { type Profile } from '@/types' // types.tsからProfile型をインポート
import { UserCircleIcon } from '@heroicons/react/24/solid'

export default function UserCard({ profile }: { profile: Profile }) {
  return (
    <Link href={`/${profile.user_id_text}`} className="block hover:bg-gray-50">
      <div className="flex items-center p-4 overflow-hidden">
        <div className="relative mr-3 h-10 w-10 overflow-hidden rounded-full bg-gray-200 flex-shrink-0">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.nickname || 'avatar'}
              fill
              className="object-cover"
              sizes="40px"
            />
          ) : (
            <UserCircleIcon className="h-full w-full text-gray-400" />
          )}
        </div>
        <div>
          <h3 className="font-bold text-gray-900">{profile.nickname}</h3>
          <p className="text-sm text-gray-500">@{profile.user_id_text}</p>
        </div>
      </div>
    </Link>
  )
}