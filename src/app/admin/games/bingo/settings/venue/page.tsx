"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/admin/games/bingo/settings" className="text-slate-500 hover:text-slate-900">←</Link>
          <div className="flex items-center gap-2">
            <Image src="/images/Skulllogo.png" alt="Dead Wax Dialogues" width={28} height={28} />
            <div className="text-center leading-tight">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Dead Wax</div>
              <div className="text-sm font-semibold text-slate-900">Create a Venue</div>
            </div>
          </div>
          <button type="button" onClick={() => router.back()} className="text-slate-500 hover:text-slate-900">×</button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Create a Venue</div>
          <p className="mt-2 text-xs text-slate-500">Fill out the form below to create a new venue.</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400">Name</label>
              <input className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400">Address</label>
              <input className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400">City</label>
              <input className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400">State / Province</label>
              <input className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400">Country</label>
              <input className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" />
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
