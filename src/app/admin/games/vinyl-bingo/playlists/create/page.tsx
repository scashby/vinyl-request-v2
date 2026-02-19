// Path: src/app/admin/games/vinyl-bingo/playlists/create/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function CreatePlaylistPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#121212]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-1 text-lg font-medium tracking-wide">
            <span>rockstar</span>
            <span className="text-purple-400">★</span>
            <span>bingo</span>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-12">
        <h1 className="mb-8 text-center text-2xl font-bold">
          Create a Custom Playlist
        </h1>

        <div className="space-y-2">
          {/* Import from Spotify */}
          <button
            onClick={() =>
              router.push("/admin/games/vinyl-bingo/playlists/import/spotify")
            }
            className="flex w-full items-center justify-between rounded-lg bg-[#1a1a1a] p-4 text-left transition hover:bg-[#222]"
          >
            <div>
              <h2 className="font-semibold">Import from Spotify</h2>
              <p className="mt-1 text-sm text-gray-400">
                Start with a playlist from Spotify, then customize the titles
                and set playback start positions.
              </p>
            </div>
            <ChevronRight className="h-5 w-5 flex-shrink-0 text-gray-400" />
          </button>

          {/* Import a Spreadsheet */}
          <button
            onClick={() =>
              router.push("/admin/games/vinyl-bingo/playlists/import/spreadsheet")
            }
            className="flex w-full items-center justify-between rounded-lg bg-[#1a1a1a] p-4 text-left transition hover:bg-[#222]"
          >
            <div>
              <h2 className="font-semibold">Import a Spreadsheet</h2>
              <p className="mt-1 text-sm text-gray-400">
                Upload a CSV document to import songs in bulk. Please note: This
                method is not compatible with automatic playback.
              </p>
            </div>
            <ChevronRight className="h-5 w-5 flex-shrink-0 text-gray-400" />
          </button>

          {/* Import a JSON file */}
          <button
            onClick={() =>
              router.push("/admin/games/vinyl-bingo/playlists/import/json")
            }
            className="flex w-full items-center justify-between rounded-lg bg-[#1a1a1a] p-4 text-left transition hover:bg-[#222]"
          >
            <div>
              <h2 className="font-semibold">Import a JSON file</h2>
              <p className="mt-1 text-sm text-gray-400">
                Upload a Rockstar Bingo playlist in JSON format.
              </p>
            </div>
            <ChevronRight className="h-5 w-5 flex-shrink-0 text-gray-400" />
          </button>
        </div>

        {/* Terms */}
        <p className="mt-12 text-center text-xs text-gray-500">
          By continuing, I acknowledge and confirm that I have read the{" "}
          <a href="#" className="text-cyan-400 hover:underline">
            terms of service
          </a>{" "}
          and I agree to be bound by such terms.
        </p>
      </main>
    </div>
  );
}