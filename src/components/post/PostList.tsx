'use client'

import { useState, useEffect, useCallback } from 'react'
import { useInView } from 'react-intersection-observer'
import { fetchPosts } from '@/app/(main)/post/actions'
import type { PostWithRelations } from '@/types'
import PostCard from './PostCard'
import { useSearchParams } from 'next/navigation'

// profileUserIdをプロパティとして受け取れるようにする
export default function PostList({ initialPosts, userId, profileUserId }: { initialPosts: PostWithRelations[], userId?: string, profileUserId?: string }) {
  const [posts, setPosts] = useState(initialPosts)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(initialPosts.length >= 20) // 20件未満なら次はない
  const [isLoading, setIsLoading] = useState(false)
  const { ref, inView } = useInView({ threshold: 0 })
  const searchParams = useSearchParams()

  useEffect(() => {
    setPosts(initialPosts)
    setPage(1)
    setHasMore(initialPosts.length >= 20)
  }, [initialPosts])

  const tab = searchParams.get('tab') || 'all'
  const artistId = searchParams.get('artistId') || undefined
  const searchQuery = searchParams.get('q') || undefined

  const loadMorePosts = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true)

    const newPosts = await fetchPosts({
      page,
      userId,
      tab,
      artistId,
      profileUserId, // プロフィールIDを渡す
      searchQuery  // 検索クエリを渡す
    })
    
    if (newPosts.length > 0) {
      setPage(prev => prev + 1)
      setPosts(prev => [...prev, ...newPosts])
    } else {
      setHasMore(false)
    }
    setIsLoading(false)
  }, [artistId, isLoading, page, profileUserId, searchQuery, tab, userId])

  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      loadMorePosts()
    }
  }, [inView, hasMore, isLoading, loadMorePosts])

  if (posts.length === 0) {
    return <p className="p-4 text-center text-gray-500">まだ投稿がありません。</p>;
  }

  return (
    <>
      <div className="md:mt-0">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
      {hasMore && (
        <div ref={ref} className="flex justify-center items-center p-4">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}
    </>
  )
}