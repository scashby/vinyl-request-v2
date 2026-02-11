"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/admin/games/bingo/settings" className="text-slate-500 hover:text-slate-900">←</Link>
          <div className="text-center">
            <div className="text-sm font-semibold text-slate-900">Jumbotron</div>
          </div>
          <button type="button" onClick={() => router.back()} className="text-slate-500 hover:text-slate-900">×</button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Jumbotron View</div>
          <p className="mt-2 text-xs text-slate-500">Customize the large screen display for this game.</p>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400">Default Video URL</label>
              <input className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400">Pre-game Video URL</label>
              <input className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Save
          </button>
        </div>
      </main>
    </div>
  );
}
