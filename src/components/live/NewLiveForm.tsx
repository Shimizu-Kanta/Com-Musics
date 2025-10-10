'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { createLive } from '@/app/live/actions'
import TagSearch, { type Tag } from '@/components/post/TagSearch'
import Image from 'next/image'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="w-full px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
      {pending ? '作成中...' : 'ライブを作成'}
    </button>
  )
}

// ▼▼▼【重要】ここに venues プロパティを復活させます ▼▼▼
export default function NewLiveForm({ venues }: { venues: string[] }) {
  const searchParams = useSearchParams()
  const prefilledName = searchParams.get('name') || ''
  const prefilledArtistId = searchParams.get('artistId') || null
  const prefilledArtistName = searchParams.get('artistName') || ''

  const [selectedArtist, setSelectedArtist] = useState<Tag | null>(
    prefilledArtistId ? { id: prefilledArtistId, name: prefilledArtistName, type: 'artist' } : null
  )
  const [isSearching, setIsSearching] = useState(false)
  const [state, formAction] = useActionState(createLive, null)

  const handleArtistSelect = (tag: Tag) => {
    if (tag.type === 'artist') {
      setSelectedArtist(tag)
    }
    setIsSearching(false)
  }

  return (
    <form action={formAction} className="space-y-4">
      {selectedArtist && <input type="hidden" name="artistId" value={selectedArtist.id} />}
      
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">ライブ名</label>
        <input type="text" id="name" name="name" defaultValue={prefilledName} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
      </div>
      
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700">アーティスト</label>
        {selectedArtist ? (
          <div className="flex items-center justify-between mt-1 p-2 border rounded-md">
            <div className="flex items-center">
              {selectedArtist.imageUrl && <Image src={selectedArtist.imageUrl} alt={selectedArtist.name} width={24} height={24} className="rounded-full mr-2" />}
              <span>{selectedArtist.name}</span>
            </div>
            <button type="button" onClick={() => setIsSearching(true)} className="text-sm text-indigo-600 hover:underline">変更</button>
          </div>
        ) : (
          <button type="button" onClick={() => setIsSearching(true)} className="mt-1 w-full p-2 text-left text-gray-500 border border-dashed rounded-md hover:border-indigo-500">
            アーティストを検索
          </button>
        )}
        
        {isSearching && <TagSearch onTagSelect={handleArtistSelect} onClose={() => setIsSearching(false)} searchOnly='artist' />}
      </div>
      
      <div>
        <label htmlFor="venue" className="block text-sm font-medium text-gray-700">会場</label>
        <input
          type="text"
          id="venue"
          name="venue"
          required
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          list="venue-list"
        />
        <datalist id="venue-list">
          {venues.map((venue) => (
            <option key={venue} value={venue} />
          ))}
        </datalist>
      </div>

      <div>
        <label htmlFor="date" className="block text-sm font-medium text-gray-700">公演日</label>
        <input type="date" id="date" name="date" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
      </div>
      
      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
      
      <SubmitButton />
    </form>
  )
}