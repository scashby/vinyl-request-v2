"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type SourceRecord = {
  id: number;
  source_url: string | null;
  source_domain: string | null;
  source_title: string | null;
  excerpt_text: string | null;
  verification_status: string | null;
};

type TriviaFact = {
  id: number;
  fact_code: string;
  entity_type: string;
  entity_id: number | null;
  entity_ref: string;
  fact_text: string;
  fact_kind: string;
  status: "draft" | "approved" | "archived";
  confidence: "low" | "medium" | "high";
  generation_run_id: number | null;
  source_record_id: number | null;
  created_by: string | null;
  created_at: string;
  trivia_source_records: SourceRecord | null;
};

const FACT_KIND_LABELS: Record<string, string> = {
  // DB-extracted kinds
  bio: "Bio",
  recording_context: "Recording",
  chart_fact: "Chart",
  production_note: "Production",
  cultural_context: "Cultural",
  critical_reception: "Review",
  // AI-generated trivia kinds
  name_origin: "Name Origin",
  connection: "Connection",
  pre_fame: "Pre-Fame",
  collaboration: "Collab",
  personal: "Personal",
  song_history: "Song History",
  band_history: "Band History",
  unusual_skill: "Unusual Skill",
  other: "Other",
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  artist: "Artist",
  master: "Album",
  recording: "Track",
  label: "Label",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "text-emerald-400 border-emerald-700",
  medium: "text-amber-400 border-amber-700",
  low: "text-red-400 border-red-700",
};

