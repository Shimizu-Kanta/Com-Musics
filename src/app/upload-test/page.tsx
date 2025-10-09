'use client'

import { useState, useTransition } from 'react'
import { uploadTestImage } from './actions'

export default function UploadTestPage() {
  const [isPending, startTransition] = useTransition()
  // サーバーからの結果メッセージを保存するためのState
  const [resultMessage, setResultMessage] = useState<string>('')

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      const result = await uploadTestImage(formData)
      setResultMessage(result.message)
    })
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>画像アップロード テストページ</h1>
      <p>このページでは、画像アップロード機能だけを単体でテストします。</p>

      <form action={handleSubmit} style={{ marginTop: '1.5rem', border: '1px solid #ccc', padding: '1rem' }}>
        <div>
          <label htmlFor="testImage">テスト画像を選択してください:</label>
          <br />
          <input type="file" id="testImage" name="testImage" accept="image/*" required style={{ marginTop: '0.5rem' }} />
        </div>
        <button type="submit" disabled={isPending} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
          {isPending ? 'アップロード中...' : 'アップロード実行'}
        </button>
      </form>

      {resultMessage && (
        <div style={{ marginTop: '1.5rem', border: '1px solid #ccc', padding: '1rem', backgroundColor: '#f9f9f9' }}>
          <h2>結果:</h2>
          <p style={{ color: resultMessage.startsWith('成功') ? 'green' : 'red' }}>
            {resultMessage}
          </p>
        </div>
      )}
    </div>
  )
}