'use client';

import type { Album } from 'types/album';

interface LinksTabProps {
  album: Album;
  onChange: (field: keyof Album, value: unknown) => void;
}

export function LinksTab({ album, onChange }: LinksTabProps) {
  const links = Array.isArray(album.custom_links) ? album.custom_links : [];
  const rows = links.length > 0 ? links : [{ url: '', description: '' }];

  const updateRow = (index: number, field: 'url' | 'description', value: string) => {
    const next = rows.map((row, idx) => (idx === index ? { ...row, [field]: value } : row));
    onChange('custom_links', next);
  };

  const handleAddRow = () => {
    const next = [...rows, { url: '', description: '' }];
    onChange('custom_links', next);
  };

  return (
    <div className="p-4">
      <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
        <div className="grid grid-cols-[32px_1fr_1fr] bg-gray-100 border-b border-gray-200 text-[12px] font-semibold text-gray-500">
          <div className="px-2 py-2" />
          <div className="px-3 py-2">URL</div>
          <div className="px-3 py-2">Description</div>
        </div>

        <div className="divide-y divide-gray-200">
          {rows.map((row, idx) => (
            <div key={`${idx}`} className="grid grid-cols-[32px_1fr_1fr] items-center">
              <div className="px-2 py-2 flex items-center justify-center">
                <input type="checkbox" className="cursor-pointer" />
              </div>
              <div className="px-2 py-2">
                <input
                  type="text"
                  value={row.url || ''}
                  onChange={(e) => updateRow(idx, 'url', e.target.value)}
                  placeholder="https://..."
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="px-2 py-2">
                <input
                  type="text"
                  value={row.description || ''}
                  onChange={(e) => updateRow(idx, 'description', e.target.value)}
                  placeholder=""
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end mt-3">
        <button
          onClick={handleAddRow}
          className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded text-[12px] font-semibold text-gray-700 hover:bg-gray-200"
        >
          + New Link
        </button>
      </div>
    </div>
  );
}
// AUDIT: updated for CLZ-style links table and V3 storage.
