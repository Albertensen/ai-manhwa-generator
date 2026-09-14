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
      <body className="bg-[#090a0f] text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        <header className="border-b border-slate-800/80 bg-[#0d1017]/90 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <span className="font-black text-white text-lg tracking-wider">M</span>
              </div>
              <div>
                <h1 className="font-bold text-base tracking-wide bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
                  MANHWA STUDIO
                </h1>
                <p className="text-[10px] text-indigo-400 font-mono tracking-widest uppercase">
                  End-to-End Recap Orchestrator
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4 text-xs font-mono">
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/60 border border-slate-700/50">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-slate-300">Supabase: Connected</span>
              </div>
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/60 border border-slate-700/50">
                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                <span className="text-slate-300">GPU: RTX 3060 Ti</span>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
