'use client'

// Next.jsのImageコンポーネントをインポートします
import Image from 'next/image'

// あなたが送ってくれた画像の公開URL
const TEST_IMAGE_URL = 'https://syrrxjjfzkwnspbkhrsf.supabase.co/storage/v1/object/public/user_images/testfile/testimage.jpg'

export default function ReadTestPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>画像読み込み テストページ</h1>
      <p>
        以下の四角の中に、Supabaseから直接画像が表示されれば、読み込みは成功です。
      </p>
      
      <div style={{ 
        marginTop: '1.5rem', 
        border: '2px dashed #ccc', 
        padding: '1rem',
        width: '600px',
        height: '400px',
        position: 'relative' // Imageコンポーネントのレイアウト用に必要
      }}>
        <Image 
          src={TEST_IMAGE_URL} 
          alt="Supabaseからのテスト画像"
          // layout="fill" と objectFit="contain" を使って、
          // アスペクト比を保ったままコンテナに収まるように表示します。
          layout="fill"
          objectFit="contain"
          // 画像が読み込めなかった場合のエラーをコンソールに出力します
          onError={(e) => {
            console.error('画像の読み込みに失敗しました:', e)
          }}
        />
      </div>
      <p style={{ marginTop: '1rem' }}>
        <strong>画像のURL:</strong> <a href={TEST_IMAGE_URL} target="_blank" rel="noopener noreferrer">{TEST_IMAGE_URL}</a>
      </p>
    </div>
  )
}