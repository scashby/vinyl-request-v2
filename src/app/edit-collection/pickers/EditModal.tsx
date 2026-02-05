// src/app/edit-collection/pickers/EditModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  itemName: string;
  itemSortName?: string; // ADDED
  onSave: (newName: string, newSortName?: string) => void; // UPDATED signature
  itemLabel?: string;
  showSortName?: boolean; // ADDED
}

export function EditModal({
  isOpen,
  onClose,
  title,
  itemName,
  itemSortName = '',
  onSave,
  itemLabel = 'Item',
  showSortName = false,
}: EditModalProps) {
  const [localName, setLocalName] = useState(itemName);
  const [localSortName, setLocalSortName] = useState(itemSortName);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalName(itemName);
    setLocalSortName(itemSortName || '');
    setError(null);
  }, [itemName, itemSortName, isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // Auto-generate sort name if empty when name changes
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setLocalName(newName);
    setError(null);
    
    // Only auto-update sort name if it hasn't been manually edited or was matching logic
    if (showSortName) {
      let autoSort = newName;
      if (newName.startsWith('The ')) autoSort = newName.substring(4) + ', The';
      else if (newName.startsWith('A ')) autoSort = newName.substring(2) + ', A';
      
      // Simple heuristic: if sort name was empty or matched previous auto-logic, update it
      // For now, we'll just auto-fill if the user hasn't explicitly cleared it or typed something distinct
      if (!localSortName || localSortName === itemName || localSortName.endsWith(', The') || localSortName.endsWith(', A')) {
         setLocalSortName(autoSort);
      }
    }
  };

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmedName = localName.trim();
    const trimmedSortName = localSortName.trim();
    
    if (!trimmedName) {
      setError(`${itemLabel} name cannot be empty`);
      return;
    }

    if (trimmedName === itemName && trimmedSortName === itemSortName) {
      onClose();
      return;
    }

    onSave(trimmedName, showSortName ? trimmedSortName : undefined);
    onClose();
  };

  const handleCancel = () => {
    setLocalName(itemName);
    setLocalSortName(itemSortName || '');
    setError(null);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30003] p-4"
      onClick={handleCancel}
    >
      <div
        className="bg-white rounded-lg w-full max-w-[450px] flex flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-orange-500">
          <h3 className="m-0 text-base font-semibold text-white">
            {title}
          </h3>
          <button
            onClick={handleCancel}
            className="bg-transparent border-none text-white text-xl cursor-pointer p-1 leading-none hover:text-white/80"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-3">
          <div>
            <label className="block mb-1.5 text-[13px] font-medium text-gray-700">
              {itemLabel} Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={localName}
              onChange={handleNameChange}
              onKeyDown={handleKeyDown}
              className={`w-full px-2.5 py-2 border rounded text-[13px] outline-none text-gray-900 ${
                error ? 'border-red-500 focus:ring-1 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
              }`}
              placeholder={`Enter ${itemLabel.toLowerCase()} name`}
            />
          </div>

          {showSortName && (
            <div>
              <label className="block mb-1.5 text-[13px] font-medium text-gray-700">
                Sort Name
              </label>
              <input
                type="text"
                value={localSortName}
                onChange={(e) => setLocalSortName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-2.5 py-2 border border-gray-300 rounded text-[13px] outline-none text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Sort name (optional)"
              />
            </div>
          )}

          {error && (
            <div className="mt-1 text-xs text-red-500">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2 bg-white">
          <button
            onClick={handleCancel}
            className="px-4 py-1.5 bg-gray-200 text-gray-700 border-none rounded text-[13px] font-medium cursor-pointer hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-blue-500 text-white border-none rounded text-[13px] font-semibold cursor-pointer hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
// AUDIT: inspected, no changes.
