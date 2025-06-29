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
      <table>
        <thead>
          <tr><th>Platform</th><th>Embed URL</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {playlists.map((p, i) => (
            <tr key={p.platform}>
              <td>
                <input
                  type="text"
                  value={p.platform}
                  onChange={(e) => handleChange(i, "platform", e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={p.embed_url}
                  onChange={(e) => handleChange(i, "embed_url", e.target.value)}
                />
              </td>
              <td>
                <button onClick={() => updatePlaylist(i)} disabled={saving === i}>
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
