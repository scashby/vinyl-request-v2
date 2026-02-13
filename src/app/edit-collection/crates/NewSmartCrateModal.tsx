// src/app/edit-collection/crates/NewSmartCrateModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from 'lib/supabaseClient';
import type { SmartRule, CrateFieldType, CrateOperatorType, Crate } from 'types/crate';
import { BoxIcon } from '../../../components/BoxIcon';

interface NewSmartCrateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCrateCreated: () => void;
  editingCrate?: Crate | null; // Optional crate to edit
}

// Smart crate colors - diverse palette to distinguish from manual crates
const SMART_CRATE_COLORS = [
  '#3b82f6', // Blue (default)
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#10b981', // Green
  '#ec4899', // Pink
  '#f59e0b', // Amber/Orange
  '#ef4444', // Red
  '#a855f7', // Bright Purple
  '#ffff00', // Yellow (FIXED: added #)
  '#00ff00', // Bright Green
  '#008080', // Teal
  '#808080', // Gray
  '#000000', // Black
  '#8b4513', // Brown
];

// Curated smart-crate fields (album curation, not maintenance internals)
const FIELD_OPTIONS: { value: CrateFieldType; label: string; type: 'text' | 'number' | 'date' | 'boolean' | 'array' }[] = [
  { value: 'artist', label: 'Artist', type: 'text' },
  { value: 'title', label: 'Album Title', type: 'text' },
  { value: 'format', label: 'Format', type: 'text' },
  { value: 'country', label: 'Country', type: 'text' },
  { value: 'label', label: 'Label', type: 'text' },
  { value: 'location', label: 'Location', type: 'text' },
  { value: 'status', label: 'Status', type: 'text' },
  { value: 'media_condition', label: 'Media Condition', type: 'text' },
  { value: 'sleeve_condition', label: 'Sleeve Condition', type: 'text' },
  { value: 'year_int', label: 'Year', type: 'number' },
  { value: 'decade', label: 'Decade', type: 'number' },
  { value: 'my_rating', label: 'My Rating', type: 'number' },
  { value: 'play_count', label: 'Play Count', type: 'number' },
  { value: 'date_added', label: 'Date Added', type: 'date' },
  { value: 'last_played_at', label: 'Last Played Date', type: 'date' },
  { value: 'for_sale', label: 'For Sale', type: 'boolean' },
  { value: 'is_live', label: 'Is Live', type: 'boolean' },
  { value: 'custom_tags', label: 'Tags', type: 'array' },
  { value: 'genres', label: 'Genre', type: 'array' },
  { value: 'signed_by', label: 'Signed By', type: 'array' },
];

