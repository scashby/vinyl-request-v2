// src/app/edit-collection/components/EnrichmentReviewModal.tsx
'use client';

import React from 'react';

interface EnrichmentReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EnrichmentReviewModal({ isOpen, onClose }: EnrichmentReviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[30000] flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-[540px] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-lg font-semibold text-gray-900 mb-2">Enrichment Review</div>
        <div className="text-sm text-gray-600 mb-4">
          There are no pending enrichment conflicts to review right now.
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
