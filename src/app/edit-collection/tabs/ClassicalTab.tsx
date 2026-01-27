'use client';

import type { Album } from 'types/album';

interface ClassicalTabProps {
  album: Album;
  onChange: (field: keyof Album, value: string | number | null) => void;
}

export function ClassicalTab({ album, onChange }: ClassicalTabProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
      {/* Left Column */}
      <div className="flex flex-col gap-4">
        {/* Chorus */}
        <div>
          <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Chorus</label>
          <input
            type="text"
            value={album.chorus || ''}
            onChange={(e) => onChange('chorus', e.target.value)}
            className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Composer */}
        <div>
          <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Composer</label>
          <input
            type="text"
            value={album.composer || ''}
            onChange={(e) => onChange('composer', e.target.value)}
            className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Composition */}
        <div>
          <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Composition</label>
          <input
            type="text"
            value={album.composition || ''}
            onChange={(e) => onChange('composition', e.target.value)}
            className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Right Column */}
      <div className="flex flex-col gap-4">
        {/* Conductor */}
        <div>
          <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Conductor</label>
          <input
            type="text"
            value={album.conductor || ''}
            onChange={(e) => onChange('conductor', e.target.value)}
            className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Orchestra */}
        <div>
          <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Orchestra</label>
          <input
            type="text"
            value={album.orchestra || ''}
            onChange={(e) => onChange('orchestra', e.target.value)}
            className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
}