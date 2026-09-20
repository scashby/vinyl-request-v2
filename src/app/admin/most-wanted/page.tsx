// src/app/admin/most-wanted/page.tsx - Admin interface for editing the
// About page's "Most Wanted" list (src/app/about/page.tsx, /api/most-wanted).
// Restored 2026-09-20: this page (and its AdminSidebar nav entry) was
// accidentally deleted in Jan 2026 alongside genuinely experimental DJ/
// enrichment tools, cutting off editing even though the list itself stayed
// live on the About page the whole time.

"use client";

import { useEffect, useState } from "react";

interface MostWantedItem {
  id: number;
  rank: number;
  title: string;
  url: string;
}

export default function AdminMostWantedPage() {
  const [items, setItems] = useState<MostWantedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/most-wanted")
      .then((res) => res.json())
      .then((data) => setItems(data))
      .finally(() => setLoading(false));
  }, []);

  const updateItem = async (index: number) => {
    setSaving(index);
    const res = await fetch("/api/most-wanted", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(items[index]),
    });
    if (res.ok) setSaving(null);
  };

  const handleChange = (index: number, key: keyof MostWantedItem, value: string | number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [key]: value };
    setItems(updated);
  };

  if (loading) {
    return <div className="p-8 text-gray-600">Loading…</div>;
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-gray-900">Edit Most Wanted List</h1>
      <p className="text-sm text-gray-600 mb-6">
        Shown in the sidebar on the About page. Rank controls display order (lowest first).
      </p>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-3 px-2 text-sm font-semibold text-gray-700 w-20">Rank</th>
              <th className="py-3 px-2 text-sm font-semibold text-gray-700">Title</th>
              <th className="py-3 px-2 text-sm font-semibold text-gray-700">URL</th>
              <th className="py-3 px-2 text-sm font-semibold text-gray-700 w-24">Save</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="py-3 px-2">
                  <input
                    type="number"
                    value={item.rank}
                    onChange={(e) => handleChange(i, "rank", parseInt(e.target.value, 10))}
                    className="w-16 bg-white text-gray-900 border border-gray-300 px-3 py-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </td>
                <td className="py-3 px-2">
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => handleChange(i, "title", e.target.value)}
                    className="w-full bg-white text-gray-900 border border-gray-300 px-3 py-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </td>
                <td className="py-3 px-2">
                  <input
                    type="text"
                    value={item.url}
                    onChange={(e) => handleChange(i, "url", e.target.value)}
                    className="w-full bg-white text-gray-900 border border-gray-300 px-3 py-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </td>
                <td className="py-3 px-2">
                  <button
                    onClick={() => updateItem(i)}
                    disabled={saving === i}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {saving === i ? "…" : "Save"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
