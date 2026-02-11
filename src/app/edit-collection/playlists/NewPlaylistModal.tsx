'use client';

import { useEffect, useState } from 'react';
import type { CollectionPlaylist } from '../../../types/collectionPlaylist';
import { SHARED_COLOR_PRESETS, SHARED_ICON_PRESETS } from '../iconPresets';

interface NewPlaylistModalProps {
  isOpen: boolean;
  editingPlaylist: CollectionPlaylist | null;
  onClose: () => void;
  onCreate: (playlist: { name: string; icon: string; color: string }) => Promise<void>;
  onUpdate: (playlist: CollectionPlaylist) => Promise<void>;
}

export function NewPlaylistModal({ isOpen, editingPlaylist, onClose, onCreate, onUpdate }: NewPlaylistModalProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🎵');
  const [color, setColor] = useState('#3578b3');
  const [iconSearch, setIconSearch] = useState('');
  const [customIcon, setCustomIcon] = useState('');
  const isEditing = !!editingPlaylist;

  useEffect(() => {
    if (!isOpen) return;
    if (editingPlaylist) {
      setName(editingPlaylist.name);
      setIcon(editingPlaylist.icon);
      setColor(editingPlaylist.color);
      setCustomIcon(editingPlaylist.icon);
      return;
    }
    setName('');
    setIcon('🎵');
    setColor('#3578b3');
    setIconSearch('');
    setCustomIcon('');
  }, [editingPlaylist, isOpen]);

  const firstIconFromInput = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return Array.from(trimmed)[0] ?? '';
  };

  const filteredIcons = SHARED_ICON_PRESETS.filter((preset) => {
    const q = iconSearch.trim().toLowerCase();
    if (!q) return true;
    return preset.icon.includes(q) || preset.keywords.some((keyword) => keyword.includes(q));
  });

  const handleClose = () => {
    setName('');
    setIcon('🎵');
    setColor('#3578b3');
    setIconSearch('');
    setCustomIcon('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30002]" onClick={handleClose}>
      <div className="bg-white rounded-lg w-[760px] max-h-[86vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
          <h2 className="m-0 text-lg font-semibold text-gray-900">{isEditing ? 'Edit Playlist' : 'New Playlist'}</h2>
          <button onClick={handleClose} className="bg-transparent border-none text-2xl cursor-pointer text-gray-500 p-0 leading-none hover:text-gray-700">×</button>
        </div>
        <div className="p-6 overflow-y-auto">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Playlist Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Bingo Round 1"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-5"
          />
          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Icon</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={customIcon}
                onChange={(e) => {
                  const value = e.target.value;
                  setCustomIcon(value);
                  const parsed = firstIconFromInput(value);
                  if (parsed) setIcon(parsed);
                }}
                placeholder="Paste any emoji"
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
              <input
                type="text"
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value)}
                placeholder="Filter"
                className="w-[110px] px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
            <div className="flex gap-2 flex-wrap max-h-[280px] overflow-y-auto pr-1">
              {filteredIcons.map((preset) => (
                <button
                  key={preset.icon}
                  onClick={() => {
                    setIcon(preset.icon);
                    setCustomIcon(preset.icon);
                  }}
                  className={`w-12 h-12 border rounded-md cursor-pointer text-2xl flex items-center justify-center ${icon === preset.icon ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-gray-300 bg-white hover:bg-gray-50'}`}
                  title={preset.keywords.join(', ')}
                >
                  {preset.icon}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {SHARED_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setColor(preset)}
                  className={`w-12 h-12 rounded-md cursor-pointer ${color === preset ? 'border-[3px] border-gray-900' : 'border border-gray-300'}`}
                  style={{ backgroundColor: preset }}
                />
              ))}
            </div>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-2 w-14 h-8 border border-gray-300 rounded cursor-pointer" />
          </div>

          <div className="p-4 bg-gray-50 rounded-md flex items-center gap-3 border border-gray-200">
            <div className="text-4xl leading-none" style={{ color }}>
              {icon}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">{name || 'Untitled Playlist'}</div>
              <div className="text-xs text-gray-500">Track Playlist</div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={handleClose} className="px-4 py-2 bg-gray-100 text-gray-700 border-none rounded text-sm font-medium cursor-pointer hover:bg-gray-200">Cancel</button>
          <button
            onClick={async () => {
              if (!name.trim()) return;
              if (editingPlaylist) {
                await onUpdate({
                  ...editingPlaylist,
                  name: name.trim(),
                  icon,
                  color,
                });
              } else {
                await onCreate({ name: name.trim(), icon, color });
              }
              handleClose();
            }}
            disabled={!name.trim()}
            className={`px-4 py-2 text-white border-none rounded text-sm font-medium cursor-pointer ${name.trim() ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-300 cursor-not-allowed'}`}
          >
            {isEditing ? 'Save Changes' : 'Create Playlist'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewPlaylistModal;
