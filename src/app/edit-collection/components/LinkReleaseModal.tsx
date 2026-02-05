// src/app/edit-collection/components/LinkReleaseModal.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface LinkReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  albumId: number | null;
  currentDiscogsId?: string | null;
  onLinkSuccess: () => void;
}

export function LinkReleaseModal({ isOpen, onClose, albumId, currentDiscogsId, onLinkSuccess }: LinkReleaseModalProps) {
  const [discogsId, setDiscogsId] = useState(currentDiscogsId || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDiscogsId(currentDiscogsId || '');
      setError(null);
    }
  }, [currentDiscogsId, isOpen]);

  if (!isOpen || albumId == null) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    // Basic validation: ensure it looks like an ID (numeric for releases, usually)
    const cleanId = discogsId.trim();
    if (!cleanId || !/^\d+$/.test(cleanId)) {
      setError('Please enter a valid Discogs Release ID.');
      setSaving(false);
      return;
    }

    try {
      const { data: inventoryRow, error: inventoryError } = await supabase
        .from('inventory')
        .select('release_id')
        .eq('id', albumId)
        .single();

      if (inventoryError) throw inventoryError;

      const releaseId = inventoryRow?.release_id;
      if (!releaseId) {
        setError('No release linked to this inventory item.');
        setSaving(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('releases')
        .update({ discogs_release_id: cleanId })
        .eq('id', releaseId);

      if (updateError) throw updateError;

      onLinkSuccess();
      onClose();
    } catch (err) {
      console.error('Error linking release:', err);
      setError('Failed to update database. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30005]" onClick={onClose}>
      <div className="bg-white rounded-lg w-[400px] shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800">Link Discogs Release</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            Manually paste a Discogs Release ID to link this album. This will enable metadata lookups.
          </p>

          {error && (
            <div className="mb-4 p-2 bg-red-50 text-red-600 text-xs rounded border border-red-200">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
              Discogs Release ID
            </label>
            <input
              type="text"
              value={discogsId}
              onChange={(e) => setDiscogsId(e.target.value)}
              placeholder="e.g. 1234567"
              className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              autoFocus
            />
            <div className="mt-1 text-[10px] text-gray-400">
              Found at the end of the URL: discogs.com/release/<b>1234567</b>...
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button 
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={saving || !discogsId}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {saving ? 'Linking...' : 'Save Link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// AUDIT: inspected, no changes.
