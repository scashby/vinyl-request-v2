// src/app/edit-collection/crates/AddToCrateModal.tsx
'use client';

import { useState, useEffect } from 'react';
import type { Crate } from '../../../types/crate';
import { BoxIcon } from '../../../components/BoxIcon';

interface AddToCrateModalProps {
  isOpen: boolean;
  onClose: () => void;
  crates: Crate[];
  onAddToCrates: (crateIds: number[]) => Promise<void>;
  selectedCount: number;
  onOpenNewCrate: () => void;
  autoSelectCrateId?: number | null;
}

export function AddToCrateModal({
  isOpen,
  onClose,
  crates,
  onAddToCrates,
  selectedCount,
  onOpenNewCrate,
  autoSelectCrateId,
}: AddToCrateModalProps) {
  const [selectedCrateIds, setSelectedCrateIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedCrateIds([]);
      setSearchQuery('');
    }
  }, [isOpen]);

  // Auto-select newly created crate
  useEffect(() => {
    if (isOpen && autoSelectCrateId) {
      setSelectedCrateIds(prev => {
        if (!prev.includes(autoSelectCrateId)) {
          return [...prev, autoSelectCrateId];
        }
        return prev;
      });
    }
  }, [isOpen, autoSelectCrateId]);

  if (!isOpen) return null;

  // Filter to manual crates only (smart crates auto-populate)
  const manualCrates = crates.filter(crate => !crate.is_smart);

  // Filter by search query
  const filteredCrates = manualCrates.filter(crate =>
    crate.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleCrate = (crateId: number) => {
    if (selectedCrateIds.includes(crateId)) {
      setSelectedCrateIds(selectedCrateIds.filter(id => id !== crateId));
    } else {
      setSelectedCrateIds([...selectedCrateIds, crateId]);
    }
  };

  const handleSave = async () => {
    if (selectedCrateIds.length === 0) return;
    
    setSaving(true);
    try {
      await onAddToCrates(selectedCrateIds);
      onClose();
    } catch (error) {
      console.error('Failed to add to crates:', error);
      alert('Failed to add albums to crates. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30001]"
      onClick={handleCancel}
    >
      <div
        className="bg-white rounded-md w-[500px] max-h-[600px] flex flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-white">
          <h3 className="m-0 text-base font-semibold text-gray-900">
            Add {selectedCount} Album{selectedCount !== 1 ? 's' : ''} to Crate
          </h3>
          <button
            onClick={handleCancel}
            className="bg-transparent border-none text-gray-500 text-xl cursor-pointer p-1 leading-none hover:text-gray-700"
          >
            ×
          </button>
        </div>

        {/* Search + New Crate Button */}
        <div className="px-4 py-3 border-b border-gray-200 flex gap-2 items-center">
          <input
            type="text"
            placeholder="Search crates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-[13px] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={onOpenNewCrate}
            className="px-3 py-1.5 bg-blue-500 text-white border-none rounded text-[13px] font-medium cursor-pointer whitespace-nowrap hover:bg-blue-600"
          >
            New Crate
          </button>
        </div>

        {/* Crates List */}
        <div className="flex-1 overflow-y-auto p-2">
          {filteredCrates.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-[13px]">
              {searchQuery 
                ? 'No crates match your search' 
                : manualCrates.length === 0
                  ? 'No manual crates available. Smart crates auto-populate based on rules.'
                  : 'No crates available'}
            </div>
          ) : (
            filteredCrates.map((crate) => {
              const isSelected = selectedCrateIds.includes(crate.id);

              return (
                <label
                  key={crate.id}
                  className="flex items-center justify-between px-2 py-1.5 cursor-pointer rounded-sm mb-0.5 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2.5 flex-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleCrate(crate.id)}
                      className="w-4 h-4 cursor-pointer m-0 accent-blue-600"
                    />
                    <span className="text-[13px] text-gray-900 flex items-center gap-1.5">
                      {crate.is_smart ? (
                        <BoxIcon color={crate.icon} size={16} />
                      ) : (
                        <span>{crate.icon}</span>
                      )}
                      <span>{crate.name}</span>
                    </span>
                  </div>
                  {crate.album_count !== undefined && (
                    <span className="text-[13px] text-gray-500 font-normal">
                      {crate.album_count}
                    </span>
                  )}
                </label>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 flex justify-between items-center bg-gray-50">
          <div className="text-[13px] text-gray-500">
            {selectedCrateIds.length} crate{selectedCrateIds.length !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={saving}
              className={`px-4 py-1.5 bg-white border border-gray-300 text-gray-700 rounded text-[13px] font-medium cursor-pointer hover:bg-gray-50 ${
                saving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={selectedCrateIds.length === 0 || saving}
              className={`px-4 py-1.5 border-none rounded text-[13px] font-semibold cursor-pointer text-white ${
                selectedCrateIds.length > 0 && !saving 
                  ? 'bg-blue-500 hover:bg-blue-600' 
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {saving ? 'Adding...' : 'Add to Crates'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}