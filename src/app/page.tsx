// Home page ("/") — Landing for Dead Wax Dialogues

"use client";

import Link from "next/link";
import { useSession } from "src/components/AuthProvider";

export default function Page() {
  const { session } = useSession();

  return (
    <div className="min-h-screen font-sans">
      <header className="relative h-screen flex items-center justify-center text-center overflow-hidden">
        <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover -z-10 brightness-[0.4]">
          <source src="/videos/header-video.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        <div className="relative z-10 p-8 max-w-4xl mx-auto">
          <h1 className="font-serif-display text-5xl md:text-7xl text-white mb-4 drop-shadow-lg">
            Dead Wax Dialogues
          </h1>
          <p className="text-xl md:text-2xl font-light text-gray-200 mb-8 drop-shadow-md">
            A vinyl-focused listening lounge, jukebox, and community.
          </p>

          <nav className="flex gap-4 justify-center flex-wrap mt-8">
            <Link href="/browse/browse-queue" className="px-6 py-3 bg-neutral-900/90 text-white rounded-full font-medium hover:bg-neutral-800 transition-colors backdrop-blur-sm border border-white/10">
              Browse Queue
            </Link>
            <Link href="/browse/browse-albums" className="px-6 py-3 bg-neutral-900/90 text-white rounded-full font-medium hover:bg-neutral-800 transition-colors backdrop-blur-sm border border-white/10">
              Browse Albums
            </Link>
            <Link href="/events/events-page" className="px-6 py-3 bg-neutral-900/90 text-white rounded-full font-medium hover:bg-neutral-800 transition-colors backdrop-blur-sm border border-white/10">
              Events
            </Link>
            <Link href="/dialogues" className="px-6 py-3 bg-neutral-900/90 text-white rounded-full font-medium hover:bg-neutral-800 transition-colors backdrop-blur-sm border border-white/10">
              Dialogues
            </Link>

            {session && (
              <Link
                href="/admin/admin-dashboard"
                className="px-6 py-3 bg-blue-600/90 text-white rounded-full font-medium hover:bg-blue-700 transition-colors backdrop-blur-sm shadow-lg shadow-blue-900/20"
              >
                Admin
              </Link>
            )}
          </nav>
        </div>
      </header>
    </div>
  );
}
