// src/app/edit-collection/pickers/MergeModal.tsx
'use client';

import { useState, useEffect } from 'react';

interface MergeItem {
  id: string;
  name: string;
  count?: number;
}

interface MergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: MergeItem[];
  onMerge: (primaryId: string, mergeIntoIds: string[]) => void;
  itemLabel?: string;
}

export function MergeModal({
  isOpen,
  onClose,
  title,
  items,
  onMerge,
  itemLabel = 'Item',
}: MergeModalProps) {
  const [primaryId, setPrimaryId] = useState<string>('');

  useEffect(() => {
    if (isOpen && items.length > 0 && !primaryId) {
      // Default to first item (sorted by count desc)
      const sorted = [...items].sort((a, b) => (b.count || 0) - (a.count || 0));
      setPrimaryId(sorted[0].id);
    }
  }, [isOpen, items, primaryId]);

  useEffect(() => {
    if (!isOpen) {
      setPrimaryId('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sortedItems = [...items].sort((a, b) => {
    const countDiff = (b.count || 0) - (a.count || 0);
    if (countDiff !== 0) return countDiff;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  const primaryItem = sortedItems.find(item => item.id === primaryId);
  const totalCount = sortedItems.reduce((sum, item) => sum + (item.count || 0), 0);

  const handleMerge = () => {
    if (!primaryId) return;
    
    const mergeIntoIds = sortedItems
      .filter(item => item.id !== primaryId)
      .map(item => item.id);
    
    onMerge(primaryId, mergeIntoIds);
    onClose();
  };

  const handleCancel = () => {
    setPrimaryId('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30004] p-4"
      onClick={handleCancel}
    >
      <div
        className="bg-white rounded-lg w-full max-w-[550px] h-[600px] max-h-[90vh] flex flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-white">
          <h3 className="m-0 text-base font-semibold text-gray-900">
            {title}
          </h3>
          <button
            onClick={handleCancel}
            className="bg-transparent border-none text-gray-500 text-xl cursor-pointer p-1 leading-none hover:text-gray-700"
          >
            ×
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
          <div className="text-[13px] font-medium text-amber-800 mb-1">
            Merging {items.length} {itemLabel.toLowerCase()}s
          </div>
          <div className="text-xs text-amber-700">
            Select which {itemLabel.toLowerCase()} should be kept. All albums from the other {itemLabel.toLowerCase()}s will be moved to it.
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-2.5 text-[13px] font-medium text-gray-700">
            Select Primary {itemLabel}:
          </div>
          
          <div className="flex flex-col gap-1">
            {sortedItems.map((item) => {
              const isPrimary = primaryId === item.id;

              return (
                <label
                  key={item.id}
                  className={`flex items-center justify-between p-2.5 cursor-pointer rounded border transition-colors ${
                    isPrimary 
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' 
                      : 'border-transparent hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1">
                    <input
                      type="radio"
                      name="primary"
                      checked={isPrimary}
                      onChange={() => setPrimaryId(item.id)}
                      className="w-4 h-4 cursor-pointer m-0 accent-blue-600"
                    />
                    <span className={`text-[13px] text-gray-900 ${isPrimary ? 'font-semibold' : 'font-normal'}`}>
                      {item.name}
                    </span>
                  </div>
                  {item.count !== undefined && (
                    <span className="text-[13px] text-gray-500 font-normal">
                      {item.count} album{item.count !== 1 ? 's' : ''}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>

        {/* Preview Section */}
        <div className="px-4 py-3 bg-gray-50 border-t border-b border-gray-200">
          <div className="text-[13px] font-semibold text-gray-900 mb-2">
            After Merge:
          </div>
          <div className="p-2.5 bg-white rounded border border-gray-300 flex justify-between items-center">
            <span className="text-[13px] font-medium text-gray-900">
              {primaryItem?.name || 'Select a primary item'}
            </span>
            <span className="text-[13px] text-gray-500">
              {totalCount} album{totalCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="mt-1.5 text-[11px] text-gray-500">
            The other {items.length - 1} {itemLabel.toLowerCase()}{items.length - 1 !== 1 ? 's' : ''} will be deleted.
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 flex justify-end gap-2 bg-white">
          <button
            onClick={handleCancel}
            className="px-4 py-1.5 bg-gray-200 text-gray-700 border-none rounded text-[13px] font-medium cursor-pointer hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleMerge}
            disabled={!primaryId}
            className={`px-4 py-1.5 border-none rounded text-[13px] font-semibold text-white ${
              primaryId 
                ? 'bg-red-500 cursor-pointer hover:bg-red-600' 
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            Merge {itemLabel}s
          </button>
        </div>
      </div>
    </div>
  );
}