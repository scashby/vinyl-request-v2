// src/app/edit-collection/pickers/ManageModal.tsx
'use client';

import { useState, useEffect } from 'react';

interface ManageItem {
  id: string;
  name: string;
  count?: number;
}

interface ManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: ManageItem[];
  onEdit: (itemId: string) => void;
  onDelete: (itemId: string) => void;
  onMerge: (itemIds: string[]) => void;
  itemLabel?: string;
  allowMerge?: boolean;
}

export function ManageModal({
  isOpen,
  onClose,
  title,
  items,
  onEdit,
  onDelete,
  onMerge,
  itemLabel = 'Item',
  allowMerge = true,
}: ManageModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setMergeMode(false);
      setSelectedForMerge([]);
      setDeleteConfirmId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedItems = [...filteredItems].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );

  const handleMergeToggle = () => {
    if (mergeMode) {
      setSelectedForMerge([]);
    }
    setMergeMode(!mergeMode);
  };

  const handleMergeSelection = (itemId: string) => {
    if (selectedForMerge.includes(itemId)) {
      setSelectedForMerge(selectedForMerge.filter(id => id !== itemId));
    } else {
      setSelectedForMerge([...selectedForMerge, itemId]);
    }
  };

  const handleMergeConfirm = () => {
    if (selectedForMerge.length >= 2) {
      onMerge(selectedForMerge);
      setMergeMode(false);
      setSelectedForMerge([]);
    }
  };

  const handleDeleteClick = (itemId: string) => {
    setDeleteConfirmId(itemId);
  };

  const handleDeleteConfirm = (itemId: string) => {
    onDelete(itemId);
    setDeleteConfirmId(null);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmId(null);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30002] p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-lg max-h-[90vh] flex flex-col overflow-hidden shadow-xl transition-all duration-300 ${
          mergeMode ? 'w-full max-w-[900px]' : 'w-full max-w-[600px]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className={`px-4 py-3 border-b border-gray-200 flex justify-between items-center ${
            mergeMode ? 'bg-amber-500 text-white' : 'bg-white text-gray-900'
          }`}
        >
          <h3 className="m-0 text-base font-semibold">
            {title}
          </h3>
          <button
            onClick={onClose}
            className={`bg-transparent border-none text-xl cursor-pointer p-1 leading-none ${
              mergeMode ? 'text-white hover:text-white/80' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            ×
          </button>
        </div>

        {/* Search + Merge Mode Toggle */}
        <div className="px-4 py-3 border-b border-gray-200 flex gap-2 items-center bg-white">
          <input
            type="text"
            placeholder={`Search ${itemLabel}s...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-[13px] outline-none text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          {allowMerge && (
            <button
              onClick={handleMergeToggle}
              className={`px-3 py-1.5 border-none rounded text-[13px] font-medium cursor-pointer whitespace-nowrap text-white ${
                mergeMode ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-500 hover:bg-gray-600'
              }`}
            >
              {mergeMode ? 'Cancel Merge' : 'Merge Mode'}
            </button>
          )}
        </div>

        {/* Yellow Banner in Merge Mode */}
        {mergeMode && (
          <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-300 flex justify-between items-center">
            <span className="text-[13px] font-medium text-amber-800">
              {selectedForMerge.length === 0
                ? `Select 2 or more ${itemLabel.toLowerCase()}s to merge`
                : `${selectedForMerge.length} ${itemLabel.toLowerCase()}${selectedForMerge.length === 1 ? '' : 's'} selected`}
            </span>
            {selectedForMerge.length >= 2 && (
              <button
                onClick={handleMergeConfirm}
                className="px-3.5 py-1.5 bg-blue-500 text-white border-none rounded text-[13px] font-semibold cursor-pointer hover:bg-blue-600"
              >
                Merge Selected
              </button>
            )}
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Items List */}
          <div className={`overflow-y-auto p-4 ${mergeMode ? 'flex-[0_0_60%] border-r border-gray-200' : 'flex-1'}`}>
            {sortedItems.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-[13px]">
                {searchQuery ? 'No items match your search' : 'No items available'}
              </div>
            ) : (
              sortedItems.map((item) => {
                const isDeleteConfirming = deleteConfirmId === item.id;
                const isSelectedForMerge = selectedForMerge.includes(item.id);

                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-sm mb-px transition-colors ${
                      isSelectedForMerge ? 'bg-blue-50' : 'bg-transparent hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      {mergeMode && (
                        <input
                          type="checkbox"
                          checked={isSelectedForMerge}
                          onChange={() => handleMergeSelection(item.id)}
                          className="w-4 h-4 cursor-pointer m-0 accent-blue-600"
                        />
                      )}
                      <span className="text-[13px] text-gray-900 flex-1 truncate">
                        {item.name}
                      </span>
                      {item.count !== undefined && (
                        <span className="text-[13px] text-gray-500 font-normal mr-2">
                          {item.count}
                        </span>
                      )}
                    </div>

                    {!mergeMode && (
                      <div className="flex gap-1 items-center">
                        {isDeleteConfirming ? (
                          <>
                            <button
                              onClick={() => handleDeleteConfirm(item.id)}
                              className="px-2.5 py-1 bg-red-500 text-white border-none rounded text-xs font-medium cursor-pointer hover:bg-red-600"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={handleDeleteCancel}
                              className="px-2.5 py-1 bg-gray-200 text-gray-700 border-none rounded text-xs font-medium cursor-pointer hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Pencil Icon */}
                            <button
                              onClick={() => onEdit(item.id)}
                              className="bg-transparent border-none cursor-pointer p-1 text-gray-400 hover:text-blue-500 flex items-center"
                              title="Edit"
                            >
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                                <path d="M11.5 1.5l1 1-8 8-1.5.5.5-1.5 8-8zm1.5-.5c-.3-.3-.7-.3-1 0l-1 1 1 1 1-1c.3-.3.3-.7 0-1l-.5-.5-.5.5zm-10 11l1-3 2 2-3 1z"/>
                              </svg>
                            </button>
                            {/* X Icon */}
                            <button
                              onClick={() => handleDeleteClick(item.id)}
                              className="bg-transparent border-none cursor-pointer p-1 text-gray-400 hover:text-red-500 flex items-center text-base leading-none"
                              title="Delete"
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Right Panel in Merge Mode */}
          {mergeMode && selectedForMerge.length > 0 && (
            <div className="flex-[0_0_40%] p-4 bg-gray-50 overflow-y-auto">
              <div className="text-[13px] font-semibold text-gray-700 mb-3">
                Checkbox the {itemLabel}s you want to merge:
              </div>
              <div className="flex flex-col gap-1">
                {selectedForMerge.map(id => {
                  const item = items.find(i => i.id === id);
                  if (!item) return null;
                  return (
                    <div key={id} className="px-2 py-1.5 bg-white rounded shadow-sm text-[13px] flex justify-between">
                      <span className="truncate mr-2">{item.name}</span>
                      <span className="text-gray-500">{item.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-4 py-3 border-t border-gray-200 flex gap-2 ${mergeMode ? 'justify-between' : 'justify-center'}`}>
          {mergeMode ? (
            <>
              <button
                onClick={() => {
                  setMergeMode(false);
                  setSelectedForMerge([]);
                }}
                className="px-4 py-1.5 bg-gray-200 text-gray-700 border-none rounded text-[13px] font-medium cursor-pointer hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleMergeConfirm}
                disabled={selectedForMerge.length < 2}
                className={`px-4 py-1.5 border-none rounded text-[13px] font-semibold text-white ${
                  selectedForMerge.length >= 2 
                    ? 'bg-blue-500 cursor-pointer hover:bg-blue-600' 
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                Merge to
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-6 py-1.5 bg-gray-200 text-gray-700 border-none rounded text-[13px] font-medium cursor-pointer hover:bg-gray-300"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
// AUDIT: inspected, no changes.
