'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronDownIcon } from '@heroicons/react/24/solid'
import { type Artist } from '@/types'

type TabProps = {
  currentTab: 'all' | 'following'
  currentArtistId?: string
  favoriteArtists: Artist[]
}

export default function Tab({ currentTab, currentArtistId, favoriteArtists }: TabProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [dropdownRef])

  const activeClasses = 'border-b-2 border-indigo-500 text-indigo-600'
  const inactiveClasses = 'border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'

  const selectedArtistName = favoriteArtists.find(artist => artist.id === currentArtistId)?.name

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {/* すべて タブ */}
        <Link
          href="/"
          className={`whitespace-nowrap py-4 px-1 text-sm font-medium ${!currentArtistId && currentTab === 'all' ? activeClasses : inactiveClasses}`}
        >
          すべて
        </Link>

        {/* フォロー中 タブ */}
        <Link
          href="/?tab=following"
          className={`whitespace-nowrap py-4 px-1 text-sm font-medium ${!currentArtistId && currentTab === 'following' ? activeClasses : inactiveClasses}`}
        >
          フォロー中
        </Link>
        
        {/* お気に入りアーティスト ドロップダウン */}
        {favoriteArtists.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`whitespace-nowrap py-4 px-1 text-sm font-medium flex items-center ${currentArtistId ? activeClasses : inactiveClasses}`}
            >
              <span>{selectedArtistName || 'お気に入り'}</span>
              <ChevronDownIcon className={`w-4 h-4 ml-1 transform transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                {favoriteArtists.map(artist => (
                  <Link
                    key={artist.id}
                    href={`/?artistId=${artist.id}`}
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {artist.image_url && (
                      <Image src={artist.image_url} alt={artist.name} width={20} height={20} className="rounded-full w-5 h-5 mr-2 object-cover" />
                    )}
                    <span>{artist.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>
    </div>
  ) 
}