'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { updateProfile } from '@/app/[userId]/edit/actions'
import { UserCircleIcon, PhotoIcon, ArrowLeftIcon } from '@heroicons/react/24/solid'
import { type Profile } from '@/types'
import TagSearch, { type Tag } from '@/components/post/TagSearch'

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
  const [isPending, startTransition] = useTransition()
  // ▼▼▼ フォームの値を管理するState ▼▼▼
  const [nickname, setNickname] = useState(profile.nickname)
  const [bio, setBio] = useState(profile.bio || '')
  // ▲▲▲
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url)
  const [headerPreview, setHeaderPreview] = useState<string | null>(profile.header_image_url)
  const [favoriteSongs, setFavoriteSongs] = useState<Tag[]>(initialFavoriteSongs)
  const [favoriteArtists, setFavoriteArtists] = useState<Tag[]>(initialFavoriteArtists)
  const [isSearching, setIsSearching] = useState(false)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'header') => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (type === 'avatar') setAvatarPreview(reader.result as string)
        else setHeaderPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleTagSelect = (tag: Tag) => {
    if (tag.type === 'song') {
      if (!favoriteSongs.some(t => t.id === tag.id)) setFavoriteSongs(prev => [...prev, tag])
    } else if (tag.type === 'artist') {
      if (!favoriteArtists.some(t => t.id === tag.id)) setFavoriteArtists(prev => [...prev, tag])
    }
    setIsSearching(false)
  }

  const clientAction = async (formData: FormData) => {
    startTransition(async () => {
      formData.append('favoriteSongs', JSON.stringify(favoriteSongs))
      formData.append('favoriteArtists', JSON.stringify(favoriteArtists))
      const result = await updateProfile(formData)
      if (result?.error) {
        alert(result.error)
      }
    })
  }

  return (
    <div className="w-full max-w-lg mx-auto p-4 md:p-8">
      <div className="relative flex items-center justify-center mb-6">
        <Link href={`/${profile.user_id_text}`} className="absolute left-0 p-2 rounded-full hover:bg-gray-100">
          <ArrowLeftIcon className="h-6 w-6 text-gray-700" />
        </Link>
        <h1 className="text-xl md:text-2xl font-bold">プロフィールを編集</h1>
      </div>

      <form action={clientAction} className="space-y-6">
        <input type="hidden" name="user_id_text" value={profile.user_id_text} />
        {/* ヘッダー画像 */}
        <div>
          <label className="block text-sm font-medium">ヘッダー画像</label>
          <div className="mt-1 w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center relative overflow-hidden">
            {headerPreview ? <Image src={headerPreview} alt="Header preview" layout="fill" objectFit="cover" /> : <PhotoIcon className="w-12 h-12 text-gray-400" />}
            <input type="file" name="header" accept="image/*" onChange={(e) => handleImageChange(e, 'header')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
          </div>
        </div>
        {/* アイコン */}
        <div>
          <label className="block text-sm font-medium">アイコン</label>
          <div className="mt-1 w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center relative overflow-hidden">
            {avatarPreview ? <Image src={avatarPreview} alt="Avatar preview" layout="fill" objectFit="cover" /> : <UserCircleIcon className="w-16 h-16 text-gray-400" />}
            <input type="file" name="avatar" accept="image/*" onChange={(e) => handleImageChange(e, 'avatar')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
          </div>
        </div>
        
        {/* ▼▼▼ ここからが今回の修正点です ▼▼▼ */}
        {/* ニックネーム */}
        <div>
          <label htmlFor="nickname" className="block text-sm font-medium">ニックネーム</label>
          {/* 'defaultValue' を 'value' に変更し、Stateと連動させます */}
          <input type="text" id="nickname" name="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"/>
        </div>
        {/* 自己紹介 */}
        <div>
          <label htmlFor="bio" className="block text-sm font-medium">自己紹介</label>
          {/* 'defaultValue' を 'value' に変更し、Stateと連動させます */}
          <textarea id="bio" name="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"/>
        </div>
        {/* ▲▲▲ ここまで ▲▲▲ */}

        {/* お気に入り編集UI */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">お気に入りの曲</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              {favoriteSongs.map(tag => ( <FavoriteTag key={tag.id} tag={tag} onRemove={() => setFavoriteSongs(p => p.filter(t => t.id !== tag.id))} /> ))}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-medium">お気に入りのアーティスト</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              {favoriteArtists.map(tag => ( <FavoriteTag key={tag.id} tag={tag} onRemove={() => setFavoriteArtists(p => p.filter(t => t.id !== tag.id))} /> ))}
            </div>
          </div>
          <div className="relative">
            <button type="button" onClick={() => setIsSearching(prev => !prev)} className="w-full p-2 text-left text-gray-500 border border-dashed rounded-md hover:border-indigo-500">
              + お気に入りを追加
            </button>
            {isSearching && <TagSearch onTagSelect={handleTagSelect} onClose={() => setIsSearching(false)} />}
          </div>
        </div>

        {/* 保存ボタン */}
        <div className="flex justify-end">
          <button type="submit" disabled={isPending} className="px-6 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
            {isPending ? '保存中...' : '保存する'}
          </button>
        </div>
      </form>
    </div>
  )
}