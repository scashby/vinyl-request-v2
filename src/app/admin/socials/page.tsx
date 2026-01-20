'use client';

import { useEffect, useState } from "react";

interface SocialEmbed {
  id: number;
  platform: string;
  embed_html: string;
  visible: boolean;
}

export default function AdminSocialEmbedsPage() {
  const [embeds, setEmbeds] = useState<SocialEmbed[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/social-embeds")
      .then(res => res.json())
      .then(data => setEmbeds(data));
  }, []);

  const updateEmbed = async (index: number) => {
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

  const handleChange = (index: number, key: keyof SocialEmbed, value: string | boolean) => {
    const updated = [...embeds];
    // @ts-expect-error - Dynamic key assignment
    updated[index][key] = value;
    setEmbeds(updated);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Edit Social Embeds</h1>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-3 px-2 text-sm font-semibold text-gray-700 w-32">Platform</th>
            <th className="py-3 px-2 text-sm font-semibold text-gray-700">Embed Code</th>
            <th className="py-3 px-2 text-sm font-semibold text-gray-700 w-20 text-center">Visible</th>
            <th className="py-3 px-2 text-sm font-semibold text-gray-700 w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          {embeds.map((e, i) => (
            <tr key={e.id} className="border-b border-gray-100 last:border-0">
              <td className="py-3 px-2 align-top">
                <input
                  type="text"
                  value={e.platform}
                  readOnly
                  className="bg-gray-100 text-gray-600 border border-gray-300 px-3 py-2 rounded w-full cursor-not-allowed text-sm"
                />
              </td>
              <td className="py-3 px-2">
                <textarea
                  value={e.embed_html}
                  onChange={(e2) => handleChange(i, "embed_html", e2.target.value)}
                  className="bg-white text-black border border-gray-300 px-3 py-2 rounded w-full text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={4}
                />
              </td>
              <td className="py-3 px-2 text-center align-top">
                <input
                  type="checkbox"
                  checked={e.visible}
                  onChange={(e2) => handleChange(i, "visible", e2.target.checked)}
                  className="w-5 h-5 accent-blue-600"
                />
              </td>
              <td className="py-3 px-2 align-top">
                <button
                  onClick={() => updateEmbed(i)}
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