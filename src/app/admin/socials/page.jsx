'use client';

import { useEffect, useState } from "react";

export default function AdminSocialEmbedsPage() {
  const [embeds, setEmbeds] = useState([]);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    fetch("/api/social-embeds")
      .then(res => res.json())
      .then(data => setEmbeds(data));
  }, []);

  const updateEmbed = async (index) => {
    setSaving(index);
    const body = embeds[index];
    const res = await fetch("/api/social-embeds", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setSaving(null);
    }
  };

  const handleChange = (index, key, value) => {
    const updated = [...embeds];
    updated[index][key] = value;
    setEmbeds(updated);
  };

  return (
    <div className="admin-social-embeds-wrapper">
      <h1>Edit Social Embeds</h1>
      <table className="w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr><th>Platform</th><th>Embed Code</th><th>Visible</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {embeds.map((e, i) => (
            <tr key={e.id}>
              <td>
                <input
                  type="text"
                  value={e.platform}
                  readOnly
                  className="bg-gray-100 text-gray-600 border border-gray-300 px-2 py-1 w-full cursor-not-allowed"
                />
              </td>
              <td>
                <textarea
                  value={e.embed_html}
                  onChange={(e2) => handleChange(i, "embed_html", e2.target.value)}
                  className="bg-white text-black border border-gray-300 px-2 py-1 w-full"
                  rows={4}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={e.visible}
                  onChange={(e2) => handleChange(i, "visible", e2.target.checked)}
                />
              </td>
              <td>
                <button
                  onClick={() => updateEmbed(i)}
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
