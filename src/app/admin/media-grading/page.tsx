'use client';

import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const MEDIA_GRADES = [
  'Mint (M)',
  'Near Mint (NM or M-)',
  'Very Good Plus (VG+)',
  'Very Good (VG)',
  'Good Plus (G+)',
  'Good (G)',
  'Fair (F)',
  'Poor (P)',
  'Generic',
];

const SLEEVE_GRADES = [
  'Mint (M)',
  'Near Mint (NM or M-)',
  'Very Good Plus (VG+)',
  'Very Good (VG)',
  'Good Plus (G+)',
  'Good (G)',
  'Fair (F)',
  'Poor (P)',
  'Generic',
  'No Cover',
];

export default function MediaGradingPage() {
  const [inventoryIds, setInventoryIds] = useState('');
  const [mediaCondition, setMediaCondition] = useState(MEDIA_GRADES[1]);
  const [sleeveCondition, setSleeveCondition] = useState(SLEEVE_GRADES[1]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const parseIds = (): number[] => {
    return inventoryIds
      .split(',')
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isFinite(id) && id > 0);
  };

  const handleUpdate = async () => {
    setMessage(null);
    const ids = parseIds();
    if (ids.length === 0) {
      setMessage('Enter one or more inventory IDs.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('inventory')
        .update({
          media_condition: mediaCondition,
          sleeve_condition: sleeveCondition,
        })
        .in('id', ids);

      if (error) throw error;
      setMessage(`Updated ${ids.length} item(s).`);
      setInventoryIds('');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-2">Media Grading (V3)</h1>
      <p className="text-sm text-gray-600 mb-6">
        Update V3 grading fields only: `media_condition` and `sleeve_condition`.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Inventory IDs</label>
          <textarea
            value={inventoryIds}
            onChange={(e) => setInventoryIds(e.target.value)}
            placeholder="Comma-separated inventory IDs (e.g., 12, 34, 56)"
            className="w-full h-24 border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Media Condition</label>
            <select
              value={mediaCondition}
              onChange={(e) => setMediaCondition(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              {MEDIA_GRADES.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Sleeve Condition</label>
            <select
              value={sleeveCondition}
              onChange={(e) => setSleeveCondition(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              {SLEEVE_GRADES.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </div>
        </div>

        {message && (
          <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded px-3 py-2">
            {message}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleUpdate}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Updating…' : 'Update Grades'}
          </button>
        </div>
      </div>
    </div>
  );
}
