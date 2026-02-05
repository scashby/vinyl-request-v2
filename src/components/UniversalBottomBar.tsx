// components/UniversalBottomBar.tsx
'use client';

import type { Album } from 'types/album';

interface UniversalBottomBarProps {
  album: Album;
  onChange: <K extends keyof Album>(field: K, value: Album[K]) => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onCancel: () => void;
  onSave: () => void;
  onOpenLocationPicker?: () => void;
}

export function UniversalBottomBar({ 
  album, 
  onChange, 
  onPrevious, 
  onNext,
  hasPrevious = true,
  hasNext = true,
  onCancel, 
  onSave,
  onOpenLocationPicker,
}: UniversalBottomBarProps) {
  return (
    <div>
      <div className="bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_2fr] gap-4 items-end">
        {/* Collection Status */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Collection Status</label>
          <select
            value={album.collection_status || 'in_collection'}
            onChange={(e) => onChange('collection_status', e.target.value)}
            className="w-full px-2.5 py-2 border border-gray-300 rounded text-[13px] bg-white text-gray-900 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <optgroup label="Collection">
              <option value="in_collection">In Collection</option>
              <option value="for_sale">For Sale</option>
            </optgroup>
            <optgroup label="Wish List">
              <option value="wish_list">On Wish List</option>
              <option value="on_order">On Order</option>
            </optgroup>
            <optgroup label="Not in Collection">
              <option value="sold">Sold</option>
              <option value="not_in_collection">Not in Collection</option>
            </optgroup>
          </select>
        </div>

        {/* Index */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Index</label>
          <input
            type="number"
            value={album.index_number || ''}
            onChange={(e) => onChange('index_number', e.target.value ? parseInt(e.target.value) : null)}
            placeholder="Index number"
            className="w-full px-2.5 py-2 border border-gray-300 rounded text-[13px] bg-white text-gray-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Quantity</label>
          <input
            type="number"
            min="1"
            value={album.sale_quantity || 1}
            onChange={(e) => onChange('sale_quantity', e.target.value ? parseInt(e.target.value) : 1)}
            className="w-full px-2.5 py-2 border border-gray-300 rounded text-[13px] bg-white text-gray-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Location</label>
          <div className="flex items-stretch">
            <input
              type="text"
              value={album.location || ''}
              onChange={(e) => onChange('location', e.target.value)}
              placeholder="Storage location"
              className="flex-1 px-2.5 py-2 border border-gray-300 rounded-l text-[13px] bg-white text-gray-900 focus:outline-none focus:border-blue-500 border-r-0"
            />
            <button 
              onClick={onOpenLocationPicker}
              className="w-9 flex items-center justify-center border border-gray-300 rounded-r bg-white text-gray-500 hover:bg-gray-50"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <circle cx="1.5" cy="2.5" r="1"/>
                <rect x="4" y="2" width="10" height="1"/>
                <circle cx="1.5" cy="7" r="1"/>
                <rect x="4" y="6.5" width="10" height="1"/>
                <circle cx="1.5" cy="11.5" r="1"/>
                <rect x="4" y="11" width="10" height="1"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom buttons row */}
      <div className="flex justify-between items-center px-4 py-3 border-t border-gray-200 bg-white">
        {/* Left: Previous/Next */}
        <div className="flex gap-2">
          <button
            onClick={onPrevious}
            disabled={!hasPrevious}
            className={`px-4 py-2 border-none rounded text-[13px] font-medium transition-colors ${
              hasPrevious 
                ? 'bg-gray-500 text-white hover:bg-gray-600 cursor-pointer' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'
            }`}
          >
            ◀ Previous
          </button>
          <button
            onClick={onNext}
            disabled={!hasNext}
            className={`px-4 py-2 border-none rounded text-[13px] font-medium transition-colors ${
              hasNext 
                ? 'bg-gray-500 text-white hover:bg-gray-600 cursor-pointer' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'
            }`}
          >
            Next ▶
          </button>
        </div>

        {/* Right: Cancel/Save */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-5 py-2 bg-gray-300 text-gray-800 border-none rounded text-[13px] font-medium cursor-pointer hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-5 py-2 bg-blue-500 text-white border-none rounded text-[13px] font-bold cursor-pointer hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
// AUDIT: updated for UI parity with CLZ reference.
