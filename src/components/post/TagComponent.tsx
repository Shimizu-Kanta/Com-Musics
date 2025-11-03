// src/components/post/TagComponent.tsx
import type { TagWithRelations } from '@/types'
import { getPrimaryArtistFromRelation } from '@/lib/relations'
import Image from 'next/image'
import { MusicalNoteIcon, UserCircleIcon, TicketIcon, PlayCircleIcon } from '@heroicons/react/24/solid'

type TagComponentProps = {
  tag: TagWithRelations
  onTagClick: (tag: TagWithRelations) => void
}

export default function TagComponent({ tag, onTagClick }: TagComponentProps) {
  // 楽曲タグ
  if (tag.songs_v2) {
    const song = tag.songs_v2
    const primaryArtist = getPrimaryArtistFromRelation(song.song_artists)
    return (
      <button
        onClick={() => onTagClick(tag)}
        className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-1 rounded-full flex items-center hover:bg-blue-200 pr-3"
      >
        {song.image_url ? (
          <Image
            src={song.image_url}
            alt={song.title}
            width={24}
            height={24}
            className="rounded-full w-5 h-5 mr-1.5 object-cover"
          />
        ) : (
          <MusicalNoteIcon className="w-4 h-4 mr-1.5" />
        )}
        <span>
          {song.title} - {primaryArtist?.name || 'Unknown Artist'}
        </span>
      </button>
    )
  }

  // アーティストタグ
  if (tag.artists_v2) {
    const artist = tag.artists_v2
    return (
      <button
        onClick={() => onTagClick(tag)}
        className="bg-purple-100 text-purple-800 text-sm font-medium px-2.5 py-1 rounded-full flex items-center hover:bg-purple-200 pr-3"
      >
        {artist.image_url ? (
          <Image
            src={artist.image_url}
            alt={artist.name}
            width={24}
            height={24}
            className="rounded-full w-5 h-5 mr-1.5 object-cover"
          />
        ) : (
          <UserCircleIcon className="w-4 h-4 mr-1.5" />
        )}
        <span>{artist.name}</span>
      </button>
    )
  }

  // ライブタグ
  if (tag.lives_v2) {
    const live = tag.lives_v2
    const liveArtist = getPrimaryArtistFromRelation(live.live_artists)
    return (
      <div className="bg-green-100 text-green-800 text-sm font-medium px-2.5 py-1 rounded-full flex items-center">
        <TicketIcon className="w-4 h-4 mr-1.5" />
        <div>
          <span className="font-bold">{live.name}</span>
          <div className="text-xs text-green-700">
            {liveArtist?.name || 'アーティスト未登録'} / {live.venue} / {live.live_date}
          </div>
        </div>
      </div>
    )
  }

  // ▼▼▼ 動画タグ（YouTubeリンク対応版） ▼▼▼
  if (tag.videos) {
    const video = tag.videos

    const videoTitle = video.title ?? '動画'
    const artistName = video.artists_v2?.name ?? null

    // YouTube URLを生成
    const youtubeUrl = video.youtube_video_id
      ? `https://www.youtube.com/watch?v=${video.youtube_video_id}`
      : null

    return (
      <a
        href={youtubeUrl ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        className={`bg-red-100 text-red-800 text-sm font-medium px-2.5 py-1 rounded-full flex items-center pr-3 ${
          youtubeUrl ? 'hover:bg-red-200 cursor-pointer' : 'opacity-60 cursor-not-allowed'
        }`}
        onClick={(e) => {
          if (!youtubeUrl) {
            e.preventDefault()
            alert('動画のリンクが見つかりません')
          }
        }}
        title={videoTitle}
      >
        {video.thumbnail_url ? (
          <Image
            src={video.thumbnail_url}
            alt={videoTitle}
            width={24}
            height={24}
            className="rounded w-5 h-5 mr-1.5 object-cover"
          />
        ) : (
          <PlayCircleIcon className="w-4 h-4 mr-1.5" />
        )}
        <span className="max-w-[14rem] truncate">
          {videoTitle}
          {artistName && <span className="text-xs ml-1">- {artistName}</span>}
        </span>
      </a>
    )
  }

  return null
}