// src/app/edit-collection/components/ImportSelectionModal.tsx
// Modal for selecting which type of import to perform

'use client';

import React from 'react';

interface ImportSelectionModalProps {
  onSelectImportType: (type: 'csv' | 'discogs' | 'clz' | 'enrich') => void;
  onCancel: () => void;
}

export default function ImportSelectionModal({
  onSelectImportType,
  onCancel,
}: ImportSelectionModalProps) {
  return (
    <div className="fixed inset-0 bg-white z-[10000] flex flex-col overflow-hidden">
      {/* Black Header Bar */}
      <div className="bg-[#2A2A2A] text-white px-6 py-3.5 flex items-center justify-between shrink-0">
        <button
          onClick={onCancel}
          className="bg-transparent border-none text-white cursor-pointer text-[15px] flex items-center gap-2 p-0 hover:text-gray-300"
        >
          ◀ Back
        </button>
        <div className="text-base font-medium text-white">Import Data</div>
        <button
          onClick={onCancel}
          className="bg-transparent border-none text-white text-[28px] cursor-pointer leading-none p-0 hover:text-gray-300"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-white p-6">
        <div className="max-w-[1000px] mx-auto">
          <p className="text-[15px] text-[#666] mb-6">
            Select the type of data you want to import or enrich:
          </p>

          <div className="flex flex-col gap-3">
            {/* CSV Import */}
            <button
              onClick={() => onSelectImportType('csv')}
              className="w-full text-left bg-white border-2 border-[#D8D8D8] rounded-md p-5 cursor-pointer transition-all duration-200 hover:border-[#4FC3F7] hover:bg-[#F0F9FF] group"
            >
              <div className="flex items-start">
                <div className="shrink-0 w-12 h-12 bg-[#E8F5E9] rounded-lg flex items-center justify-center mr-4">
                  <span className="text-2xl">📄</span>
                </div>
                <div className="flex-1">
                  <h3 className="m-0 mb-1.5 text-base font-semibold text-[#1a1a1a]">
                    CSV Import
                  </h3>
                  <p className="m-0 text-sm text-[#666]">
                    Import album data from a CSV file with format parsing
                  </p>
                </div>
              </div>
            </button>

            {/* Discogs Import */}
            <button
              onClick={() => onSelectImportType('discogs')}
              className="w-full text-left bg-white border-2 border-[#D8D8D8] rounded-md p-5 cursor-pointer transition-all duration-200 hover:border-[#4FC3F7] hover:bg-[#F0F9FF] group"
            >
              <div className="flex items-start">
                <div className="shrink-0 w-12 h-12 bg-[#E3F2FD] rounded-lg flex items-center justify-center mr-4">
                  <span className="text-2xl">💿</span>
                </div>
                <div className="flex-1">
                  <h3 className="m-0 mb-1.5 text-base font-semibold text-[#1a1a1a]">
                    Discogs CSV Import
                  </h3>
                  <p className="m-0 text-sm text-[#666]">
                    Import your collection from a Discogs CSV export
                  </p>
                </div>
              </div>
            </button>

            {/* CLZ Import */}
            <button
              onClick={() => onSelectImportType('clz')}
              className="w-full text-left bg-white border-2 border-[#D8D8D8] rounded-md p-5 cursor-pointer transition-all duration-200 hover:border-[#4FC3F7] hover:bg-[#F0F9FF] group"
            >
              <div className="flex items-start">
                <div className="shrink-0 w-12 h-12 bg-[#F3E5F5] rounded-lg flex items-center justify-center mr-4">
                  <span className="text-2xl">📦</span>
                </div>
                <div className="flex-1">
                  <h3 className="m-0 mb-1.5 text-base font-semibold text-[#1a1a1a]">
                    CLZ Music Web Import
                  </h3>
                  <p className="m-0 text-sm text-[#666]">
                    Import your collection from CLZ Music Web CSV/XML export
                  </p>
                </div>
              </div>
            </button>

            {/* Enrich Existing */}
            <button
              onClick={() => onSelectImportType('enrich')}
              className="w-full text-left bg-white border-2 border-[#D8D8D8] rounded-md p-5 cursor-pointer transition-all duration-200 hover:border-[#4FC3F7] hover:bg-[#F0F9FF] group"
            >
              <div className="flex items-start">
                <div className="shrink-0 w-12 h-12 bg-[#FFF3E0] rounded-lg flex items-center justify-center mr-4">
                  <span className="text-2xl">⚡</span>
                </div>
                <div className="flex-1">
                  <h3 className="m-0 mb-1.5 text-base font-semibold text-[#1a1a1a]">
                    Enrich Existing Albums
                  </h3>
                  <p className="m-0 text-sm text-[#666]">
                    Add missing metadata to existing albums using Discogs
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}