const COUNTRY_OPTIONS = ['US', 'UK', 'Canada', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Austria', 'Switzerland', 'Japan', 'Australia', 'New Zealand', 'Brazil', 'Mexico', 'Argentina', 'Russia', 'Poland', 'Czech Republic', 'Hungary', 'Portugal', 'Greece', 'Ireland', 'Israel', 'South Korea', 'China', 'India', 'Europe', 'UK & Europe', 'USA & Canada'];
const FORMAT_OPTIONS = ['Vinyl', 'CD', 'Cassette', '8-Track Cartridge', 'SACD', 'DVD', 'All Media', 'Box Set', 'Flexi-disc', 'LP', 'EP', 'Single', '7"', '10"', '12"'];
const STATUS_OPTIONS = ['active', 'for_sale', 'sold', 'wishlist', 'incoming'];
const CONDITION_OPTIONS = ['Sealed', 'Mint (M)', 'Near Mint (NM or M-)', 'Very Good Plus (VG+)', 'Very Good (VG)', 'Good Plus (G+)', 'Good (G)', 'Fair (F)', 'Poor (P)', 'Generic', 'No Cover'];

const DROPDOWN_OPTIONS: Partial<Record<CrateFieldType, string[]>> = {
  country: COUNTRY_OPTIONS,
  format: FORMAT_OPTIONS,
  status: STATUS_OPTIONS,
  media_condition: CONDITION_OPTIONS,
  sleeve_condition: CONDITION_OPTIONS,
};

const DROPDOWN_FIELDS = new Set<CrateFieldType>(['country', 'format', 'status', 'media_condition', 'sleeve_condition', 'genres', 'custom_tags', 'signed_by']);
const SUPPORTED_FIELDS = new Set<CrateFieldType>(FIELD_OPTIONS.map((field) => field.value));
const LEGACY_RULE_FIELD_MAP: Partial<Record<string, CrateFieldType>> = {
  discogs_genres: 'genres',
  spotify_genres: 'genres',
  labels: 'label',
  catalog_number: 'cat_no',
};

// Get operators for a field type
function getOperatorsForFieldType(fieldType: string): { value: CrateOperatorType; label: string }[] {
  switch (fieldType) {
    case 'text':
      return [
        { value: 'contains', label: 'Contains' },
        { value: 'is', label: 'Is' },
        { value: 'is_not', label: 'Is Not' },
        { value: 'does_not_contain', label: 'Does Not Contain' },
      ];
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
      return [
        { value: 'is', label: 'Is' },
      ];
    case 'array':
      return [
        { value: 'includes', label: 'Includes' },
        { value: 'excludes', label: 'Excludes' },
      ];
    default:
      return [];
  }
}

export function NewSmartCrateModal({ isOpen, onClose, onCrateCreated, editingCrate }: NewSmartCrateModalProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('#3b82f6'); // Color for smart crate box
  const [matchRules, setMatchRules] = useState<'all' | 'any'>('all');
  const [liveUpdate, setLiveUpdate] = useState(true);
  const [rules, setRules] = useState<SmartRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!editingCrate;

  // Populate form when editing
  useEffect(() => {
    if (editingCrate && editingCrate.is_smart) {
      setName(editingCrate.name);
      setIcon(editingCrate.icon);
      setMatchRules(editingCrate.match_rules);
      setLiveUpdate(editingCrate.live_update);
      const normalizedRules = (editingCrate.smart_rules?.rules || [])
        .map((rule) => ({
          ...rule,
          field: LEGACY_RULE_FIELD_MAP[rule.field] ?? rule.field,
        }))
        .filter((rule) => SUPPORTED_FIELDS.has(rule.field));
      setRules(normalizedRules);
    }
  }, [editingCrate]);

  if (!isOpen) return null;

  const handleAddRule = () => {
    setRules([
      ...rules,
      {
        field: 'artist',
        operator: 'contains',
        value: '',
      },
    ]);
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleRuleChange = (index: number, field: keyof SmartRule, value: string | number | boolean) => {
    const newRules = [...rules];
    
    // If changing field, reset operator and value
    if (field === 'field') {
      const fieldDef = FIELD_OPTIONS.find((f) => f.value === value);
      const operators = getOperatorsForFieldType(fieldDef?.type || 'text');
      newRules[index] = {
        field: value as CrateFieldType,
        operator: operators[0]?.value || 'contains',
        value: '',
      };
    } else if (field === 'operator') {
      newRules[index] = {
        ...newRules[index],
        operator: value as CrateOperatorType,
        value: value === 'between' ? { min: '', max: '' } : '',
      };
    } else {
      newRules[index] = {
        ...newRules[index],
        [field]: value,
      };
    }
    
    setRules(newRules);
  };

  const isBetweenValue = (value: SmartRule['value']): value is { min: string | number; max: string | number } =>
    typeof value === 'object' && value !== null && 'min' in value && 'max' in value;

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

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Crate name is required');
      return;
    }

    if (rules.length === 0) {
      setError('At least one rule is required');
      return;
    }

    // Validate all rules have values
    const invalidRule = rules.find((r) => {
      if (r.operator === 'between') {
        if (!isBetweenValue(r.value)) return true;
        return String(r.value.min).trim() === '' || String(r.value.max).trim() === '';
      }
      return r.value === '' || r.value === null || r.value === undefined;
    });
    if (invalidRule) {
      setError('All rules must have a value');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isEditing) {
        // UPDATE existing smart crate
        const { error: updateError } = await supabase
          .from('crates')
          .update({
            name: name.trim(),
            icon,
            smart_rules: { rules } as unknown as import('types/supabase').Json,
            match_rules: matchRules,
            live_update: liveUpdate,
          })
          .eq('id', editingCrate.id);

        if (updateError) {
          setError(updateError.message);
          setSaving(false);
          return;
        }
      } else {
        // INSERT new smart crate
        // Get the highest sort_order and add 1
        const { data: existingCrates } = await supabase
          .from('crates')
          .select('sort_order')
          .order('sort_order', { ascending: false })
          .limit(1);

        const nextSortOrder = existingCrates && existingCrates.length > 0 
          ? (existingCrates[0].sort_order || 0) + 1 
          : 0;

        const { error: insertError } = await supabase
          .from('crates')
          .insert({
            name: name.trim(),
            icon, // Color value (e.g., "#3b82f6")
            color: icon, // Same color value for consistency
            is_smart: true,
            smart_rules: { rules } as unknown as import('types/supabase').Json,
            match_rules: matchRules,
            live_update: liveUpdate,
            sort_order: nextSortOrder,
          });

        if (insertError) {
          setError(insertError.message);
          setSaving(false);
          return;
        }
      }

      // Success
      onCrateCreated();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'create'} smart crate`);
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!isEditing) {
      setName('');
      setIcon('#3b82f6'); // Reset to default blue
      setMatchRules('all');
      setLiveUpdate(true);
      setRules([]);
    }
    setError(null);
    setSaving(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30002]"
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg w-[700px] max-h-[90vh] flex flex-col shadow-xl"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
          <h2 className="m-0 text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Smart Crate' : 'New Smart Crate'}
          </h2>
          <button
            onClick={handleClose}
            className="bg-transparent border-none text-2xl cursor-pointer text-gray-500 p-0 leading-none hover:text-gray-700"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-md text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* Name and Icon */}
          <div className="flex gap-4 mb-5">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Crate Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter crate name..."
                autoFocus
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Box Color
              </label>
              <div className="flex gap-2 flex-wrap max-w-[400px]">
                {SMART_CRATE_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setIcon(color)}
                    className={`w-12 h-12 border rounded-md cursor-pointer flex items-center justify-center p-1 ${
                      icon === color ? 'border-gray-900 ring-2 ring-gray-200' : 'border-gray-300 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <BoxIcon color={color} size={32} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Match Rules */}
          <div className="mb-5 flex gap-4 items-center">
            <label className="text-sm font-semibold text-gray-700">
              Match Rules:
            </label>
            <select
              value={matchRules}
              onChange={(e) => setMatchRules(e.target.value as 'all' | 'any')}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 outline-none cursor-pointer bg-white focus:border-blue-500"
            >
              <option value="all">All</option>
              <option value="any">Any</option>
            </select>
          </div>

          {/* Rules Section */}
          <div className="mb-5">
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Rules
            </div>

            {rules.length === 0 ? (
              <div className="p-6 bg-gray-50 rounded-md text-center text-gray-500 text-sm border border-gray-200 border-dashed">
                No rules yet. Click &quot;Add Rule&quot; to get started.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {rules.map((rule, index) => {
                  const fieldDef = FIELD_OPTIONS.find((f) => f.value === rule.field);
                  const operators = getOperatorsForFieldType(fieldDef?.type || 'text');
                  const dropdownOptions = rule.field in DROPDOWN_OPTIONS ? (DROPDOWN_OPTIONS[rule.field] ?? []) : [];
                  const usesDropdown = DROPDOWN_FIELDS.has(rule.field) && dropdownOptions.length > 0;

                  return (
                    <div
                      key={index}
                      className="flex gap-2 p-3 bg-gray-50 rounded-md border border-gray-200 items-center"
                    >
                      {/* Field Dropdown */}
                      <select
                        value={rule.field}
                        onChange={(e) => handleRuleChange(index, 'field', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 outline-none cursor-pointer bg-white"
                      >
                        {FIELD_OPTIONS.map((field) => (
                          <option key={field.value} value={field.value}>
                            {field.label}
                          </option>
                        ))}
                      </select>

                      {/* Operator Dropdown */}
                      <select
                        value={rule.operator}
                        onChange={(e) => handleRuleChange(index, 'operator', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 outline-none cursor-pointer bg-white"
                      >
                        {operators.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>

                      {/* Value Input */}
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
                        <select
                          value={String(rule.value)}
                          onChange={(e) => handleRuleChange(index, 'value', e.target.value === 'true')}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 outline-none cursor-pointer bg-white"
                        >
                          <option value="true">True</option>
                          <option value="false">False</option>
                        </select>
                      ) : usesDropdown ? (
                        <select
                          value={String(rule.value)}
                          onChange={(e) => handleRuleChange(index, 'value', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 outline-none cursor-pointer bg-white"
                        >
                          <option value="">Select value...</option>
                          {dropdownOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : fieldDef?.type === 'date' ? (
                        <input
                          type="date"
                          value={String(rule.value)}
                          onChange={(e) => handleRuleChange(index, 'value', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 outline-none bg-white"
                        />
                      ) : fieldDef?.type === 'number' ? (
                        <input
                          type="number"
                          value={String(rule.value)}
                          onChange={(e) => handleRuleChange(index, 'value', Number(e.target.value))}
                          placeholder="Value..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 outline-none bg-white"
                        />
                      ) : (
                        <input
                          type="text"
                          value={String(rule.value)}
                          onChange={(e) => handleRuleChange(index, 'value', e.target.value)}
                          placeholder="Value..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 outline-none bg-white"
                        />
                      )}

                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemoveRule(index)}
                        className="p-2 bg-red-500 text-white border-none rounded cursor-pointer leading-none hover:bg-red-600 w-8 h-8 flex items-center justify-center text-lg"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Rule Button */}
            <button
              onClick={handleAddRule}
              className="mt-3 px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-md text-sm font-medium cursor-pointer flex items-center gap-1.5 hover:bg-gray-200"
            >
              <span>+</span>
              <span>Add Rule</span>
            </button>
          </div>

          {/* Live Update Checkbox */}
          <div className="mb-5">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                checked={liveUpdate}
                onChange={(e) => setLiveUpdate(e.target.checked)}
                className="cursor-pointer accent-blue-600"
              />
              <span>Live Update (automatically update when albums change)</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={saving}
            className={`px-4 py-2 bg-gray-100 text-gray-700 border-none rounded text-sm font-medium cursor-pointer hover:bg-gray-200 ${
              saving ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || rules.length === 0}
            className={`px-4 py-2 bg-blue-500 text-white border-none rounded text-sm font-medium cursor-pointer hover:bg-blue-600 ${
              saving || !name.trim() || rules.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {saving ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Smart Crate')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewSmartCrateModal;
// AUDIT: inspected, no changes.
