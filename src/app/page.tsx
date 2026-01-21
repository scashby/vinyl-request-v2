// src/app/page.tsx
// Home page ("/") — Landing for Dead Wax Dialogues

"use client";

import Link from "next/link";
import { useSession } from "src/components/AuthProvider";

export default function Page() {
  const { session } = useSession();

  // Consistent button style: Muted zinc with subtle hover and backdrop blur
  const buttonClass = "px-6 py-3 bg-zinc-900/80 text-zinc-100 rounded-full font-medium hover:bg-zinc-800 hover:text-white transition-all duration-300 backdrop-blur-sm border border-white/5 hover:border-white/20 shadow-lg";

  return (
    <div className="min-h-screen font-sans bg-black flex flex-col justify-between">
      <header className="relative z-0 h-screen flex items-center justify-center text-center overflow-hidden">
        <video 
          autoPlay 
          muted 
          loop 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover -z-10 brightness-[0.4]"
        >
          <source src="/videos/header-video.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        <div className="relative z-10 p-8 max-w-4xl mx-auto">
          <h1 className="font-serif-display text-5xl md:text-7xl text-white mb-4 drop-shadow-lg tracking-tight">
            Dead Wax Dialogues
          </h1>
          <p className="text-xl md:text-2xl font-light text-zinc-300 mb-10 drop-shadow-md">
            A vinyl-focused listening lounge, jukebox, and community.
          </p>

          <nav className="flex gap-4 justify-center flex-wrap mt-8">
            <Link href="/about" className={buttonClass}>
              About
            </Link>
            <Link href="/events/events-page" className={buttonClass}>
              Events
            </Link>
            <Link href="/dj-sets" className={buttonClass}>
              DJ Sets
            </Link>
            <Link href="/dialogues" className={buttonClass}>
              Dialogues
            </Link>
            <Link href="/merch" className={buttonClass}>
              Merch
            </Link>

            {/* Original Admin button - only shows if Supabase session is active */}
            {session && (
              <Link
                href="/admin/admin-dashboard"
                className="px-6 py-3 bg-blue-900/40 text-blue-200 rounded-full font-medium hover:bg-blue-800/60 transition-colors backdrop-blur-sm border border-blue-400/20"
              >
                Admin
              </Link>
            )}
          </nav>
        </div>

        {/* Invisible Admin Link: 
          Hidden in the bottom-left corner. 
          No visual footprint, but cursor changes to pointer on hover.
        */}
        <Link 
          href="/admin/" 
          className="absolute bottom-0 left-0 w-8 h-8 opacity-0 cursor-default hover:cursor-pointer z-50"
          aria-hidden="true"
          title="Admin Access"
        >
          .
        </Link>
      </header>
    </div>
  );
}