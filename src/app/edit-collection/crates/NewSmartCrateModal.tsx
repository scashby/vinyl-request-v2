// src/app/edit-collection/crates/NewSmartCrateModal.tsx
'use client';

import { useState } from 'react';
import { supabase } from 'lib/supabaseClient';
import type { SmartRule, CrateFieldType, CrateOperatorType } from 'types/crate';

interface NewSmartCrateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCrateCreated: () => void;
}

const PRESET_ICONS = ['⚡', '🎵', '🔥', '⭐', '💎', '🎧', '🎸', '🎹', '🎤', '🎺', '🎷', '🥁'];

// Field definitions with their types
const FIELD_OPTIONS: { value: CrateFieldType; label: string; type: 'text' | 'number' | 'date' | 'boolean' | 'array' }[] = [
  // Text fields
  { value: 'artist', label: 'Artist', type: 'text' },
  { value: 'title', label: 'Album Title', type: 'text' },
  { value: 'format', label: 'Format', type: 'text' },
  { value: 'country', label: 'Country', type: 'text' },
  { value: 'location', label: 'Location', type: 'text' },
  { value: 'owner', label: 'Owner', type: 'text' },
  { value: 'notes', label: 'Notes', type: 'text' },
  { value: 'barcode', label: 'Barcode', type: 'text' },
  { value: 'cat_no', label: 'Catalog Number', type: 'text' },
  
  // Number fields
  { value: 'year_int', label: 'Year', type: 'number' },
  { value: 'my_rating', label: 'My Rating', type: 'number' },
  { value: 'play_count', label: 'Play Count', type: 'number' },
  { value: 'discs', label: 'Disc Count', type: 'number' },
  { value: 'sides', label: 'Sides', type: 'number' },
  { value: 'index_number', label: 'Index Number', type: 'number' },
  { value: 'decade', label: 'Decade', type: 'number' },
  
  // Date fields
  { value: 'date_added', label: 'Date Added', type: 'date' },
  { value: 'purchase_date', label: 'Purchase Date', type: 'date' },
  { value: 'last_played_date', label: 'Last Played Date', type: 'date' },
  { value: 'original_release_date', label: 'Original Release Date', type: 'date' },
  { value: 'recording_date', label: 'Recording Date', type: 'date' },
  { value: 'last_cleaned_date', label: 'Last Cleaned Date', type: 'date' },
  
  // Boolean fields
  { value: 'for_sale', label: 'For Sale', type: 'boolean' },
  { value: 'is_live', label: 'Is Live', type: 'boolean' },
  { value: 'is_1001', label: '1001 Albums', type: 'boolean' },
  
  // Array fields
  { value: 'custom_tags', label: 'Tags', type: 'array' },
  { value: 'discogs_genres', label: 'Discogs Genres', type: 'array' },
  { value: 'spotify_genres', label: 'Spotify Genres', type: 'array' },
  { value: 'labels', label: 'Labels', type: 'array' },
];

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
      ];
    case 'date':
      return [
        { value: 'is', label: 'Is' },
        { value: 'before', label: 'Before' },
        { value: 'after', label: 'After' },
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

export function NewSmartCrateModal({ isOpen, onClose, onCrateCreated }: NewSmartCrateModalProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('⚡');
  const [matchRules, setMatchRules] = useState<'all' | 'any'>('all');
  const [liveUpdate, setLiveUpdate] = useState(true);
  const [rules, setRules] = useState<SmartRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } else {
      newRules[index] = {
        ...newRules[index],
        [field]: value,
      };
    }
    
    setRules(newRules);
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
    const invalidRule = rules.find((r) => r.value === '' || r.value === null || r.value === undefined);
    if (invalidRule) {
      setError('All rules must have a value');
      return;
    }

    setSaving(true);
    setError(null);

    try {
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
          icon,
          color: '#3578b3',
          is_smart: true,
          smart_rules: { rules },
          match_rules: matchRules,
          live_update: liveUpdate,
          sort_order: nextSortOrder,
        });

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }

      // Success
      onCrateCreated();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create smart crate');
      setSaving(false);
    }
  };

  const handleClose = () => {
    setName('');
    setIcon('⚡');
    setMatchRules('all');
    setLiveUpdate(true);
    setRules([]);
    setError(null);
    setSaving(false);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 30001,
      }}
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          width: '700px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111827' }}>
            New Smart Crate
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '0',
              lineHeight: '1',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {error && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px',
                background: '#fee2e2',
                border: '1px solid #ef4444',
                borderRadius: '6px',
                color: '#991b1b',
                fontSize: '14px',
              }}
            >
              {error}
            </div>
          )}

          {/* Name and Icon */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px',
                }}
              >
                Crate Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter crate name..."
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#111827',
                  outline: 'none',
                }}
              />
            </div>
            
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px',
                }}
              >
                Icon
              </label>
              <div style={{ display: 'flex', gap: '4px' }}>
                {PRESET_ICONS.slice(0, 6).map((presetIcon) => (
                  <button
                    key={presetIcon}
                    onClick={() => setIcon(presetIcon)}
                    style={{
                      width: '40px',
                      height: '40px',
                      border: icon === presetIcon ? '2px solid #3b82f6' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      background: icon === presetIcon ? '#eff6ff' : 'white',
                      cursor: 'pointer',
                      fontSize: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {presetIcon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Match Rules */}
          <div style={{ marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <label
              style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
              }}
            >
              Match Rules:
            </label>
            <select
              value={matchRules}
              onChange={(e) => setMatchRules(e.target.value as 'all' | 'any')}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#111827',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all">All</option>
              <option value="any">Any</option>
            </select>
          </div>

          {/* Rules Section */}
          <div style={{ marginBottom: '20px' }}>
            <div
              style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '12px',
              }}
            >
              Rules
            </div>

            {rules.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  background: '#f9fafb',
                  borderRadius: '6px',
                  textAlign: 'center',
                  color: '#6b7280',
                  fontSize: '14px',
                }}
              >
                No rules yet. Click &quot;Add Rule&quot; to get started.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {rules.map((rule, index) => {
                  const fieldDef = FIELD_OPTIONS.find((f) => f.value === rule.field);
                  const operators = getOperatorsForFieldType(fieldDef?.type || 'text');

                  return (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        gap: '8px',
                        padding: '12px',
                        background: '#f9fafb',
                        borderRadius: '6px',
                        alignItems: 'center',
                      }}
                    >
                      {/* Field Dropdown */}
                      <select
                        value={rule.field}
                        onChange={(e) => handleRuleChange(index, 'field', e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '13px',
                          color: '#111827',
                          outline: 'none',
                          cursor: 'pointer',
                        }}
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
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '13px',
                          color: '#111827',
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {operators.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>

                      {/* Value Input */}
                      {fieldDef?.type === 'boolean' ? (
                        <select
                          value={String(rule.value)}
                          onChange={(e) => handleRuleChange(index, 'value', e.target.value === 'true')}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '13px',
                            color: '#111827',
                            outline: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="true">True</option>
                          <option value="false">False</option>
                        </select>
                      ) : fieldDef?.type === 'date' ? (
                        <input
                          type="date"
                          value={String(rule.value)}
                          onChange={(e) => handleRuleChange(index, 'value', e.target.value)}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '13px',
                            color: '#111827',
                            outline: 'none',
                          }}
                        />
                      ) : fieldDef?.type === 'number' ? (
                        <input
                          type="number"
                          value={String(rule.value)}
                          onChange={(e) => handleRuleChange(index, 'value', Number(e.target.value))}
                          placeholder="Value..."
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '13px',
                            color: '#111827',
                            outline: 'none',
                          }}
                        />
                      ) : (
                        <input
                          type="text"
                          value={String(rule.value)}
                          onChange={(e) => handleRuleChange(index, 'value', e.target.value)}
                          placeholder="Value..."
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '13px',
                            color: '#111827',
                            outline: 'none',
                          }}
                        />
                      )}

                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemoveRule(index)}
                        style={{
                          padding: '6px 10px',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '16px',
                          cursor: 'pointer',
                          lineHeight: '1',
                        }}
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
              style={{
                marginTop: '12px',
                padding: '8px 16px',
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>+</span>
              <span>Add Rule</span>
            </button>
          </div>

          {/* Live Update Checkbox */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#374151',
              }}
            >
              <input
                type="checkbox"
                checked={liveUpdate}
                onChange={(e) => setLiveUpdate(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>Live Update (automatically update when albums change)</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            onClick={handleClose}
            disabled={saving}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || rules.length === 0}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: saving || !name.trim() || rules.length === 0 ? 'not-allowed' : 'pointer',
              opacity: saving || !name.trim() || rules.length === 0 ? 0.5 : 1,
            }}
          >
            {saving ? 'Creating...' : 'Create Smart Crate'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewSmartCrateModal;