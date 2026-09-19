// src/app/admin/edit-merch/page.tsx - Admin interface for editing Merch page content
//
// Same homepage_sections table as /admin/edit-home, scoped to page='merch'.
// See sql/create-merch-sections.sql.

"use client";

import { useEffect, useState } from "react";

interface Store {
  name: string;
  description: string;
  url: string;
}

interface MerchIntroData {
  heading: string;
  subhead: string;
}

interface MerchStoresData {
  stores: Store[];
}

const DEFAULT_INTRO: MerchIntroData = {
  heading: "Support The Dialogues",
  subhead: "Find our latest vinyl drops and official merchandise across our various marketplaces.",
};

const DEFAULT_STORES: MerchStoresData = { stores: [] };

const inputClass =
  "w-full bg-white text-gray-900 border border-gray-300 px-3 py-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none";
const labelClass = "block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide";

interface Row<T> {
  id: number | null;
  data: T;
}

export default function EditMerchPage() {
  const [loading, setLoading] = useState(true);
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [intro, setIntro] = useState<Row<MerchIntroData>>({ id: null, data: DEFAULT_INTRO });
  const [stores, setStores] = useState<Row<MerchStoresData>>({ id: null, data: DEFAULT_STORES });
  const [savingIntro, setSavingIntro] = useState(false);
  const [savingStores, setSavingStores] = useState(false);
  const [savedIntro, setSavedIntro] = useState(false);
  const [savedStores, setSavedStores] = useState(false);

  useEffect(() => {
    fetch("/api/homepage-sections?page=merch")
      .then(async (res) => {
        if (!res.ok) {
          setMigrationMissing(true);
          return [];
        }
        return res.json();
      })
      .then((rows: { id: number; section_type: string; data: Record<string, unknown> }[]) => {
        if (!Array.isArray(rows) || rows.length === 0) {
          setMigrationMissing(true);
          return;
        }
        const introRow = rows.find((r) => r.section_type === "merch_intro");
        if (introRow) setIntro({ id: introRow.id, data: { ...DEFAULT_INTRO, ...introRow.data } });
        const storesRow = rows.find((r) => r.section_type === "merch_stores");
        if (storesRow) setStores({ id: storesRow.id, data: { ...DEFAULT_STORES, ...storesRow.data } });
      })
      .catch((err) => {
        console.error("Error loading merch sections:", err);
        setMigrationMissing(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const saveIntro = async () => {
    if (!intro.id) return;
    setSavingIntro(true);
    setSavedIntro(false);
    try {
      const res = await fetch(`/api/homepage-sections/${intro.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: intro.data }),
      });
      if (res.ok) setSavedIntro(true);
    } catch (err) {
      console.error("Error saving merch intro:", err);
    } finally {
      setSavingIntro(false);
    }
  };

  const saveStores = async () => {
    if (!stores.id) return;
    setSavingStores(true);
    setSavedStores(false);
    try {
      const res = await fetch(`/api/homepage-sections/${stores.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: stores.data }),
      });
      if (res.ok) setSavedStores(true);
    } catch (err) {
      console.error("Error saving merch stores:", err);
    } finally {
      setSavingStores(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-600">Loading…</div>;
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-gray-900">Edit Merch Page</h1>
      <p className="text-sm text-gray-600 mb-6">Edit the intro text and the list of store links shown on /merch.</p>

      {migrationMissing && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-4 mb-6 text-sm">
          The Merch page&rsquo;s content rows don&rsquo;t exist yet, so this page is showing defaults it can&rsquo;t
          save. Run <code>sql/create-merch-sections.sql</code> in the Supabase SQL editor, then reload this page.
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Intro</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Heading</label>
            <input
              className={inputClass}
              value={intro.data.heading}
              onChange={(e) => setIntro({ ...intro, data: { ...intro.data, heading: e.target.value } })}
            />
          </div>
          <div>
            <label className={labelClass}>Subhead</label>
            <textarea
              className={inputClass}
              rows={2}
              value={intro.data.subhead}
              onChange={(e) => setIntro({ ...intro, data: { ...intro.data, subhead: e.target.value } })}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={saveIntro}
            disabled={savingIntro}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {savingIntro ? "Saving…" : "Save"}
          </button>
          {savedIntro && <span className="text-sm text-green-600 font-medium">Saved</span>}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Stores</h2>
        <div className="space-y-4">
          {stores.data.stores.map((store, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <label className={labelClass}>Store {i + 1}</label>
                <button
                  onClick={() => {
                    const next = stores.data.stores.filter((_, idx) => idx !== i);
                    setStores({ ...stores, data: { stores: next } });
                  }}
                  className="text-red-600 hover:text-red-800 text-sm"
                  aria-label={`Remove ${store.name}`}
                >
                  ✕ Remove
                </button>
              </div>
              <input
                className={inputClass}
                placeholder="Name"
                value={store.name}
                onChange={(e) => {
                  const next = [...stores.data.stores];
                  next[i] = { ...next[i], name: e.target.value };
                  setStores({ ...stores, data: { stores: next } });
                }}
              />
              <input
                className={inputClass}
                placeholder="Description"
                value={store.description}
                onChange={(e) => {
                  const next = [...stores.data.stores];
                  next[i] = { ...next[i], description: e.target.value };
                  setStores({ ...stores, data: { stores: next } });
                }}
              />
              <input
                className={inputClass}
                placeholder="URL"
                value={store.url}
                onChange={(e) => {
                  const next = [...stores.data.stores];
                  next[i] = { ...next[i], url: e.target.value };
                  setStores({ ...stores, data: { stores: next } });
                }}
              />
            </div>
          ))}
        </div>
        <button
          onClick={() =>
            setStores({ ...stores, data: { stores: [...stores.data.stores, { name: "", description: "", url: "" }] } })
          }
          className="mt-3 text-sm text-blue-600 hover:underline"
        >
          + Add store
        </button>
        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={saveStores}
            disabled={savingStores}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {savingStores ? "Saving…" : "Save"}
          </button>
          {savedStores && <span className="text-sm text-green-600 font-medium">Saved</span>}
        </div>
      </div>
    </div>
  );
}
