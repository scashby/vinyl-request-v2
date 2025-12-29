// src/components/UnknownFormatElementModal.tsx
// Modal for handling unknown format abbreviations during import

'use client';

import React, { useState } from 'react';
import { UnknownElement } from 'lib/formatParser';

interface UnknownFormatElementModalProps {
  unknownElement: UnknownElement;
  onAdd: (category: string, fullName: string) => void;
  onSkipItem: () => void;
  onSkipAll: () => void;
  onCancel: () => void;
}

const CATEGORY_OPTIONS = [
  { value: 'pressing_plant', label: 'Pressing Plant' },
  { value: 'color', label: 'Color' },
  { value: 'edition', label: 'Edition' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'cassette_feature', label: 'Cassette Feature' },
  { value: 'cd_feature', label: 'CD Feature' },
  { value: 'vinyl_material', label: 'Vinyl Material' },
  { value: 'sound', label: 'Sound' },
  { value: 'other', label: 'Other' },
];

export default function UnknownFormatElementModal({
  unknownElement,
  onAdd,
  onSkipItem,
  onSkipAll,
  onCancel,
}: UnknownFormatElementModalProps) {
  const [category, setCategory] = useState('pressing_plant');
  const [fullName, setFullName] = useState('');

  const handleAdd = () => {
    if (fullName.trim()) {
      onAdd(category, fullName.trim());
      setFullName('');
    }
  };

  const handleViewOnDiscogs = () => {
    if (unknownElement.albumInfo?.discogsReleaseId) {
      window.open(
        `https://www.discogs.com/release/${unknownElement.albumInfo.discogsReleaseId}`,
        '_blank'
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gray-100 px-6 py-4 border-b border-gray-300">
          <h2 className="text-xl font-semibold text-gray-900">
            Unknown Format Element Found
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-6">
          {/* Album Info */}
          {unknownElement.albumInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="font-semibold text-gray-900 mb-1">
                Album: {unknownElement.albumInfo.artist} - {unknownElement.albumInfo.title}
              </div>
              {unknownElement.albumInfo.discogsReleaseId && (
                <div className="text-sm text-gray-600">
                  Discogs Release ID: {unknownElement.albumInfo.discogsReleaseId}
                </div>
              )}
            </div>
          )}

          {/* Format String */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Full Format String:
            </label>
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-3 font-mono text-sm">
              {unknownElement.fullFormatString}
            </div>
          </div>

          {/* Unknown Element */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Unknown Element:
            </label>
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 font-mono text-sm font-bold text-yellow-900">
              {unknownElement.element}
            </div>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              What type is this?
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Full Name Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Full Name/Description:
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g., Winchester Pressing"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && fullName.trim()) {
                  handleAdd();
                }
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-100 px-6 py-4 border-t border-gray-300 flex flex-wrap gap-3 justify-end">
          {unknownElement.albumInfo?.discogsReleaseId && (
            <button
              onClick={handleViewOnDiscogs}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View on Discogs
            </button>
          )}
          <button
            onClick={handleAdd}
            disabled={!fullName.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Add to Database
          </button>
          <button
            onClick={onSkipItem}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
          >
            Skip This Item
          </button>
          <button
            onClick={onSkipAll}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            Skip All Unknown
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Cancel Import
          </button>
        </div>
      </div>
    </div>
  );
}