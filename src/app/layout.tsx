import type { Metadata } from "next";
//import "./globals.css";

export const metadata: Metadata = {
  title: "Com-Musics",
  description: "A social network for music lovers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}