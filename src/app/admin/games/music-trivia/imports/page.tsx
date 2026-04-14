"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type ImportRunRow = {
  id: number;
  run_code: string;
  source_mode: string;
  status: string;
  triggered_by: string | null;
  notes_text: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  source_record_count?: number;
};

type SourceRecordRow = {
  id: number;
  source_kind: string;
  source_url: string | null;
  source_domain: string | null;
  source_title: string | null;
  excerpt_text: string | null;
  claim_text: string | null;
  verification_status: string;
  verification_notes: string | null;
  created_at: string;
  draft_question_code?: string | null;
};

type RunFormState = {
  source_mode: string;
  status: string;
  notes_text: string;
};

type SourceFormState = {
  source_kind: string;
  source_url: string;
  source_title: string;
  excerpt_text: string;
  claim_text: string;
  verification_status: string;
  verification_notes: string;
};

const DEFAULT_RUN_FORM: RunFormState = {
  source_mode: "manual",
  status: "pending",
  notes_text: "",
};

const DEFAULT_SOURCE_FORM: SourceFormState = {
  source_kind: "editorial",
  source_url: "",
  source_title: "",
  excerpt_text: "",
  claim_text: "",
  verification_status: "unreviewed",
  verification_notes: "",
};

export default function MusicTriviaImportsPage() {
  const [runs, setRuns] = useState<ImportRunRow[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [sourceRecords, setSourceRecords] = useState<SourceRecordRow[]>([]);

  const [runForm, setRunForm] = useState<RunFormState>(DEFAULT_RUN_FORM);
  const [sourceForm, setSourceForm] = useState<SourceFormState>(DEFAULT_SOURCE_FORM);

  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loadingSources, setLoadingSources] = useState(false);
  const [creatingRun, setCreatingRun] = useState(false);
  const [creatingSource, setCreatingSource] = useState(false);
  const [savingRecordId, setSavingRecordId] = useState<number | null>(null);
  const [convertingRecordId, setConvertingRecordId] = useState<number | null>(null);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? null,
    [runs, selectedRunId]
  );

  const loadRuns = useCallback(async () => {
    setLoadingRuns(true);
    try {
      const res = await fetch("/api/games/trivia/import-runs");
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Failed to load import runs");
      const nextRuns = Array.isArray(payload.data) ? payload.data : [];
      setRuns(nextRuns);
      setSelectedRunId((current) => current ?? nextRuns[0]?.id ?? null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to load import runs");
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  const loadSources = useCallback(async (runId: number | null) => {
    if (!runId) {
      setSourceRecords([]);
      return;
    }

    setLoadingSources(true);
    try {
      const res = await fetch(`/api/games/trivia/import-runs/${runId}/source-records`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Failed to load source records");
      setSourceRecords(Array.isArray(payload.data) ? payload.data : []);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to load source records");
    } finally {
      setLoadingSources(false);
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    void loadSources(selectedRunId);
  }, [loadSources, selectedRunId]);

  const createRun = async () => {
    setCreatingRun(true);
    try {
      const res = await fetch("/api/games/trivia/import-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runForm),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Failed to create import run");

      setRunForm(DEFAULT_RUN_FORM);
      await loadRuns();
      if (payload.data?.id) setSelectedRunId(Number(payload.data.id));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create import run");
    } finally {
      setCreatingRun(false);
    }
  };

  const createSourceRecord = async () => {
    if (!selectedRunId) {
      alert("Create or select an import run first.");
      return;
    }

    setCreatingSource(true);
    try {
      const res = await fetch(`/api/games/trivia/import-runs/${selectedRunId}/source-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sourceForm),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Failed to create source record");

      setSourceForm(DEFAULT_SOURCE_FORM);
      await Promise.all([loadSources(selectedRunId), loadRuns()]);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create source record");
    } finally {
      setCreatingSource(false);
    }
  };

  const updateSourceRecord = async (record: SourceRecordRow, patch: Record<string, unknown>) => {
    setSavingRecordId(record.id);
    try {
      const res = await fetch(`/api/games/trivia/source-records/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Failed to update source record");
      await loadSources(selectedRunId);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update source record");
    } finally {
      setSavingRecordId(null);
    }
  };

  const convertToDraftQuestion = async (record: SourceRecordRow) => {
    setConvertingRecordId(record.id);
    try {
      const res = await fetch(`/api/games/trivia/source-records/${record.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ created_by: "admin" }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Failed to convert source record");

      const questionId = Number(payload.data?.question_id);
      const questionCode = payload.data?.question_code ? String(payload.data.question_code) : "new draft";
      alert(`Created draft question ${questionCode}. Open Question Bank to refine it.`);
      const target = Number.isFinite(questionId) && questionId > 0
        ? `/admin/games/music-trivia/bank?questionId=${questionId}`
        : "/admin/games/music-trivia/bank";
      window.open(target, "_blank", "noopener,noreferrer");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to convert source record");
    } finally {
      setConvertingRecordId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#3a2b0f,transparent_45%),linear-gradient(180deg,#111,#070707)] p-6 text-stone-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-amber-900/40 bg-black/45 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-amber-300">Music Trivia</p>
          <h1 className="mt-1 text-4xl font-black uppercase text-amber-100">Imports Queue</h1>
          <p className="mt-2 text-sm text-stone-300">Stage research runs and collect candidate source records before converting them into approved trivia questions.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <Link href="/admin/games/music-trivia" className="rounded border border-stone-700 px-3 py-1">Setup</Link>
            <Link href="/admin/games/music-trivia/bank" className="rounded border border-stone-700 px-3 py-1">Question Bank</Link>
            <Link href="/admin/games/music-trivia/generate" className="rounded border border-stone-700 px-3 py-1">Legacy Generate</Link>
            <Link href="/admin/games/music-trivia/decks" className="rounded border border-stone-700 px-3 py-1">Deck Builder</Link>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[360px,1fr]">
          <aside className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-black uppercase text-amber-100">Import Runs</h2>
              <button className="rounded border border-stone-700 px-3 py-1 text-xs" onClick={() => void loadRuns()}>Refresh</button>
            </div>

            <div className="mt-4 space-y-2 rounded border border-stone-800 bg-stone-950/60 p-3 text-xs">
              <p className="font-semibold text-amber-200">Create Run</p>
              <label className="block">Source mode
                <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={runForm.source_mode} onChange={(e) => setRunForm((current) => ({ ...current, source_mode: e.target.value }))}>
                  <option value="manual">manual</option>
                  <option value="editorial">editorial</option>
                  <option value="api">api</option>
                  <option value="search">search</option>
                </select>
              </label>
              <label className="block">Initial status
                <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={runForm.status} onChange={(e) => setRunForm((current) => ({ ...current, status: e.target.value }))}>
                  <option value="pending">pending</option>
                  <option value="running">running</option>
                  <option value="completed">completed</option>
                  <option value="failed">failed</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </label>
              <label className="block">Notes
                <textarea className="mt-1 h-20 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={runForm.notes_text} onChange={(e) => setRunForm((current) => ({ ...current, notes_text: e.target.value }))} placeholder="Example: Bowie crate + LP only + approved editorial domains" />
              </label>
              <button className="rounded border border-amber-700 px-3 py-1" disabled={creatingRun} onClick={createRun}>{creatingRun ? "Creating..." : "Create Import Run"}</button>
            </div>

            <div className="mt-4 max-h-[60vh] space-y-2 overflow-auto pr-1 text-xs">
              {loadingRuns ? <p className="text-stone-400">Loading runs...</p> : null}
              {runs.map((run) => (
                <button
                  key={run.id}
                  className={`w-full rounded border p-3 text-left ${run.id === selectedRunId ? "border-amber-600 bg-amber-950/30" : "border-stone-800 bg-stone-950/60"}`}
                  onClick={() => setSelectedRunId(run.id)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-amber-100">{run.run_code}</p>
                    <span className="rounded bg-stone-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-stone-300">{run.status}</span>
                  </div>
                  <p className="mt-1 text-stone-300">{run.source_mode} · {run.source_record_count ?? 0} source records</p>
                  {run.notes_text ? <p className="mt-1 text-stone-400">{run.notes_text}</p> : null}
                </button>
              ))}
              {!loadingRuns && runs.length === 0 ? <p className="text-stone-400">No import runs yet.</p> : null}
            </div>
          </aside>

          <section className="rounded-2xl border border-stone-700 bg-black/45 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black uppercase text-amber-100">{selectedRun ? `Run ${selectedRun.run_code}` : "Select an Import Run"}</h2>
                <p className="text-sm text-stone-300">{selectedRun ? `${selectedRun.source_mode} · ${selectedRun.status} · created ${new Date(selectedRun.created_at).toLocaleString()}` : "Choose a run to stage candidate sources."}</p>
              </div>
              {selectedRun ? <p className="text-xs text-stone-400">Source records: {selectedRun.source_record_count ?? sourceRecords.length}</p> : null}
            </div>

            <div className="mt-4 rounded border border-stone-800 bg-stone-950/60 p-3 text-xs">
              <p className="font-semibold text-amber-200">Add Source Record</p>
              <div className="mt-2 grid gap-2 lg:grid-cols-2">
                <label>Source kind
                  <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={sourceForm.source_kind} onChange={(e) => setSourceForm((current) => ({ ...current, source_kind: e.target.value }))}>
                    <option value="editorial">editorial</option>
                    <option value="manual">manual</option>
                    <option value="api">api</option>
                    <option value="reference">reference</option>
                  </select>
                </label>
                <label>Verification status
                  <select className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={sourceForm.verification_status} onChange={(e) => setSourceForm((current) => ({ ...current, verification_status: e.target.value }))}>
                    <option value="unreviewed">unreviewed</option>
                    <option value="approved">approved</option>
                    <option value="rejected">rejected</option>
                    <option value="superseded">superseded</option>
                  </select>
                </label>
                <label>Source URL
                  <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={sourceForm.source_url} onChange={(e) => setSourceForm((current) => ({ ...current, source_url: e.target.value }))} placeholder="https://..." />
                </label>
                <label>Source title
                  <input className="mt-1 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={sourceForm.source_title} onChange={(e) => setSourceForm((current) => ({ ...current, source_title: e.target.value }))} placeholder="Article, interview, database entry" />
                </label>
              </div>
              <label className="mt-2 block">Excerpt
                <textarea className="mt-1 h-20 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={sourceForm.excerpt_text} onChange={(e) => setSourceForm((current) => ({ ...current, excerpt_text: e.target.value }))} placeholder="Relevant excerpt from source" />
              </label>
              <label className="mt-2 block">Claim / normalized fact
                <textarea className="mt-1 h-16 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={sourceForm.claim_text} onChange={(e) => setSourceForm((current) => ({ ...current, claim_text: e.target.value }))} placeholder="Normalized claim for later question authoring" />
              </label>
              <label className="mt-2 block">Verification notes
                <textarea className="mt-1 h-16 w-full rounded border border-stone-700 bg-stone-950 px-2 py-1" value={sourceForm.verification_notes} onChange={(e) => setSourceForm((current) => ({ ...current, verification_notes: e.target.value }))} placeholder="Why this source is reliable or what still needs checking" />
              </label>
              <button className="mt-3 rounded border border-amber-700 px-3 py-1" disabled={!selectedRunId || creatingSource} onClick={createSourceRecord}>{creatingSource ? "Saving..." : "Add Source Record"}</button>
            </div>

            <div className="mt-4 rounded border border-stone-800 bg-stone-950/60 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-amber-200">Candidate Sources</p>
                <button className="rounded border border-stone-700 px-3 py-1" disabled={!selectedRunId} onClick={() => void loadSources(selectedRunId)}>Refresh</button>
              </div>
              {loadingSources ? <p className="mt-2 text-stone-400">Loading source records...</p> : null}
              {!loadingSources && sourceRecords.length === 0 ? <p className="mt-2 text-stone-400">No source records for this run yet.</p> : null}
              <div className="mt-3 space-y-2">
                {sourceRecords.map((record) => (
                  <div key={record.id} className="rounded border border-stone-800 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-stone-100">{record.source_title || record.source_url || `Source #${record.id}`}</p>
                      <span className="rounded bg-stone-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-stone-300">{record.verification_status}</span>
                      <span className="rounded bg-stone-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-stone-300">{record.source_kind}</span>
                    </div>
                    {record.source_domain ? <p className="mt-1 text-stone-400">{record.source_domain}</p> : null}
                    {record.claim_text ? <p className="mt-2 text-stone-200">Claim: {record.claim_text}</p> : null}
                    {record.excerpt_text ? <p className="mt-1 whitespace-pre-wrap text-stone-300">{record.excerpt_text}</p> : null}
                    {record.verification_notes ? <p className="mt-1 text-amber-200">Notes: {record.verification_notes}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="rounded border border-emerald-700 px-2 py-1"
                        disabled={savingRecordId === record.id}
                        onClick={() => void updateSourceRecord(record, { verification_status: "approved" })}
                      >
                        Approve
                      </button>
                      <button
                        className="rounded border border-rose-700 px-2 py-1"
                        disabled={savingRecordId === record.id}
                        onClick={() => void updateSourceRecord(record, { verification_status: "rejected" })}
                      >
                        Reject
                      </button>
                      <button
                        className="rounded border border-stone-700 px-2 py-1"
                        disabled={savingRecordId === record.id}
                        onClick={() => {
                          const nextNotes = window.prompt("Update verification notes", record.verification_notes ?? "");
                          if (nextNotes === null) return;
                          void updateSourceRecord(record, { verification_notes: nextNotes });
                        }}
                      >
                        Edit Notes
                      </button>
                      <button
                        className="rounded border border-cyan-700 px-2 py-1"
                        disabled={convertingRecordId === record.id}
                        onClick={() => void convertToDraftQuestion(record)}
                      >
                        {convertingRecordId === record.id ? "Converting..." : "Convert To Draft"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </section>
      </div>
    </div>
  );
}