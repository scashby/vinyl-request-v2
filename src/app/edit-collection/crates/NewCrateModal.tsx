// src/app/edit-collection/crates/NewCrateModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from 'lib/supabaseClient';
import type { Crate } from 'types/crate';

interface NewCrateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCrateCreated: (crateId: number) => void;
  editingCrate?: Crate | null; // Optional crate to edit
}

const PRESET_ICONS = [
  '📦',
  '🎱', // Bingo
  '❓', // Trivia
  '🏆', // Brackets
  '🎮', // Other games
  '🎵',
  '🎧',
  '🔥',
  '⭐',
  '💎',
  '🎸',
  '🎤',
  '🎺',
  '🥁',
];
const PRESET_COLORS = [
  '#3578b3', // Default blue
  '#ef4444', // Red
  '#f59e0b', // Orange
  '#10b981', // Green
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
];

export function NewCrateModal({ isOpen, onClose, onCrateCreated, editingCrate }: NewCrateModalProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📦');
  const [color, setColor] = useState('#3578b3');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!editingCrate;

  // Populate form when editing
  useEffect(() => {
    if (editingCrate) {
      setName(editingCrate.name);
      setIcon(editingCrate.icon);
      setColor(editingCrate.color);
    }
  }, [editingCrate]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Crate name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isEditing) {
        // UPDATE existing crate
        const { error: updateError } = await supabase
          .from('crates')
          .update({
            name: name.trim(),
            icon,
            color,
          })
          .eq('id', editingCrate.id);

        if (updateError) {
          setError(updateError.message);
          setSaving(false);
          return;
        }

        // Success - pass existing crate ID
        onCrateCreated(editingCrate.id);
        handleClose();
      } else {
        // INSERT new crate
        // Get the highest sort_order and add 1
        const { data: existingCrates } = await supabase
          .from('crates')
          .select('sort_order')
          .order('sort_order', { ascending: false })
          .limit(1);

        const nextSortOrder = existingCrates && existingCrates.length > 0 
          ? (existingCrates[0].sort_order || 0) + 1 
          : 0;

        const { data: newCrate, error: insertError } = await supabase
          .from('crates')
          .insert({
            name: name.trim(),
            icon,
            color,
            is_smart: false,
            smart_rules: null,
            match_rules: 'all',
            live_update: true,
            sort_order: nextSortOrder,
          })
          .select('id')
          .single();

        if (insertError || !newCrate) {
          setError(insertError?.message || 'Failed to create crate');
          setSaving(false);
          return;
        }

        // Success - pass new crate ID
        onCrateCreated(newCrate.id);
        handleClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'create'} crate`);
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!isEditing) {
      setName('');
      setIcon('📦');
      setColor('#3578b3');
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
        className="bg-white rounded-lg w-[480px] shadow-xl"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
          <h2 className="m-0 text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Crate' : 'New Crate'}
          </h2>
          <button
            onClick={handleClose}
            className="bg-transparent border-none text-2xl cursor-pointer text-gray-500 p-0 leading-none hover:text-gray-700"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-500 rounded-md text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* Name Input */}
          <div className="mb-5">
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSave();
                }
              }}
            />
          </div>

          {/* Icon Picker */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Icon
            </label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_ICONS.map((presetIcon) => (
                <button
                  key={presetIcon}
                  onClick={() => setIcon(presetIcon)}
                  className={`w-12 h-12 border rounded-md cursor-pointer text-2xl flex items-center justify-center ${
                    icon === presetIcon 
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' 
                      : 'border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                >
                  {presetIcon}
                </button>
              ))}
            </div>
          </div>

          {/* Color Picker */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  onClick={() => setColor(presetColor)}
                  className={`w-12 h-12 rounded-md cursor-pointer ${
                    color === presetColor ? 'border-[3px] border-gray-900' : 'border border-gray-300'
                  }`}
                  style={{ backgroundColor: presetColor }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 bg-gray-50 rounded-md flex items-center gap-3 border border-gray-200">
            <div className="text-4xl leading-none">
              {icon}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">
                {name || 'Untitled Crate'}
              </div>
              <div className="text-xs text-gray-500">Manual Crate</div>
            </div>
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
            disabled={saving || !name.trim()}
            className={`px-4 py-2 bg-blue-500 text-white border-none rounded text-sm font-medium cursor-pointer hover:bg-blue-600 ${
              saving || !name.trim() ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {saving ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Crate')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewCrateModal;
// AUDIT: inspected, no changes.