const STATUS_TABS = ["all", "draft", "approved", "archived"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

export default function MusicTriviaFactsPage() {
  const [facts, setFacts] = useState<TriviaFact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [statusTab, setStatusTab] = useState<StatusTab>("draft");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [factKindFilter, setFactKindFilter] = useState("");
  const [entityRefSearch, setEntityRefSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [pendingChanges, setPendingChanges] = useState<Record<number, "approved" | "archived" | "draft">>({});
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const LIMIT = 50;

  const fetchFacts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusTab !== "all") params.set("status", statusTab);
    if (entityTypeFilter) params.set("entity_type", entityTypeFilter);
    if (factKindFilter) params.set("fact_kind", factKindFilter);
    if (entityRefSearch.trim()) params.set("entity_ref", entityRefSearch.trim());
    params.set("limit", String(LIMIT));
    params.set("offset", String(offset));

    try {
      const res = await fetch(`/api/games/trivia/facts?${params.toString()}`);
      const json = await res.json();
      setFacts(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch {
      setErrorMsg("Failed to load facts");
    } finally {
      setLoading(false);
    }
  }, [statusTab, entityTypeFilter, factKindFilter, entityRefSearch, offset]);

  useEffect(() => { fetchFacts(); }, [fetchFacts]);

  // Reset offset when filters change
  useEffect(() => { setOffset(0); }, [statusTab, entityTypeFilter, factKindFilter, entityRefSearch]);

  async function patchFact(id: number, status: "approved" | "archived" | "draft") {
    setPendingChanges((prev) => ({ ...prev, [id]: status }));
    try {
      await fetch(`/api/games/trivia/facts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setFacts((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
    } catch {
      setErrorMsg(`Failed to update fact ${id}`);
    } finally {
      setPendingChanges((prev) => { const next = { ...prev }; delete next[id]; return next; });
    }
  }

  async function bulkPatch(status: "approved" | "archived" | "draft") {
    const visible = facts.filter((f) => f.status !== status);
    for (const fact of visible) {
      await patchFact(fact.id, status);
    }
  }

  async function generateFromApproved() {
    const approvedIds = facts.filter((f) => f.status === "approved").map((f) => f.id);
    if (!approvedIds.length) { setErrorMsg("No approved facts visible — approve some facts first"); return; }

    setGenerating(true);
    setSuccessMsg("");
    setErrorMsg("");
    try {
      const res = await fetch("/api/games/trivia/facts/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fact_ids: approvedIds }),
      });
      const json = await res.json();
      if (!res.ok) { setErrorMsg(json.error ?? "Generation failed"); return; }
      setSuccessMsg(`Generated ${json.generated_count} question(s) from ${json.facts_processed} fact(s). View in Question Bank → filter tag: ai-generated`);
    } catch {
      setErrorMsg("Generation request failed");
    } finally {
      setGenerating(false);
    }
  }

  const approvedCount = facts.filter((f) => f.status === "approved").length;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#0f0a12,#08080a)] p-4 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-4">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black uppercase text-fuchsia-200">Trivia Fact Library</h1>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/music-trivia">Setup</Link>
            <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/music-trivia/generate">Generate</Link>
            <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/music-trivia/bank">Question Bank</Link>
            <Link className="rounded border border-stone-700 px-2 py-1" href="/admin/games/music-trivia/help">Help</Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-700 bg-stone-950/60 p-3">
          {/* Status tabs */}
          <div className="flex gap-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusTab(tab)}
                className={`rounded px-2 py-1 text-xs capitalize ${statusTab === tab ? "bg-fuchsia-800 text-fuchsia-100" : "border border-stone-700 text-stone-400 hover:text-stone-200"}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <select
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            className="rounded border border-stone-700 bg-stone-900 px-2 py-1 text-xs text-stone-200"
          >
            <option value="">All entity types</option>
            {Object.entries(ENTITY_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select
            value={factKindFilter}
            onChange={(e) => setFactKindFilter(e.target.value)}
            className="rounded border border-stone-700 bg-stone-900 px-2 py-1 text-xs text-stone-200"
          >
            <option value="">All fact kinds</option>
            {Object.entries(FACT_KIND_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search entity…"
            value={entityRefSearch}
            onChange={(e) => setEntityRefSearch(e.target.value)}
            className="rounded border border-stone-700 bg-stone-900 px-2 py-1 text-xs text-stone-200 placeholder-stone-500"
          />

          <span className="ml-auto text-xs text-stone-500">{total} fact{total !== 1 ? "s" : ""}</span>
        </div>

        {/* Bulk actions + generate */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => bulkPatch("approved")}
            className="rounded border border-emerald-700 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-900/30"
          >
            Approve All Visible
          </button>
          <button
            onClick={() => bulkPatch("archived")}
            className="rounded border border-stone-700 px-3 py-1 text-xs text-stone-400 hover:bg-stone-800"
          >
            Archive All Visible
          </button>
          <div className="ml-auto flex items-center gap-2">
            {approvedCount > 0 && (
              <span className="text-xs text-emerald-400">{approvedCount} approved visible</span>
            )}
            <button
              onClick={generateFromApproved}
              disabled={generating || approvedCount === 0}
              className="rounded border border-fuchsia-700 px-3 py-1 text-xs text-fuchsia-300 hover:bg-fuchsia-900/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {generating ? "Generating…" : "Generate Questions from Approved →"}
            </button>
          </div>
        </div>

        {/* Messages */}
        {successMsg && (
          <div className="rounded-lg border border-emerald-700 bg-emerald-950/40 p-3 text-xs text-emerald-300">
            {successMsg}
            {" "}
            <Link href="/admin/games/music-trivia/bank" className="underline">Open Question Bank</Link>
          </div>
        )}
        {errorMsg && (
          <div className="rounded-lg border border-red-700 bg-red-950/40 p-3 text-xs text-red-300">
            {errorMsg}
            <button onClick={() => setErrorMsg("")} className="ml-3 text-red-500 hover:text-red-300">×</button>
          </div>
        )}

        {/* Fact list */}
        {loading ? (
          <div className="py-12 text-center text-sm text-stone-500">Loading facts…</div>
        ) : facts.length === 0 ? (
          <div className="rounded-xl border border-stone-700 bg-stone-950/40 py-12 text-center text-sm text-stone-500">
            No facts found.{" "}
            <Link href="/admin/games/music-trivia/generate" className="underline text-fuchsia-400">
              Generate facts →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {facts.map((fact) => {
              const src = fact.trivia_source_records;
              const isPending = fact.id in pendingChanges;
              return (
                <div
                  key={fact.id}
                  className={`rounded-xl border p-3 transition-opacity ${
                    fact.status === "approved"
                      ? "border-emerald-800 bg-emerald-950/20"
                      : fact.status === "archived"
                      ? "border-stone-800 bg-stone-950/20 opacity-50"
                      : "border-stone-700 bg-stone-950/40"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    {/* Meta badges */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded border border-fuchsia-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-fuchsia-300">
                        {ENTITY_TYPE_LABELS[fact.entity_type] ?? fact.entity_type}
                      </span>
                      <span className="text-sm font-semibold text-stone-100">{fact.entity_ref}</span>
                      <span className="rounded border border-stone-600 px-1.5 py-0.5 text-[10px] text-stone-400">
                        {FACT_KIND_LABELS[fact.fact_kind] ?? fact.fact_kind}
                      </span>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] capitalize ${CONFIDENCE_COLORS[fact.confidence] ?? "text-stone-400 border-stone-600"}`}>
                        {fact.confidence}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5">
                      {fact.status !== "approved" && (
                        <button
                          onClick={() => patchFact(fact.id, "approved")}
                          disabled={isPending}
                          className="rounded border border-emerald-700 px-2 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-900/30 disabled:opacity-40"
                        >
                          Approve
                        </button>
                      )}
                      {fact.status !== "archived" && (
                        <button
                          onClick={() => patchFact(fact.id, "archived")}
                          disabled={isPending}
                          className="rounded border border-stone-700 px-2 py-0.5 text-[10px] text-stone-400 hover:bg-stone-800 disabled:opacity-40"
                        >
                          Archive
                        </button>
                      )}
                      {fact.status === "archived" && (
                        <button
                          onClick={() => patchFact(fact.id, "draft")}
                          disabled={isPending}
                          className="rounded border border-stone-700 px-2 py-0.5 text-[10px] text-stone-400 hover:bg-stone-800 disabled:opacity-40"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Fact text */}
                  <p className="mt-2 text-sm leading-relaxed text-stone-200">{fact.fact_text}</p>

                  {/* Source */}
                  {src?.source_url && (
                    <div className="mt-1.5 text-[10px] text-stone-500">
                      Source:{" "}
                      <a
                        href={src.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-stone-400 underline hover:text-stone-200"
                      >
                        {src.source_title ?? src.source_domain ?? src.source_url}
                      </a>
                    </div>
                  )}
                  {!src?.source_url && src?.source_title && (
                    <div className="mt-1.5 text-[10px] text-stone-500">Source: {src.source_title}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
              disabled={offset === 0}
              className="rounded border border-stone-700 px-3 py-1 text-xs text-stone-400 hover:text-stone-200 disabled:opacity-30"
            >
              ← Prev
            </button>
            <span className="text-xs text-stone-500">
              {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
            </span>
            <button
              onClick={() => setOffset((o) => o + LIMIT)}
              disabled={offset + LIMIT >= total}
              className="rounded border border-stone-700 px-3 py-1 text-xs text-stone-400 hover:text-stone-200 disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
