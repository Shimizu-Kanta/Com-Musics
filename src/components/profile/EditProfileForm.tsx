'use client'

import { useState } from 'react'
import type { Database } from '@/types/database'
import TagSearch, { type Tag } from '@/components/post/TagSearch'
import Image from 'next/image'
import { updateProfile } from '@/app/[userId]/edit/actions'
import { useRouter } from 'next/navigation'

type Profile = Database['public']['Tables']['profiles']['Row']

type EditProfileFormProps = {
  profile: Profile
  initialFavoriteSongs: Tag[]
  initialFavoriteArtists: Tag[]
}

function FavoriteTag({ tag, onRemove }: { tag: Tag; onRemove: () => void }) {
  return (
    <div className="flex items-center bg-gray-200 rounded-full pl-1 pr-3 py-1 text-sm font-medium text-gray-800">
      {tag.imageUrl && <Image src={tag.imageUrl} alt={tag.name} width={24} height={24} className="mr-2 rounded-full" />}
      <span>{tag.name}</span>
      <button type="button" onClick={onRemove} className="ml-2 text-gray-500 hover:text-gray-800">&times;</button>
    </div>
  )
}

export default function EditProfileForm({
  profile,
  initialFavoriteSongs,
  initialFavoriteArtists,
}: EditProfileFormProps) {
  const router = useRouter()
  const [nickname, setNickname] = useState(profile.nickname)
  const [bio, setBio] = useState(profile.bio || '')
  
  // useStateの初期値として、親から渡された既存のお気に入りデータをセット
  const [favoriteSongs, setFavoriteSongs] = useState<Tag[]>(initialFavoriteSongs)
  const [favoriteArtists, setFavoriteArtists] = useState<Tag[]>(initialFavoriteArtists)
  
  const [isSearching, setIsSearching] = useState(false)

  const handleTagSelect = (tag: Tag) => {
    if (tag.type === 'song') {
      if (!favoriteSongs.some(t => t.id === tag.id)) {
        setFavoriteSongs(prev => [...prev, tag])
      }
    } else {
      if (!favoriteArtists.some(t => t.id === tag.id)) {
        setFavoriteArtists(prev => [...prev, tag])
      }
    }
  }

  const clientAction = async (formData: FormData) => {
    formData.append('favoriteSongs', JSON.stringify(favoriteSongs))
    formData.append('favoriteArtists', JSON.stringify(favoriteArtists))
    
    const result = await updateProfile(formData)

    if (result?.error) {
      alert(result.error)
    } else {
      alert('プロフィールが更新されました！')
      router.push(`/${profile.user_id_text}`)
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">プロフィールを編集</h1>
      <form action={clientAction} className="space-y-6">
        <input type="hidden" name="user_id_text" value={profile.user_id_text} />
        
        <div>
          <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">ニックネーム</label>
          <input
            type="text"
            id="nickname"
            name="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
          />
        </div>
        
        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-gray-700">自己紹介</label>
          <textarea
            id="bio"
            name="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">お気に入りの曲</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              {favoriteSongs.map(tag => (
                <FavoriteTag key={tag.id} tag={tag} onRemove={() => setFavoriteSongs(p => p.filter(t => t.id !== tag.id))} />
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-medium">お気に入りのアーティスト</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              {favoriteArtists.map(tag => (
                <FavoriteTag key={tag.id} tag={tag} onRemove={() => setFavoriteArtists(p => p.filter(t => t.id !== tag.id))} />
              ))}
            </div>
          </div>
          <div className="relative">
            <button type="button" onClick={() => setIsSearching(prev => !prev)} className="w-full p-2 text-left text-gray-500 border border-dashed rounded-md hover:border-indigo-500">
              + お気に入りを追加
            </button>
            {isSearching && <TagSearch onTagSelect={handleTagSelect} onClose={() => setIsSearching(false)} />}
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="px-6 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
            保存する
          </button>
        </div>
      </form>
    </div>
  )
}