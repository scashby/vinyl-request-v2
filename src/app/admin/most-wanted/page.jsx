"use client";

import { useEffect, useState } from "react";

export default function AdminMostWantedPage() {
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    fetch("/api/most-wanted")
      .then(res => res.json())
      .then(data => setItems(data));
  }, []);

  const updateItem = async (index) => {
    setSaving(index);
    const res = await fetch("/api/most-wanted", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(items[index]),
    });
    if (res.ok) setSaving(null);
  };

  const handleChange = (index, key, value) => {
    const updated = [...items];
    updated[index][key] = value;
    setItems(updated);
  };

  return (
    <div className="admin-mostwanted-wrapper">
      <h1>Edit Most Wanted List</h1>
      <table className="w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr><th>Rank</th><th>Title</th><th>URL</th><th>Save</th></tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id}>
              <td>
                <input
                  type="number"
                  value={item.rank}
                  onChange={(e) => handleChange(i, "rank", parseInt(e.target.value))}
                  className="w-16 bg-white text-black border border-gray-300 px-2 py-1"
                />
              </td>
              <td>
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => handleChange(i, "title", e.target.value)}
                  className="w-full bg-white text-black border border-gray-300 px-2 py-1"
                />
              </td>
              <td>
                <input
                  type="text"
                  value={item.url}
                  onChange={(e) => handleChange(i, "url", e.target.value)}
                  className="w-full bg-white text-black border border-gray-300 px-2 py-1"
                />
              </td>
              <td>
                <button
                  onClick={() => updateItem(i)}
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
