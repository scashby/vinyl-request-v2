// src/app/edit-collection/crates/ManageCratesModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from 'lib/supabaseClient';
import type { Crate, SmartRules } from 'types/crate';
import { BoxIcon } from '../../../components/BoxIcon';

interface ManageCratesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCratesChanged: () => void;
  onOpenNewCrate: () => void;
  onOpenNewSmartCrate: () => void;
  onOpenEditCrate: (crate: Crate) => void;
  onOpenEditSmartCrate: (crate: Crate) => void;
}

export function ManageCratesModal({ isOpen, onClose, onCratesChanged, onOpenNewCrate, onOpenNewSmartCrate, onOpenEditCrate, onOpenEditSmartCrate }: ManageCratesModalProps) {
  const [crates, setCrates] = useState<Crate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCrates();
    }
  }, [isOpen]);

  const loadCrates = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('crates')
        .select('*')
        .order('sort_order', { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
      } else {
        const normalized = (data || []).map((row) => ({
          ...row,
          smart_rules: row.smart_rules as unknown as SmartRules | null
        })) as Crate[];
        setCrates(normalized);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load crates');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (crateId: number, crateName: string) => {
    if (!confirm(`Are you sure you want to delete "${crateName}"? This cannot be undone.`)) {
      return;
    }

    setDeletingId(crateId);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('crates')
        .delete()
        .eq('id', crateId);

      if (deleteError) {
        setError(deleteError.message);
        setDeletingId(null);
        return;
      }

      // Remove from local state
      setCrates(crates.filter((c) => c.id !== crateId));
      onCratesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete crate');
    } finally {
      setDeletingId(null);
    }
  };

  const handleReorder = async (crateId: number, direction: 'up' | 'down') => {
    const currentIndex = crates.findIndex((c) => c.id === crateId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= crates.length) return;

    // Optimistically update UI
    const newCrates = [...crates];
    const [movedCrate] = newCrates.splice(currentIndex, 1);
    newCrates.splice(newIndex, 0, movedCrate);
    setCrates(newCrates);

    // Update sort_order in database
    try {
      const updates = newCrates.map((crate, index) => ({
        id: crate.id,
        sort_order: index,
      }));

      for (const update of updates) {
        await supabase
          .from('crates')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
      }

      onCratesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder crates');
      // Reload to fix state
      loadCrates();
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30001]"
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg w-[600px] max-h-[80vh] flex flex-col shadow-xl"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
          <h2 className="m-0 text-lg font-semibold text-gray-900">
            Manage Crates
          </h2>
          <div className="flex gap-2 items-center">
            <button
              onClick={onOpenNewCrate}
              className="px-3 py-1.5 bg-blue-500 text-white border-none rounded text-xs font-medium cursor-pointer flex items-center gap-1 hover:bg-blue-600"
              title="Create new crate"
            >
              <span>📦</span>
              <span>New Crate</span>
            </button>
            <button
              onClick={onOpenNewSmartCrate}
              className="px-3 py-1.5 bg-violet-500 text-white border-none rounded text-xs font-medium cursor-pointer flex items-center gap-1 hover:bg-violet-600"
              title="Create new smart crate"
            >
              <span>⚡</span>
              <span>New Smart</span>
            </button>
            <button
              onClick={handleClose}
              className="bg-transparent border-none text-2xl cursor-pointer text-gray-500 p-0 leading-none hover:text-gray-700"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-md text-red-800 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-10 text-center text-gray-500 text-sm">
              Loading crates...
            </div>
          ) : crates.length === 0 ? (
            <div className="p-10 text-center text-gray-500 text-sm">
              No crates yet. Create your first crate!
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {crates.map((crate, index) => (
                <div
                  key={crate.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-md border border-gray-200"
                >
                  {/* Reorder Buttons */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleReorder(crate.id, 'up')}
                      disabled={index === 0}
                      className={`w-6 h-5 border border-gray-300 rounded text-xs flex items-center justify-center ${
                        index === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-white text-gray-700 cursor-pointer hover:bg-gray-50'
                      }`}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleReorder(crate.id, 'down')}
                      disabled={index === crates.length - 1}
                      className={`w-6 h-5 border border-gray-300 rounded text-xs flex items-center justify-center ${
                        index === crates.length - 1 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-white text-gray-700 cursor-pointer hover:bg-gray-50'
                      }`}
                    >
                      ▼
                    </button>
                  </div>

                  {/* Icon and Info */}
                  <div className="flex-1 flex items-center gap-3">
                    <div className="text-3xl leading-none flex items-center justify-center">
                      {crate.is_smart ? (
                        <BoxIcon color={crate.icon} size={28} />
                      ) : (
                        crate.icon
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900 mb-0.5">
                        {crate.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {crate.is_smart ? (
                          <>
                            Smart Crate • {crate.smart_rules?.rules?.length || 0} rule(s) •{' '}
                            {crate.match_rules === 'all' ? 'Match All' : 'Match Any'}
                            {crate.live_update && ' • Live Update'}
                          </>
                        ) : (
                          'Manual Crate'
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {/* Edit button */}
                    <button
                      onClick={() => {
                        if (crate.is_smart) {
                          onOpenEditSmartCrate(crate);
                        } else {
                          onOpenEditCrate(crate);
                        }
                      }}
                      className="px-3 py-1.5 bg-white text-gray-700 border border-gray-300 rounded text-xs cursor-pointer font-medium hover:bg-gray-50"
                    >
                      Edit
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(crate.id, crate.name)}
                      disabled={deletingId === crate.id}
                      className={`px-3 py-1.5 bg-red-500 text-white border-none rounded text-xs cursor-pointer ${
                        deletingId === crate.id ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'
                      }`}
                    >
                      {deletingId === crate.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-blue-500 text-white border-none rounded text-sm font-medium cursor-pointer hover:bg-blue-600"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default ManageCratesModal;
