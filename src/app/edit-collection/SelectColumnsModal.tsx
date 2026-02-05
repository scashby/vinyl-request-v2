// src/app/edit-collection/SelectColumnsModal.tsx
'use client';

import { useState } from 'react';

interface SelectColumnsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialColumns: string[];
  onSave: (columns: string[], name?: string) => void;
}

const COLUMN_FIELDS = {
  Main: ['Artist', 'Artist Sort', 'Barcode', 'Cat No', 'Format', 'Genre', 'Label', 'Original Release Date', 'Original Release Year', 'Recording Date', 'Recording Year', 'Release Date', 'Release Year', 'Sort Title', 'Subtitle', 'Title'],
  Details: ['Box Set', 'Country', 'Extra', 'Is Live', 'Media Condition', 'Package/Sleeve Condition', 'Packaging', 'RPM', 'Sound', 'SPARS', 'Storage Device', 'Storage Device Slot', 'Studio', 'Vinyl Color', 'Vinyl Weight'],
  Edition: ['Discs', 'Length', 'Tracks'],
  Classical: ['Chorus', 'Composer', 'Composition', 'Conductor', 'Orchestra'],
  People: ['Engineer', 'Musician', 'Producer', 'Songwriter'],
  Personal: ['Added Date', 'Added Year', 'Collection Status', 'Current Value', 'Index', 'Last Cleaned Date', 'Last Cleaned Year', 'Last Played Date', 'Location', 'Modified Date', 'My Rating', 'Notes', 'Owner', 'Play Count', 'Played Year', 'Purchase Date', 'Purchase Price', 'Purchase Store', 'Purchase Year', 'Quantity', 'Signed by', 'Tags'],
  Loan: ['Due Date', 'Loan Date', 'Loaned To'],
};

export function SelectColumnsModal({ isOpen, onClose, initialColumns, onSave }: SelectColumnsModalProps) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>(initialColumns);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Main']));
  const [favoriteName, setFavoriteName] = useState('');

  if (!isOpen) return null;

  const toggleCategory = (category: string) => {
    const next = new Set(expandedCategories);
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }
    setExpandedCategories(next);
  };

  const toggleColumn = (column: string) => {
    if (selectedColumns.includes(column)) {
      setSelectedColumns(selectedColumns.filter(c => c !== column));
    } else {
      setSelectedColumns([...selectedColumns, column]);
    }
  };

  const handleSave = () => {
    onSave(selectedColumns, favoriteName || undefined);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[20000]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-[600px] max-h-[80vh] flex flex-col rounded-lg overflow-hidden shadow-xl"
      >
        {/* Orange Header */}
        <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] text-white px-5 py-4 flex items-center justify-between">
          <div className="text-base font-semibold">Select Column Fields</div>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-white text-2xl cursor-pointer leading-none p-0 hover:text-white/80"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto bg-white">
          {/* Name field */}
          <div className="mb-4">
            <label className="block text-[13px] font-semibold mb-1.5 text-gray-900">
              Name
            </label>
            <input
              type="text"
              value={favoriteName}
              onChange={(e) => setFavoriteName(e.target.value)}
              placeholder="Save as favorite..."
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm text-gray-900 outline-none focus:border-blue-400 transition-colors"
            />
          </div>

          <div className="text-sm font-semibold mb-3 text-gray-900">
            Columns
          </div>

          <input
            type="text"
            placeholder="🔍 Search columns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded mb-3 text-sm text-gray-900 outline-none focus:border-blue-400 transition-colors"
          />

          {Object.entries(COLUMN_FIELDS).map(([category, fields]) => (
            <div key={category} className="mb-2">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full px-3 py-2 bg-[#2A2A2A] text-white border-none rounded text-sm font-semibold cursor-pointer flex items-center justify-between hover:bg-[#3a3a3a] transition-colors"
              >
                <span>{category}</span>
                <span>{expandedCategories.has(category) ? '▼' : '▶'}</span>
              </button>
              {expandedCategories.has(category) && (
                <div className="py-2">
                  {fields
                    .filter(field => !searchQuery || field.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(field => (
                      <label
                        key={field}
                        className={`flex items-center px-3 py-1.5 cursor-pointer text-sm text-gray-900 rounded mb-0.5 transition-colors ${
                          selectedColumns.includes(field) ? 'bg-gray-100' : 'hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedColumns.includes(field)}
                          onChange={() => toggleColumn(field)}
                          className="mr-2.5 cursor-pointer accent-blue-500"
                        />
                        {field}
                      </label>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3 bg-white rounded-b-lg">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white text-gray-900 border border-gray-200 rounded text-sm cursor-pointer hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-[#4FC3F7] text-white border-none rounded text-sm font-medium cursor-pointer hover:bg-[#3fb0e3] transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}