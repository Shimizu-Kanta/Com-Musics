import type { TagWithRelations } from '@/types'
import Image from 'next/image' // Imageコンポーネントをインポート
import { MusicalNoteIcon, UserCircleIcon, TicketIcon } from '@heroicons/react/24/solid'

type LiveWithArtist = TagWithRelations['lives'] & {
  artists: { name: string | null } | null
}

type TagComponentProps = {
  tag: TagWithRelations
  onTagClick: (tag: TagWithRelations) => void
}

export default function TagComponent({ tag, onTagClick }: TagComponentProps) {
  // 楽曲タグ
  if (tag.songs) {
    return (
      <button 
        onClick={() => onTagClick(tag)} 
        className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-1 rounded-full flex items-center hover:bg-blue-200 group relative pr-3" // 右側の余白を増やし、画像を内包する準備
      >
        {/* ▼▼▼【重要】楽曲タグにジャケ写を表示するロジックを追加します ▼▼▼ */}
        {tag.songs.album_art_url ? (
          // 画像がある場合はImageコンポーネントで表示
          <Image 
            src={tag.songs.album_art_url} 
            alt={tag.songs.name} 
            width={24} 
            height={24} 
            className="rounded-full w-5 h-5 mr-1.5 object-cover" 
          />
        ) : (
          // 画像がない場合はデフォルトのアイコン
          <MusicalNoteIcon className="w-4 h-4 mr-1.5" />
        )}
        <span>{tag.songs.name} - {tag.songs.artists?.name || 'Unknown Artist'}</span>
      </button>
    )
  }

  // アーティストタグ
  if (tag.artists) {
    return (
      <button 
        onClick={() => onTagClick(tag)} 
        className="bg-purple-100 text-purple-800 text-sm font-medium px-2.5 py-1 rounded-full flex items-center hover:bg-purple-200 group relative pr-3" // 右側の余白を増やし、画像を内包する準備
      >
        {/* ▼▼▼【重要】アーティストタグにアーティスト画像を表示するロジックを追加します ▼▼▼ */}
        {tag.artists.image_url ? (
          // 画像がある場合はImageコンポーネントで表示
          <Image 
            src={tag.artists.image_url} 
            alt={tag.artists.name} 
            width={24} 
            height={24} 
            className="rounded-full w-5 h-5 mr-1.5 object-cover" 
          />
        ) : (
          // 画像がない場合はデフォルトのアイコン
          <UserCircleIcon className="w-4 h-4 mr-1.5" />
        )}
        <span>{tag.artists.name}</span>
      </button>
    )
  }

  // ライブタグ (変更なし)
  if (tag.lives) {
    const live = tag.lives as LiveWithArtist;
    return (
      <div className="bg-green-100 text-green-800 text-sm font-medium px-2.5 py-1 rounded-full flex items-center">
        <TicketIcon className="w-4 h-4 mr-1.5" />
        <div>
          <span className="font-bold">{live.name}</span>
          <div className="text-xs text-green-700">
            {live.artists?.name || 'アーティスト未登録'} / {live.venue} / {live.live_date}
          </div>
        </div>
      </div>
    )
  }

  return null
}