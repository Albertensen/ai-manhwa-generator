import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Manhwa Studio | Automated Recap & Webtoon Storytelling',
  description: 'Full-stack AI Manhwa & Anime Recap Video Generator with Character Consistency Locking',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090a0f] text-slate-100 antialiased selection:bg-indigo-500 selection:text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
