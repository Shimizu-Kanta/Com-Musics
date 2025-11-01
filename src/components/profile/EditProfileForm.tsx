'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { updateProfile } from '@/app/(main)/[userId]/edit/actions'
import { UserCircleIcon, PhotoIcon, ArrowLeftIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/solid'
import { type Profile } from '@/types'
import TagSearch, { type Tag } from '@/components/post/TagSearch'
import VideoTagModal from '@/components/post/VideoTagModal'
import { getVideoInfo } from '@/components/post/videoActions'
import { DndContext, closestCenter, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
// ▼▼▼【重要】ブラウザからSupabaseを操作するための機能を追加します ▼▼▼
import { createClient } from '@/lib/supabase/client'

type EditProfileFormProps = {
  profile: Profile
  initialFavoriteSongs: Tag[]
  initialFavoriteArtists: Tag[]
  initialFavoriteVideos: Tag[]
}

type PendingVideoData = {
  youtube_video_id: string
  title: string
  thumbnail_url: string
  youtube_category_id: string
}

function SortableItem({ tag, onRemove }: { tag: Tag; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: tag.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="flex justify-between items-center bg-white p-2 rounded-md shadow-sm">
      <div className="flex items-center">
        <button type="button" {...attributes} {...listeners} className="cursor-grab p-1 touch-none">
          <Bars3Icon className="h-5 w-5 text-gray-500" />
        </button>
        {tag.imageUrl && (
          <Image
            src={tag.imageUrl}
            alt={tag.name}
            width={32}
            height={32}
            className="mx-2 h-8 w-8 rounded-md object-cover"
          />
        )}
        <div className="ml-1">
          <p className="text-sm font-medium text-gray-800">{tag.name}</p>
          {(tag.type === 'song' || tag.type === 'video') && tag.artistName && (
            <p className="text-xs text-gray-500">{tag.artistName}</p>
          )}
        </div>
      </div>
      <button type="button" onClick={onRemove} className="p-1 text-red-500 hover:text-red-700">
        <XMarkIcon className="h-5 w-5" />
      </button>
    </div>
  )
}

export default function EditProfileForm({
  profile,
  initialFavoriteSongs,
  initialFavoriteArtists,
  initialFavoriteVideos,
}: EditProfileFormProps) {
  // (state管理の部分は、画像ファイル自体を保持するstateを追加する以外、一切変更ありません)
  const [isPending, startTransition] = useTransition()
  const [nickname, setNickname] = useState(profile.nickname)
  const [bio, setBio] = useState(profile.bio || '')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url)
  const [headerPreview, setHeaderPreview] = useState<string | null>(profile.header_image_url)
  const [favoriteSongs, setFavoriteSongs] = useState<Tag[]>(initialFavoriteSongs)
  const [favoriteArtists, setFavoriteArtists] = useState<Tag[]>(initialFavoriteArtists)
  const [favoriteVideos, setFavoriteVideos] = useState<Tag[]>(initialFavoriteVideos)
  const [isSearching, setIsSearching] = useState(false)
  const [isFetchingVideo, setIsFetchingVideo] = useState(false)
  const [pendingVideoData, setPendingVideoData] = useState<PendingVideoData | null>(null)
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)
  // ▼▼▼【重要】アップロードする画像ファイル自体を保持します ▼▼▼
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [headerFile, setHeaderFile] = useState<File | null>(null)
  const supabase = createClient()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // ▼▼▼【重要】画像選択時に、プレビューとファイルの両方を保存するようにします ▼▼▼
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'header') => {
    const file = e.target.files?.[0]
    if (file) {
      // Vercelの制限である4.5MBを超える場合は警告
      if (file.size > 4.5 * 1024 * 1024) {
        alert('画像サイズは4.5MB以下にしてください。')
        e.target.value = '' // ファイル選択をリセット
        return
      }
      
      const reader = new FileReader()
      reader.onloadend = () => {
        if (type === 'avatar') {
          setAvatarFile(file)
          setAvatarPreview(reader.result as string)
        } else {
          setHeaderFile(file)
          setHeaderPreview(reader.result as string)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleTagSelect = (tag: Tag) => {
    if (tag.type === 'song') {
      if (!favoriteSongs.some(t => t.id === tag.id)) setFavoriteSongs(prev => [...prev, tag])
    } else if (tag.type === 'artist') {
      if (!favoriteArtists.some(t => t.id === tag.id)) setFavoriteArtists(prev => [...prev, tag])
    } else if (tag.type === 'video') {
      if (!favoriteVideos.some(t => t.id === tag.id)) setFavoriteVideos(prev => [...prev, tag])
    }
    setIsSearching(false)
  }
  
  // (ドラッグ&ドロップの処理は一切変更ありません)
  const handleSongDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFavoriteSongs((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }
  
  const handleArtistDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFavoriteArtists((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  const handleVideoDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setFavoriteVideos((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id)
        const newIndex = items.findIndex(item => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleVideoUrlSubmit = async (url: string) => {
    if (!url.trim() || isFetchingVideo) return
    setIsSearching(false)
    setIsFetchingVideo(true)
    try {
      const result = await getVideoInfo(url)
      if (result.error) {
        alert(result.error)
        return
      }
      if (result.data) {
        setPendingVideoData(result.data)
        setIsVideoModalOpen(true)
      } else {
        alert('動画情報の取得に失敗しました。')
      }
    } finally {
      setIsFetchingVideo(false)
    }
  }

  const handleVideoTagSelect = (videoTag: Tag) => {
    if (videoTag.type !== 'video') return
    setFavoriteVideos(prev => {
      if (prev.some(tag => tag.id === videoTag.id)) return prev
      return [...prev, videoTag]
    })
    setIsVideoModalOpen(false)
    setPendingVideoData(null)
  }

  // ▼▼▼【重要】フォーム送信時の処理を、画像を先にアップロードする方式に変更します ▼▼▼
  const clientAction = async (formData: FormData) => {
    startTransition(async () => {
      try {
        let avatarUrl = profile.avatar_url
        let headerUrl = profile.header_image_url

        // もし新しいアバター画像があれば、先にSupabaseへ直接アップロード
        if (avatarFile) {
          const filePath = `${profile.id}/avatar-${Date.now()}`
          const { data, error } = await supabase.storage.from('user_images').upload(filePath, avatarFile)
          if (error) throw new Error('アイコン画像のアップロードに失敗しました。')
          avatarUrl = supabase.storage.from('user_images').getPublicUrl(data.path).data.publicUrl
        }

        // もし新しいヘッダー画像があれば、同様にアップロード
        if (headerFile) {
          const filePath = `${profile.id}/header-${Date.now()}`
          const { data, error } = await supabase.storage.from('user_images').upload(filePath, headerFile)
          if (error) throw new Error('ヘッダー画像のアップロードに失敗しました。')
          headerUrl = supabase.storage.from('user_images').getPublicUrl(data.path).data.publicUrl
        }

        // フォームからファイル自体は削除し、代わりに画像のURLを追加
        formData.delete('avatar')
        formData.delete('header')
        formData.append('avatar_url', avatarUrl || '')
        formData.append('header_image_url', headerUrl || '')
        
        // あなたの既存のロジックをそのまま使います
        formData.append('favoriteSongs', JSON.stringify(favoriteSongs))
        formData.append('favoriteArtists', JSON.stringify(favoriteArtists))
        formData.append('favoriteVideos', JSON.stringify(favoriteVideos))
        
        const result = await updateProfile(formData)
        if (result?.error) {
          alert(result.error)
        }
      } catch (error) {
        if (error instanceof Error) {
          alert(error.message)
        } else {
          alert('プロフィールの更新中に不明なエラーが発生しました。')
        }
      }
    })
  }

  // (return以下のJSXの見た目は一切変更ありません)
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
        <div>
          <label className="block text-sm font-medium">ヘッダー画像</label>
          <div className="mt-1 w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center relative overflow-hidden">{headerPreview ? <Image src={headerPreview} alt="Header preview" layout="fill" objectFit="cover" /> : <PhotoIcon className="w-12 h-12 text-gray-400" />}
            <input type="file" name="header" accept="image/*" onChange={(e) => handleImageChange(e, 'header')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">アイコン</label>
          <div className="mt-1 w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center relative overflow-hidden">
            {avatarPreview ? (
              <Image src={avatarPreview} alt="Avatar preview" layout="fill" objectFit="cover" />
            ) : (
              <UserCircleIcon className="w-16 h-16 text-gray-400" />
            )}
            <input type="file" name="avatar" accept="image/*" onChange={(e) => handleImageChange(e, 'avatar')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
        </div>
        <div>
          <label htmlFor="nickname" className="block text-sm font-medium">ニックネーム</label>
          <input type="text" id="nickname" name="nickname" value={nickname || ''} onChange={(e) => setNickname(e.target.value)} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"/>
        </div>
        <div>
          <label htmlFor="bio" className="block text-sm font-medium">自己紹介</label>
          <textarea id="bio" name="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={300} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"/>
          <p className="text-right text-sm text-gray-500 mt-1">
            {bio.length} / 300
          </p>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <button type="button" onClick={() => setIsSearching(prev => !prev)} className="w-full p-2 text-left text-gray-500 border border-dashed rounded-md hover:border-indigo-500">
              + お気に入りを追加
            </button>
            {isSearching && (
              <TagSearch
                onTagSelect={handleTagSelect}
                onClose={() => setIsSearching(false)}
                onVideoUrlSubmit={handleVideoUrlSubmit}
              />
            )}
          </div>
          <div>
            <h3 className="text-lg font-medium">お気に入りの曲</h3>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSongDragEnd}>
              <SortableContext items={favoriteSongs} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2 mt-2">
                  {favoriteSongs.map(tag => (
                    <SortableItem key={tag.id} tag={tag} onRemove={() => setFavoriteSongs(p => p.filter(t => t.id !== tag.id))} />
                  ))}
                  {favoriteSongs.length === 0 && <p className="text-sm text-gray-500">お気に入りの曲を追加してください。</p>}
                </div>
              </SortableContext>
            </DndContext>
          </div>
          <div>
            <h3 className="text-lg font-medium">お気に入りのアーティスト</h3>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleArtistDragEnd}>
              <SortableContext items={favoriteArtists} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2 mt-2">
                  {favoriteArtists.map(tag => (
                    <SortableItem key={tag.id} tag={tag} onRemove={() => setFavoriteArtists(p => p.filter(t => t.id !== tag.id))} />
                  ))}
                  {favoriteArtists.length === 0 && <p className="text-sm text-gray-500">お気に入りのアーティストを追加してください。</p>}
                </div>
              </SortableContext>
            </DndContext>
          </div>
          <div>
            <h3 className="text-lg font-medium">お気に入りの動画</h3>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleVideoDragEnd}>
              <SortableContext items={favoriteVideos} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2 mt-2">
                  {favoriteVideos.map(tag => (
                    <SortableItem key={tag.id} tag={tag} onRemove={() => setFavoriteVideos(p => p.filter(t => t.id !== tag.id))} />
                  ))}
                  {favoriteVideos.length === 0 && <p className="text-sm text-gray-500">お気に入りの動画を追加してみましょう。</p>}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={isPending} className="px-6 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
            {isPending ? '保存中...' : '保存する'}
          </button>
        </div>
      </form>
      {isVideoModalOpen && pendingVideoData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4">
            <VideoTagModal
              videoData={pendingVideoData}
              onVideoTagSelect={handleVideoTagSelect}
              onClose={() => {
                setIsVideoModalOpen(false)
                setPendingVideoData(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
