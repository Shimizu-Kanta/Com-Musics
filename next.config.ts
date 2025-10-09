/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // remotePatterns は、許可する外部画像のURLのパターンを正規表現で指定します。
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'syrrxjjfzkwnspbkhrsf.supabase.co', // あなたのSupabaseプロジェクトのホスト名
        port: '',
        pathname: '/storage/v1/object/public/**', // /storage/v1/object/public/以下の全てのパスを許可
      },
      {
        protocol: 'https',
        hostname: 'i.scdn.co',
        port: '',
        pathname: '/image/**', // /image/ 以下の全てのパスを許可
      },
    ],
  },
};

module.exports = nextConfig;