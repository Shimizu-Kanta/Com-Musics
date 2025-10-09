'use client'

import { useState } from 'react'
import Image from 'next/image'
import { XMarkIcon } from '@heroicons/react/24/solid'
import { type Tag } from '@/components/post/TagSearch'

// PostCardから流用した、サブスクサイトへのリンクを表示するモーダル
function MusicLinkModal({ tag, onClose }: { tag: Tag; onClose: () => void }) {
  let searchTerm = '';
  let subText = '';

  if (tag.type === 'song') {
    searchTerm = `${tag.name} ${tag.artistName || ''}`;
    subText = `${tag.name} (${tag.artistName || 'Unknown Artist'})`;
  } else if (tag.type === 'artist') {
    searchTerm = tag.name;
    subText = tag.name;
  }

  const encodedSearchTerm = encodeURIComponent(searchTerm.trim());

  const links = [
    { name: 'Spotify', url: `https://open.spotify.com/search/${encodedSearchTerm}` },
    { name: 'Apple Music', url: `https://music.apple.com/jp/search?term=${encodedSearchTerm}` },
    { name: 'YouTube Music', url: `https://music.youtube.com/search?q=${encodedSearchTerm.replace(/%20/g, '+')}` },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div className="relative w-11/12 max-w-sm p-6 bg-white rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100">
          <XMarkIcon className="w-6 h-6 text-gray-600" />
        </button>
        <p className="text-sm text-gray-600 mb-1">外部リンク</p>
        <p className="font-bold text-lg mb-4 truncate">{subText}</p>
        <div className="flex flex-col space-y-3">
          {links.map(link => (
            <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer" className="w-full px-4 py-3 text-center font-semibold text-gray-800 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              {link.name} で検索
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// 外部から利用する、クリック可能なタグ部品
export default function InteractiveTag({ tag }: { tag: Tag }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 楽曲かアーティストかで表示を切り替えます
  if (tag.type === 'song') {
    return (
      <>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center bg-gray-100 rounded-lg p-1 pr-3 text-left hover:bg-gray-200 transition-colors">
          {tag.imageUrl && <Image src={tag.imageUrl} alt={tag.name} width={40} height={40} className="rounded-md mr-2"/>}
          <div>
            <p className="text-sm font-bold">{tag.name}</p>
            <p className="text-xs text-gray-500">{tag.artistName}</p>
          </div>
        </button>
        {isModalOpen && <MusicLinkModal tag={tag} onClose={() => setIsModalOpen(false)} />}
      </>
    );
  }

  if (tag.type === 'artist') {
    return (
      <>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center bg-gray-100 rounded-full p-1 pr-3 text-left hover:bg-gray-200 transition-colors">
          {tag.imageUrl && <Image src={tag.imageUrl} alt={tag.name} width={24} height={24} className="rounded-full mr-2"/>}
          <span className="text-sm font-medium">{tag.name}</span>
        </button>
        {isModalOpen && <MusicLinkModal tag={tag} onClose={() => setIsModalOpen(false)} />}
      </>
    );
  }

  return null;
}