"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

export default function Page() {
  const [selection, setSelection] = useState<"yes" | "no">("yes");
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("sessionId");

  const handleContinue = () => {
    if (!sessionId) return;
    router.push(`/admin/games/bingo/host?sessionId=${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/admin/games/bingo/setup" className="text-slate-500 hover:text-slate-900">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Image src="/images/Skulllogo.png" alt="Dead Wax Dialogues" width={28} height={28} />
            <div className="text-center">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Dead Wax</div>
              <div className="text-sm font-semibold text-slate-900">Bingo</div>
            </div>
          </div>
          <div className="w-6" />
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-900">Playback Source Setup</h1>
          <p className="mt-2 text-sm text-slate-500">Would you like to use Spotify playback?</p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setSelection("yes")}
            className={`rounded-2xl border p-6 text-left shadow-sm transition ${
              selection === "yes" ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className="text-sm font-semibold text-slate-900">Yes</div>
            <div className="mt-2 text-xs text-slate-500">
              I have Spotify Premium open on a device and my audio setup is ready.
            </div>
          </button>
          <button
            type="button"
            onClick={() => setSelection("no")}
            className={`rounded-2xl border p-6 text-left shadow-sm transition ${
              selection === "no" ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className="text-sm font-semibold text-slate-900">No</div>
            <div className="mt-2 text-xs text-slate-500">I’ll manage playback myself using vinyl.</div>
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="inline-flex items-center rounded-full border border-blue-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
            Tip
          </div>
          <p className="mt-3 text-xs text-slate-500">
            When connecting to Spotify, we recommend hosting games from a Mac or PC rather than a mobile device.
          </p>
        </div>

        {selection === "no" ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-600">
            <div className="inline-flex items-center rounded-full border border-rose-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide">
              Warning
            </div>
            <p className="mt-2 text-xs">
              Playback is not supported for vinyl playlists and will need to be managed manually.
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleContinue}
          className="mt-8 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Continue
        </button>
      </main>
    </div>
  );
}
