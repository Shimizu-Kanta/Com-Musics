'use client' // モーダルの表示・非表示を管理するため、クライアントコンポーネントにします

import { useState } from 'react' // useStateをインポート
import type { PostWithRelations, TagWithRelations } from '@/types'
import LikeButton from './LikeButton'
import Image from 'next/image'
import Link from 'next/link'
import { TicketIcon, UserCircleIcon, XMarkIcon } from '@heroicons/react/24/solid' // XMarkIconを追加

// ▼▼▼【ここからが今回の追加機能の本体です】▼▼▼
// 各サブスクサイトへのリンクを表示するモーダルコンポーネント
function MusicLinkModal({ tag, onClose }: { tag: TagWithRelations; onClose: () => void }) {
  let searchTerm = '';
  let subText = '';

  // タグの種類（曲かアーティストか）によって、検索キーワードを組み立てます
  if (tag.songs) {
    const song = tag.songs;
    searchTerm = `${song.name || ''} ${song.artists?.name || ''}`;
    subText = `${song.name} (${song.artists?.name || 'Unknown Artist'})`;
  } else if (tag.artists) {
    searchTerm = tag.artists.name || '';
    subText = tag.artists.name || '';
  }

  // URLで安全に使えるように、検索キーワードをエンコード（変換）します
  const encodedSearchTerm = encodeURIComponent(searchTerm.trim());

  const links = [
    // ご提示の例に基づき、各サイトの検索URLを生成します
    { name: 'Spotify', url: `https://open.spotify.com/search/${encodedSearchTerm}` },
    { name: 'Apple Music', url: `https://music.apple.com/jp/search?term=${encodedSearchTerm}` },
    { name: 'YouTube Music', url: `https://music.youtube.com/search?q=${encodedSearchTerm.replace(/%20/g, '+')}` },
  ];

  return (
    // モーダルの背景（オーバーレイ）
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose} // 背景をクリックしても閉じられるようにします
    >
      {/* モーダルの本体 */}
      <div 
        className="relative w-11/12 max-w-sm p-6 bg-white rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()} // モーダル内のクリックは背景に伝播しないようにします
      >
        <button onClick={onClose} className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100">
          <XMarkIcon className="w-6 h-6 text-gray-600" />
        </button>
        <p className="text-sm text-gray-600 mb-1">外部リンク</p>
        <p className="font-bold text-lg mb-4 truncate">{subText}</p>
        <div className="flex flex-col space-y-3">
          {links.map(link => (
            <a
              key={link.name}
              href={link.url}
              target="_blank" // リンクを新しいタブで開きます
              rel="noopener noreferrer"
              className="w-full px-4 py-3 text-center font-semibold text-gray-800 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {link.name} で検索
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// タグバッジのコンポーネント
function TagBadge({ tag }: { tag: TagWithRelations }) {
  // モーダルの表示状態を管理するためのState
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 曲、アーティスト、ライブの表示部分は変更ありません
  const renderContent = () => {
    if (tag.songs) {
      const song = tag.songs;
      return (
        <div className="flex items-center">
          {song.album_art_url && <Image src={song.album_art_url} alt={song.name || ''} width={24} height={24} className="mr-2 rounded-full"/>}
          <div>
            <span className="font-bold">{song.name}</span>
            <span className="text-gray-500 ml-2">({song.artists?.name || 'Unknown Artist'})</span>
          </div>
        </div>
      );
    } else if (tag.artists) {
      const artist = tag.artists;
      return (
        <div className="flex items-center">
          {artist.image_url && <Image src={artist.image_url} alt={artist.name || ''} width={24} height={24} className="mr-2 rounded-full"/>}
          <div>
            <span className="font-bold">{artist.name}</span>
            <span className="text-gray-500 ml-2">(アーティスト)</span>
          </div>
        </div>
      );
    } else if (tag.lives) {
      const live = tag.lives;
      return (
        <div className="flex items-center">
          <TicketIcon className="w-5 h-5 mr-2 text-gray-500"/>
          <div>
            <span className="font-bold">{live.name}</span>
            <span className="text-gray-500 ml-2">(ライブ)</span>
          </div>
        </div>
      );
    }
    return null;
  };
  
  // ライブのタグはリンク機能が不要なため、モーダルを開かないようにします
  if (tag.lives) {
    return <div className="bg-gray-100 rounded-lg p-2 text-sm">{renderContent()}</div>;
  }

  return (
    <>
      {/* タグ全体をボタンにして、クリックでモーダルを開くようにします */}
      <button 
        onClick={() => setIsModalOpen(true)}
        className="bg-gray-100 rounded-lg p-2 text-sm text-left hover:bg-gray-200 transition-colors"
      >
        {renderContent()}
      </button>

      {/* isModalOpenがtrueの時だけ、モーダルコンポーネントを描画します */}
      {isModalOpen && <MusicLinkModal tag={tag} onClose={() => setIsModalOpen(false)} />}
    </>
  );
}
// ▲▲▲【ここまでが今回の主な修正点です】▲▲▲

export default function PostCard({ post }: { post: PostWithRelations }) {
  const profile = post.profiles
  if (!profile) return null

  return (
    <div className="w-full max-w-lg p-4 mb-4 bg-white border border-gray-200 rounded-lg shadow">
      <Link href={`/${profile.user_id_text}`} className="block">
        <div className="flex items-center mb-2">
          {profile.avatar_url ? (
            <Image src={profile.avatar_url} alt={profile.nickname || 'avatar'} width={40} height={40} className="rounded-full mr-3" />
          ) : (
            <UserCircleIcon className="w-10 h-10 text-gray-400 mr-3" />
          )}
          <div>
            <h3 className="font-bold text-gray-900 hover:underline">{profile.nickname}</h3>
            <p className="text-sm text-gray-500">@{profile.user_id_text}</p>
          </div>
        </div>
      </Link>
      <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>
      {post.tags && post.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.map((tag: TagWithRelations) => <TagBadge key={tag.id} tag={tag} />)}
        </div>
      )}
      <div className="flex justify-between items-center mt-4">
        <div className="text-sm text-gray-500">
          {new Date(post.created_at).toLocaleString('ja-JP')}
        </div>
        <div>
          <LikeButton post={post} />
        </div>
      </div>
    </div>
  )
}