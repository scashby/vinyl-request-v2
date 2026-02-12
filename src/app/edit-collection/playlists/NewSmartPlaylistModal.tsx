'use client';

import { useEffect, useState } from 'react';
import type { CollectionPlaylist, SmartPlaylistFieldType, SmartPlaylistOperatorType, SmartPlaylistRule } from '../../../types/collectionPlaylist';

interface NewSmartPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: {
    name: string;
    color: string;
    matchRules: 'all' | 'any';
    liveUpdate: boolean;
    smartRules: { rules: SmartPlaylistRule[] };
  }) => Promise<void>;
  onUpdate: (playlist: CollectionPlaylist) => Promise<void>;
  editingPlaylist: CollectionPlaylist | null;
}

const SMART_PLAYLIST_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#06b6d4',
  '#10b981',
  '#ec4899',
  '#f59e0b',
  '#ef4444',
  '#a855f7',
  '#ffff00',
  '#00ff00',
  '#008080',
  '#808080',
  '#000000',
  '#8b4513',
];

const FIELD_OPTIONS: { value: SmartPlaylistFieldType; label: string; type: 'text' | 'number' | 'date' | 'boolean' | 'array' }[] = [
  { value: 'track_title', label: 'Track Title', type: 'text' },
  { value: 'track_artist', label: 'Track Artist', type: 'text' },
  { value: 'album_title', label: 'Album Title', type: 'text' },
  { value: 'album_artist', label: 'Album Artist', type: 'text' },
  { value: 'position', label: 'Position', type: 'text' },
  { value: 'side', label: 'Side', type: 'text' },
  { value: 'album_format', label: 'Album Format', type: 'text' },
  { value: 'duration_seconds', label: 'Duration Seconds', type: 'number' },
  { value: 'format', label: 'Format', type: 'text' },
  { value: 'country', label: 'Country', type: 'text' },
  { value: 'location', label: 'Location', type: 'text' },
  { value: 'status', label: 'Status', type: 'text' },
  { value: 'barcode', label: 'Barcode', type: 'text' },
  { value: 'catalog_number', label: 'Catalog Number', type: 'text' },
  { value: 'label', label: 'Label', type: 'text' },
  { value: 'media_condition', label: 'Media Condition', type: 'text' },
  { value: 'sleeve_condition', label: 'Sleeve Condition', type: 'text' },
  { value: 'package_sleeve_condition', label: 'Package/Sleeve Condition', type: 'text' },
  { value: 'packaging', label: 'Packaging', type: 'text' },
  { value: 'studio', label: 'Studio', type: 'text' },
  { value: 'sound', label: 'Sound', type: 'text' },
  { value: 'vinyl_weight', label: 'Vinyl Weight', type: 'text' },
  { value: 'rpm', label: 'RPM', type: 'text' },
  { value: 'spars_code', label: 'SPARS Code', type: 'text' },
  { value: 'box_set', label: 'Box Set', type: 'text' },
  { value: 'owner', label: 'Owner', type: 'text' },
  { value: 'purchase_store', label: 'Purchase Store', type: 'text' },
  { value: 'notes', label: 'Notes', type: 'text' },
  { value: 'personal_notes', label: 'Personal Notes', type: 'text' },
  { value: 'release_notes', label: 'Release Notes', type: 'text' },
  { value: 'master_notes', label: 'Master Notes', type: 'text' },
  { value: 'composer', label: 'Composer', type: 'text' },
  { value: 'conductor', label: 'Conductor', type: 'text' },
  { value: 'chorus', label: 'Chorus', type: 'text' },
  { value: 'composition', label: 'Composition', type: 'text' },
  { value: 'orchestra', label: 'Orchestra', type: 'text' },
  { value: 'year_int', label: 'Year', type: 'number' },
  { value: 'decade', label: 'Decade', type: 'number' },
  { value: 'my_rating', label: 'My Rating', type: 'number' },
  { value: 'play_count', label: 'Play Count', type: 'number' },
  { value: 'discs', label: 'Disc Count', type: 'number' },
  { value: 'sides', label: 'Side Count', type: 'number' },
  { value: 'index_number', label: 'Index Number', type: 'number' },
  { value: 'purchase_price', label: 'Purchase Price', type: 'number' },
  { value: 'current_value', label: 'Current Value', type: 'number' },
  { value: 'date_added', label: 'Date Added', type: 'date' },
  { value: 'purchase_date', label: 'Purchase Date', type: 'date' },
  { value: 'last_played_at', label: 'Last Played Date', type: 'date' },
  { value: 'last_cleaned_date', label: 'Last Cleaned Date', type: 'date' },
  { value: 'original_release_date', label: 'Original Release Date', type: 'date' },
  { value: 'recording_date', label: 'Recording Date', type: 'date' },
  { value: 'for_sale', label: 'For Sale', type: 'boolean' },
  { value: 'is_live', label: 'Is Live', type: 'boolean' },
  { value: 'is_1001', label: '1001 Albums', type: 'boolean' },
  { value: 'custom_tags', label: 'Tags', type: 'array' },
  { value: 'discogs_genres', label: 'Genres (Discogs)', type: 'array' },
  { value: 'spotify_genres', label: 'Genres (Spotify)', type: 'array' },
  { value: 'labels', label: 'Labels', type: 'array' },
  { value: 'signed_by', label: 'Signed By', type: 'array' },
  { value: 'songwriters', label: 'Songwriters', type: 'array' },
  { value: 'producers', label: 'Producers', type: 'array' },
  { value: 'engineers', label: 'Engineers', type: 'array' },
  { value: 'musicians', label: 'Musicians', type: 'array' },
];

