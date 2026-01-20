"use client";

import { useEffect, useState } from "react";

interface Playlist {
  id: number;
  platform: string;
  embed_url: string;
  sort_order?: number;
}

export default function AdminPlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/playlists")
      .then(res => res.json())
      .then(data => setPlaylists(data));
  }, []);

  const updatePlaylist = async (index: number) => {
    setSaving(index);
    const body = playlists[index];
    const res = await fetch("/api/playlists", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setSaving(null);
    }
  };

  const handleChange = (index: number, key: keyof Playlist, value: string) => {
    const updated = [...playlists];
    // @ts-ignore - Dynamic key assignment
    updated[index][key] = value;
    setPlaylists(updated);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Edit Embedded Playlists</h1>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-3 px-2 text-sm font-semibold text-gray-700">Platform</th>
            <th className="py-3 px-2 text-sm font-semibold text-gray-700">Embed Code / URL</th>
            <th className="py-3 px-2 text-sm font-semibold text-gray-700 w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          {playlists.map((p, i) => (
            <tr key={p.id} className="border-b border-gray-100 last:border-0">
              <td className="py-3 px-2 align-top w-48">
                <input
                  type="text"
                  value={p.platform}
                  readOnly
                  className="bg-gray-100 text-gray-600 border border-gray-300 px-3 py-2 rounded w-full cursor-not-allowed text-sm"
                />
              </td>
              <td className="py-3 px-2">
                <textarea
                  value={p.embed_url || ''}
                  onChange={(e) => handleChange(i, "embed_url", e.target.value)}
                  className="bg-white text-black border border-gray-300 px-3 py-2 rounded w-full text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={4}
                />
              </td>
              <td className="py-3 px-2 align-top">
                <button
                  onClick={() => updatePlaylist(i)}
                  disabled={saving === i}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {saving === i ? "Saving..." : "Save"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}