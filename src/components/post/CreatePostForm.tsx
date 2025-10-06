'use client'

import { createPost } from '@/app/post/actions'
import { useRef } from 'react'

export default function CreatePostForm() {
  const formRef = useRef<HTMLFormElement>(null)

  const handleCreatePost = async (formData: FormData) => {
    // サーバーアクションを呼び出し
    await createPost(formData)
    // フォームをリセット
    formRef.current?.reset()
  }

  return (
    <form
      ref={formRef}
      action={handleCreatePost}
      className="w-full max-w-lg p-4 bg-white border border-gray-200 rounded-lg shadow"
    >
      <div className="flex flex-col space-y-2">
        <textarea
          name="content"
          placeholder="いまどうしてる？"
          rows={3}
          required
          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            投稿する
          </button>
        </div>
      </div>
    </form>
  )
}