function getOperatorsForFieldType(fieldType: string): { value: SmartPlaylistOperatorType; label: string }[] {
  switch (fieldType) {
    case 'number':
      return [
        { value: 'is', label: 'Is' },
        { value: 'is_not', label: 'Is Not' },
        { value: 'greater_than', label: 'Greater Than' },
        { value: 'less_than', label: 'Less Than' },
        { value: 'greater_than_or_equal_to', label: 'Greater Than or Equal To' },
        { value: 'less_than_or_equal_to', label: 'Less Than or Equal To' },
      ];
    case 'date':
      return [
        { value: 'is', label: 'Is' },
        { value: 'before', label: 'Before' },
        { value: 'after', label: 'After' },
      ];
    case 'boolean':
      return [{ value: 'is', label: 'Is' }];
    case 'array':
      return [
        { value: 'includes', label: 'Includes' },
        { value: 'excludes', label: 'Excludes' },
      ];
    default:
      return [
        { value: 'contains', label: 'Contains' },
        { value: 'is', label: 'Is' },
        { value: 'is_not', label: 'Is Not' },
        { value: 'does_not_contain', label: 'Does Not Contain' },
      ];
  }
}

export function NewSmartPlaylistModal({ isOpen, onClose, onCreate, onUpdate, editingPlaylist }: NewSmartPlaylistModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [matchRules, setMatchRules] = useState<'all' | 'any'>('all');
  const [liveUpdate, setLiveUpdate] = useState(true);
  const [rules, setRules] = useState<SmartPlaylistRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = !!editingPlaylist;

  useEffect(() => {
    if (!isOpen) return;
    if (editingPlaylist?.isSmart) {
      setName(editingPlaylist.name);
      setColor(editingPlaylist.color);
      setMatchRules(editingPlaylist.matchRules);
      setLiveUpdate(editingPlaylist.liveUpdate);
      setRules(editingPlaylist.smartRules?.rules || []);
      return;
    }
    setName('');
    setColor('#3b82f6');
    setMatchRules('all');
    setLiveUpdate(true);
    setRules([]);
  }, [editingPlaylist, isOpen]);

  if (!isOpen) return null;

  const handleAddRule = () => {
    setRules((prev) => [...prev, { field: 'track_title', operator: 'contains', value: '' }]);
  };

  const handleRemoveRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRuleChange = (index: number, field: keyof SmartPlaylistRule, value: string | number | boolean) => {
    const next = [...rules];
    if (field === 'field') {
      const fieldDef = FIELD_OPTIONS.find((f) => f.value === value);
      const operators = getOperatorsForFieldType(fieldDef?.type || 'text');
      next[index] = { field: value as SmartPlaylistFieldType, operator: operators[0].value, value: '' };
    } else {
      next[index] = { ...next[index], [field]: value };
    }
    setRules(next);
  };

  const handleClose = () => {
    setError(null);
    setSaving(false);
    onClose();
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Playlist name is required');
      return;
    }
    if (rules.length === 0) {
      setError('At least one rule is required');
      return;
    }
    const invalidRule = rules.find((rule) => rule.value === '' || rule.value === null || rule.value === undefined);
    if (invalidRule) {
      setError('All rules must have a value');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingPlaylist) {
        await onUpdate({
          ...editingPlaylist,
          name: name.trim(),
          icon: '⚡',
          color,
          isSmart: true,
          smartRules: { rules },
          matchRules,
          liveUpdate,
        });
      } else {
        await onCreate({
          name: name.trim(),
          color,
          matchRules,
          liveUpdate,
          smartRules: { rules },
        });
      }
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save smart playlist');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30002]" onClick={handleClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg w-[860px] max-h-[90vh] flex flex-col shadow-xl">
        <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
          <h2 className="m-0 text-lg font-semibold text-gray-900">{isEditing ? 'Edit Smart Playlist' : 'New Smart Playlist'}</h2>
          <button onClick={handleClose} className="bg-transparent border-none text-2xl cursor-pointer text-gray-500 p-0 leading-none hover:text-gray-700">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-md text-red-800 text-sm">{error}</div>}

          <div className="flex gap-4 mb-5">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Playlist Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter playlist name..." autoFocus className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Playlist Accent</label>
              <div className="flex gap-2 flex-wrap max-w-[400px]">
                {SMART_PLAYLIST_COLORS.map((swatch) => (
                  <button key={swatch} onClick={() => setColor(swatch)} className={`w-12 h-12 border rounded-md cursor-pointer flex items-center justify-center p-1 ${color === swatch ? 'border-gray-900 ring-2 ring-gray-200' : 'border-gray-300 bg-white hover:bg-gray-50'}`}>
                    <span style={{ color: swatch }} className="text-2xl leading-none">🎵</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-5 flex gap-4 items-center">
            <label className="text-sm font-semibold text-gray-700">Match Rules:</label>
            <select value={matchRules} onChange={(e) => setMatchRules(e.target.value as 'all' | 'any')} className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 outline-none cursor-pointer bg-white focus:border-blue-500">
              <option value="all">All</option>
              <option value="any">Any</option>
            </select>
          </div>

          <div className="mb-5">
            <div className="text-sm font-semibold text-gray-700 mb-3">Rules</div>
            {rules.length === 0 ? (
              <div className="p-6 bg-gray-50 rounded-md text-center text-gray-500 text-sm border border-gray-200 border-dashed">
                No rules yet. Click &quot;Add Rule&quot; to get started.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {rules.map((rule, index) => {
                  const fieldDef = FIELD_OPTIONS.find((field) => field.value === rule.field);
                  const operators = getOperatorsForFieldType(fieldDef?.type || 'text');
                  return (
                    <div key={`${rule.field}-${index}`} className="flex gap-2 p-3 bg-gray-50 rounded-md border border-gray-200 items-center">
                      <select value={rule.field} onChange={(e) => handleRuleChange(index, 'field', e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 outline-none cursor-pointer bg-white">
                        {FIELD_OPTIONS.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
                      </select>
                      <select value={rule.operator} onChange={(e) => handleRuleChange(index, 'operator', e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 outline-none cursor-pointer bg-white">
                        {operators.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                      </select>
                      {fieldDef?.type === 'boolean' ? (
                        <select value={String(rule.value)} onChange={(e) => handleRuleChange(index, 'value', e.target.value === 'true')} className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 outline-none cursor-pointer bg-white">
                          <option value="true">True</option>
                          <option value="false">False</option>
                        </select>
                      ) : fieldDef?.type === 'date' ? (
                        <input type="date" value={String(rule.value)} onChange={(e) => handleRuleChange(index, 'value', e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 outline-none bg-white" />
                      ) : fieldDef?.type === 'number' ? (
                        <input type="number" value={String(rule.value)} onChange={(e) => handleRuleChange(index, 'value', Number(e.target.value))} placeholder="Value..." className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 outline-none bg-white" />
                      ) : (
                        <input type="text" value={String(rule.value)} onChange={(e) => handleRuleChange(index, 'value', e.target.value)} placeholder="Value..." className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 outline-none bg-white" />
                      )}
                      <button onClick={() => handleRemoveRule(index)} className="p-2 bg-red-500 text-white border-none rounded cursor-pointer leading-none hover:bg-red-600 w-8 h-8 flex items-center justify-center text-lg">×</button>
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={handleAddRule} className="mt-3 px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-md text-sm font-medium cursor-pointer flex items-center gap-1.5 hover:bg-gray-200">
              <span>+</span>
              <span>Add Rule</span>
            </button>
          </div>

          <div className="mb-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input type="checkbox" checked={liveUpdate} onChange={(e) => setLiveUpdate(e.target.checked)} className="cursor-pointer accent-blue-600" />
              <span>Live Update (automatically update when tracks change)</span>
            </label>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={handleClose} disabled={saving} className={`px-4 py-2 bg-gray-100 text-gray-700 border-none rounded text-sm font-medium cursor-pointer hover:bg-gray-200 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim() || rules.length === 0} className={`px-4 py-2 bg-blue-500 text-white border-none rounded text-sm font-medium cursor-pointer hover:bg-blue-600 ${saving || !name.trim() || rules.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {saving ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Smart Playlist')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewSmartPlaylistModal;
