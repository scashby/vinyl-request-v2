"use client";

import { useEffect, useState } from "react";

export default function AdminPlaylistsPage() {
  const [playlists, setPlaylists] = useState([]);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    fetch("/api/playlists")
      .then(res => res.json())
      .then(data => setPlaylists(data));
  }, []);

  const updatePlaylist = async (index) => {
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

  const handleChange = (index, key, value) => {
    const updated = [...playlists];
    updated[index][key] = value;
    setPlaylists(updated);
  };

  return (
    <div className="admin-playlists-wrapper">
      <h1>Edit Embedded Playlists</h1>
      <table className="w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr><th>Platform</th><th>Embed Code</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {playlists.map((p, i) => (
            <tr key={p.id}>
              <td>
                <input
                  type="text"
                  value={p.platform}
                  readOnly
                  className="bg-gray-100 text-gray-600 border border-gray-300 px-2 py-1 w-full cursor-not-allowed"
                />
              </td>
              <td>
                <textarea
                  value={p.embed_url}
                  onChange={(e) => handleChange(i, "embed_url", e.target.value)}
                  className="bg-white text-black border border-gray-300 px-2 py-1 w-full"
                  rows={4}
                />
              </td>
              <td>
                <button
                  onClick={() => updatePlaylist(i)}
                  disabled={saving === i}
                  className="bg-blue-600 text-white px-3 py-1 rounded"
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
