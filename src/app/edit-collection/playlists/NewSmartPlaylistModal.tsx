'use client';

import { useEffect, useState } from 'react';
import type {
  CollectionPlaylist,
  SmartPlaylistFieldType,
  SmartPlaylistOperatorType,
  SmartPlaylistRule,
  SmartPlaylistRuleValue,
  SmartPlaylistRules
} from '../../../types/collectionPlaylist';

interface NewSmartPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  valueOptions?: Partial<Record<string, string[]>>;
  onCreate: (payload: {
    name: string;
    color: string;
    matchRules: 'all' | 'any';
    liveUpdate: boolean;
    smartRules: SmartPlaylistRules;
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
  // Track-focused fields
  { value: 'track_title', label: 'Track Title', type: 'text' },
  { value: 'track_artist', label: 'Track Artist', type: 'text' },
  { value: 'album_title', label: 'Album Title', type: 'text' },
  { value: 'album_artist', label: 'Album Artist', type: 'text' },
  { value: 'position', label: 'Position', type: 'text' },
  { value: 'side', label: 'Side', type: 'text' },
  { value: 'album_format', label: 'Media Type', type: 'text' },
  { value: 'duration_seconds', label: 'Duration Seconds', type: 'number' },
  // Album-level context useful for playlist curation
  { value: 'format', label: 'Format Detail', type: 'text' },
  { value: 'country', label: 'Country', type: 'text' },
  { value: 'year_int', label: 'Year', type: 'number' },
  { value: 'decade', label: 'Decade', type: 'number' },
  { value: 'my_rating', label: 'Rating', type: 'number' },
  { value: 'date_added', label: 'Date Added', type: 'date' },
  { value: 'purchase_date', label: 'Purchase Date', type: 'date' },
  { value: 'last_played_at', label: 'Last Played', type: 'date' },
  { value: 'last_cleaned_date', label: 'Last Cleaned', type: 'date' },
  { value: 'original_release_date', label: 'Original Release Date', type: 'date' },
  { value: 'recording_date', label: 'Recording Date', type: 'date' },
  { value: 'custom_tags', label: 'Tags', type: 'array' },
  { value: 'genre', label: 'Genre', type: 'array' },
  { value: 'label', label: 'Label', type: 'text' },
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
        { value: 'between', label: 'Between' },
      ];
    case 'date':
      return [
        { value: 'is', label: 'Is' },
        { value: 'before', label: 'Before' },
        { value: 'after', label: 'After' },
        { value: 'between', label: 'Between' },
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

const LEGACY_RULE_FIELD_MAP: Partial<Record<string, SmartPlaylistFieldType>> = {
  discogs_genres: 'genre',
  spotify_genres: 'genre',
};

const DROPDOWN_FIELDS = new Set<SmartPlaylistFieldType>([
  'format',
  'album_format',
  'country',
  'year_int',
  'decade',
  'my_rating',
  'side',
  'genre',
  'label',
  'date_added',
  'purchase_date',
  'last_played_at',
  'last_cleaned_date',
  'original_release_date',
  'recording_date',
]);

const SUPPORTED_FIELDS = new Set<SmartPlaylistFieldType>(FIELD_OPTIONS.map((field) => field.value));

const LIMIT_SELECTION_OPTIONS: Array<{ value: NonNullable<SmartPlaylistRules['selectedBy']>; label: string }> = [
  { value: 'random', label: 'Random' },
  { value: 'album', label: 'Album' },
  { value: 'artist', label: 'Artist' },
  { value: 'genre', label: 'Genre' },
  { value: 'title', label: 'Title' },
  { value: 'highest_rating', label: 'Highest Rating' },
  { value: 'lowest_rating', label: 'Lowest Rating' },
  { value: 'most_recently_played', label: 'Most Recently Played' },
  { value: 'least_recently_played', label: 'Least Recently Played' },
  { value: 'most_often_played', label: 'Most Often Played' },
  { value: 'least_often_played', label: 'Least Often Played' },
  { value: 'most_recently_added', label: 'Most Recently Added' },
  { value: 'least_recently_added', label: 'Least Recently Added' },
];

const normalizeRuleField = (field: string): SmartPlaylistFieldType =>
  LEGACY_RULE_FIELD_MAP[field] ?? (field as SmartPlaylistFieldType);

export function NewSmartPlaylistModal({ isOpen, onClose, valueOptions, onCreate, onUpdate, editingPlaylist }: NewSmartPlaylistModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [matchRules, setMatchRules] = useState<'all' | 'any'>('all');
  const [liveUpdate, setLiveUpdate] = useState(true);
  const [rules, setRules] = useState<SmartPlaylistRule[]>([]);
  const [maxTracks, setMaxTracks] = useState('');
  const [selectedBy, setSelectedBy] = useState<NonNullable<SmartPlaylistRules['selectedBy']>>('random');
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
      const normalizedRules = (editingPlaylist.smartRules?.rules || [])
        .filter((rule) => rule.field !== ('is_1001' as SmartPlaylistFieldType))
        .map((rule) => ({
          ...rule,
          field: normalizeRuleField(rule.field),
        }))
        .filter((rule) => SUPPORTED_FIELDS.has(rule.field));
      setRules(normalizedRules);
      setMaxTracks(editingPlaylist.smartRules?.maxTracks ? String(editingPlaylist.smartRules.maxTracks) : '');
      setSelectedBy(editingPlaylist.smartRules?.selectedBy ?? 'random');
      return;
    }
    setName('');
    setColor('#3b82f6');
    setMatchRules('all');
    setLiveUpdate(true);
    setRules([]);
    setMaxTracks('');
    setSelectedBy('random');
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
    } else if (field === 'operator') {
      next[index] = {
        ...next[index],
        operator: value as SmartPlaylistOperatorType,
        value: value === 'between' ? { min: '', max: '' } : '',
      };
    } else {
      next[index] = { ...next[index], [field]: value };
    }
    setRules(next);
  };

  const isBetweenValue = (value: SmartPlaylistRuleValue): value is { min: string | number; max: string | number } => {
    return typeof value === 'object' && value !== null && 'min' in value && 'max' in value;
  };

  const handleBetweenChange = (index: number, bound: 'min' | 'max', nextValue: string) => {
    setRules((prev) => {
      const next = [...prev];
      const existing = next[index]?.value;
      const currentRange = isBetweenValue(existing) ? existing : { min: '', max: '' };
      next[index] = {
        ...next[index],
        value: {
          ...currentRange,
          [bound]: nextValue,
        },
      };
      return next;
    });
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
    const normalizedMaxTracks = maxTracks.trim();
    const parsedMaxTracks = normalizedMaxTracks === '' ? null : Number(normalizedMaxTracks);
    if (normalizedMaxTracks !== '' && (!Number.isFinite(parsedMaxTracks) || parsedMaxTracks <= 0)) {
      setError('Playlist length limit must be a positive number');
      return;
    }
    const invalidRule = rules.find((rule) => {
      if (rule.operator === 'between') {
        if (!isBetweenValue(rule.value)) return true;
        return String(rule.value.min).trim() === '' || String(rule.value.max).trim() === '';
      }
      return rule.value === '' || rule.value === null || rule.value === undefined;
    });
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
          smartRules: { rules, maxTracks: parsedMaxTracks, selectedBy },
          matchRules,
          liveUpdate,
        });
      } else {
        await onCreate({
          name: name.trim(),
          color,
          matchRules,
          liveUpdate,
          smartRules: { rules, maxTracks: parsedMaxTracks, selectedBy },
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
                    <span className="w-7 h-7 rounded-full border border-black/10" style={{ backgroundColor: swatch }} />
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
            <label className="text-sm font-semibold text-gray-700 ml-3">Max Tracks (optional):</label>
            <input
              type="number"
              min={1}
              step={1}
              value={maxTracks}
              onChange={(e) => setMaxTracks(e.target.value)}
              placeholder="e.g. 75"
              className="w-[140px] px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 outline-none bg-white focus:border-blue-500"
            />
            <label className="text-sm font-semibold text-gray-700 ml-3">Selected by:</label>
            <select
              value={selectedBy}
              onChange={(e) => setSelectedBy(e.target.value as NonNullable<SmartPlaylistRules['selectedBy']>)}
              disabled={maxTracks.trim() === ''}
              className="w-[220px] px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 outline-none cursor-pointer bg-white focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {LIMIT_SELECTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
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
                  const dropdownOptions = DROPDOWN_FIELDS.has(rule.field)
                    ? (valueOptions?.[rule.field] ?? [])
                    : [];
                  const usesDropdown = dropdownOptions.length > 0;
                  return (
                    <div key={`${rule.field}-${index}`} className="flex gap-2 p-3 bg-gray-50 rounded-md border border-gray-200 items-center">
                      <select value={rule.field} onChange={(e) => handleRuleChange(index, 'field', e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 outline-none cursor-pointer bg-white">
                        {FIELD_OPTIONS.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
                      </select>
                      <select value={rule.operator} onChange={(e) => handleRuleChange(index, 'operator', e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 outline-none cursor-pointer bg-white">
                        {operators.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                      </select>
                      {rule.operator === 'between' ? (
                        <div className="flex-1 flex gap-2">
                          <input
                            type={fieldDef?.type === 'date' ? 'date' : 'number'}
                            value={isBetweenValue(rule.value) ? String(rule.value.min) : ''}
                            onChange={(e) => handleBetweenChange(index, 'min', e.target.value)}
                            placeholder="Min"
                            className="w-1/2 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 outline-none bg-white"
                          />
                          <input
                            type={fieldDef?.type === 'date' ? 'date' : 'number'}
                            value={isBetweenValue(rule.value) ? String(rule.value.max) : ''}
                            onChange={(e) => handleBetweenChange(index, 'max', e.target.value)}
                            placeholder="Max"
                            className="w-1/2 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 outline-none bg-white"
                          />
                        </div>
                      ) : fieldDef?.type === 'boolean' ? (
                        <select value={String(rule.value)} onChange={(e) => handleRuleChange(index, 'value', e.target.value === 'true')} className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 outline-none cursor-pointer bg-white">
                          <option value="true">True</option>
                          <option value="false">False</option>
                        </select>
                      ) : usesDropdown ? (
                        <>
                          <input
                            list={`smart-rule-options-${index}`}
                            type={fieldDef?.type === 'date' ? 'date' : fieldDef?.type === 'number' ? 'number' : 'text'}
                            value={String(rule.value)}
                            onChange={(e) =>
                              handleRuleChange(
                                index,
                                'value',
                                fieldDef?.type === 'number'
                                  ? (e.target.value === '' ? '' : Number(e.target.value))
                                  : e.target.value
                              )
                            }
                            placeholder="Select or type..."
                            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 outline-none bg-white"
                          />
                          <datalist id={`smart-rule-options-${index}`}>
                            {dropdownOptions.map((opt) => (
                              <option key={opt} value={opt} />
                            ))}
                          </datalist>
                        </>
                      ) : fieldDef?.type === 'date' ? (
                        <input type="date" value={String(rule.value)} onChange={(e) => handleRuleChange(index, 'value', e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 outline-none bg-white" />
                      ) : fieldDef?.type === 'number' ? (
                        <input type="number" value={String(rule.value)} onChange={(e) => handleRuleChange(index, 'value', e.target.value === '' ? '' : Number(e.target.value))} placeholder="Value..." className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 outline-none bg-white" />
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
