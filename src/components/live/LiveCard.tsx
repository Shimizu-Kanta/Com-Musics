'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import AttendButton from './AttendButton'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid'

type Live = { id: number; live_date: string | null; isAttended: boolean; }
type Venues = { [venueName: string]: Live[]; }
type LiveCardProps = {
  liveName: string;
  artistId: string | null; // artistId を受け取る
  artistName: string | null;
  artistImageUrl: string | null;
  venues: Venues;
  userLoggedIn: boolean;
}

export default function LiveCard({ liveName, artistId, artistName, artistImageUrl, venues, userLoggedIn }: LiveCardProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between text-left">
        <div className="flex items-center">
          {artistImageUrl && <Image src={artistImageUrl} alt={artistName || ''} width={40} height={40} className="rounded-full mr-3" />}
          <div>
            <h2 className="text-xl font-bold">{liveName}</h2>
            <p className="text-sm text-gray-500">{artistName}</p>
          </div>
        </div>
        {isOpen ? <ChevronUpIcon className="w-6 h-6 text-gray-500" /> : <ChevronDownIcon className="w-6 h-6 text-gray-500" />}
      </button>

      {isOpen && (
        <div className="mt-4 pl-4 border-l-2 border-gray-100">
          {Object.entries(venues).map(([venueName, dates]) => (
            <div key={venueName} className="mt-2 pl-2">
              <h3 className="font-semibold">{venueName}</h3>
              <div className="mt-1 space-y-2 pl-4">
                {dates.map(date => (
                  <div key={date.id} className="flex justify-between items-center">
                    <p className="text-sm">{date.live_date}</p>
                    {userLoggedIn && <AttendButton liveId={date.id} isInitiallyAttended={date.isAttended} />}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-4 pt-4 border-t border-dashed">
            {/* ▼▼▼ リンクに artistId と artistName を追加します ▼▼▼ */}
            <Link 
              href={`/live/new?name=${encodeURIComponent(liveName)}&artistId=${encodeURIComponent(artistId || '')}&artistName=${encodeURIComponent(artistName || '')}`}
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
            >
              + このツアーに公演を追加する
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}