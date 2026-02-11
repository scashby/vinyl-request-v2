"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, RefreshCw, Settings } from "lucide-react";

export default function BingoHeader({
  backHref = "/admin/games",
  settingsHref,
  title,
}: {
  backHref?: string;
  settingsHref?: string;
  title?: string;
}) {
  const settingsLink = settingsHref ?? "/admin/games/bingo/settings";

  return (
    <div className="border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href={backHref} className="flex items-center gap-2 text-slate-500 hover:text-slate-900">
          <ChevronLeft className="h-5 w-5" />
          <span className="text-sm font-semibold">Back</span>
        </Link>

        <div className="flex items-center gap-3">
          <Image src="/images/Skulllogo.png" alt="Dead Wax Dialogues" width={28} height={28} />
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Dead Wax</div>
            <div className="text-sm font-semibold text-slate-900">Vinyl Bingo</div>
            {title ? <div className="text-[11px] text-slate-500">{title}</div> : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-800"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <Link
            href={settingsLink}
            className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-800"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
