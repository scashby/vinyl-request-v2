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
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/most-wanted")
      .then(res => res.json())
      .then(data => setItems(data));
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
    // @ts-expect-error - Dynamic assignment
    updated[index][key] = value;
    setItems(updated);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Edit Most Wanted List</h1>
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
                  onChange={(e) => handleChange(i, "rank", parseInt(e.target.value))}
                  className="w-16 bg-white text-black border border-gray-300 px-3 py-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </td>
              <td className="py-3 px-2">
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => handleChange(i, "title", e.target.value)}
                  className="w-full bg-white text-black border border-gray-300 px-3 py-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </td>
              <td className="py-3 px-2">
                <input
                  type="text"
                  value={item.url}
                  onChange={(e) => handleChange(i, "url", e.target.value)}
                  className="w-full bg-white text-black border border-gray-300 px-3 py-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </td>
              <td className="py-3 px-2">
                <button
                  onClick={() => updateItem(i)}
                  disabled={saving === i}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {saving === i ? "..." : "Save"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}