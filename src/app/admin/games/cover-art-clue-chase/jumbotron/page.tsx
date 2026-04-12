"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

export default function CoverArtClueChaseJumbotronPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => undefined);
    } else {
      document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "f" || event.key === "F") {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen]);

  return (
    <div ref={containerRef} className="min-h-screen bg-[linear-gradient(180deg,#090909,#040404)] p-6 text-stone-100">
      <div className="mx-auto max-w-5xl rounded-3xl border border-cyan-900/40 bg-black/55 p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black uppercase text-cyan-100">Cover Art Clue Chase Jumbotron</h1>
          <Link href="/admin/games/cover-art-clue-chase" className="rounded border border-stone-600 px-3 py-1 text-xs uppercase">Back to Setup</Link>
        </div>

        <p className="mt-3 text-sm text-stone-300">Session: {sessionId ?? "(none selected)"}</p>

        <section className="mt-6 rounded-xl border border-stone-700 bg-stone-950/60 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Jumbotron Scope Recommendation</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-stone-200">
            <li>Primary canvas for staged reveal assets with clear stage indicator (1, 2, final).</li>
            <li>Large timer and action prompt while host resets vinyl between rounds.</li>
            <li>Scoring legend visible at all times: 3 early, 2 second, 1 final/audio.</li>
            <li>Optional audio-clue badge shown only when fallback clue is live.</li>
            <li>High-contrast typography sized for brewery viewing distance.</li>
          </ul>
        </section>
      </div>

      <button
        type="button"
        onClick={toggleFullscreen}
        className="fixed bottom-3 right-3 z-50 rounded border border-stone-600/70 bg-black/55 px-3 py-1 text-xs text-stone-200"
        aria-label="Toggle fullscreen"
      >
        Fullscreen (F)
      </button>
    </div>
  );
}
