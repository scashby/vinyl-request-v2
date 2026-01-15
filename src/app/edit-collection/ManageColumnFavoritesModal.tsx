// src/app/edit-collection/ManageColumnFavoritesModal.tsx
'use client';

import { useState } from 'react';

export interface ColumnFavorite {
  id: string;
  name: string;
  columns: string[];
}

interface ManageColumnFavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  favorites: ColumnFavorite[];
  onSave: (favorites: ColumnFavorite[]) => void;
  selectedId: string;
  onSelect: (id: string) => void;
}

const COLUMN_FIELDS = {
  Main: ['Artist', 'Artist Sort', 'Barcode', 'Cat No', 'Format', 'Genre', 'Label', 'Original Release Date', 'Original Release Year', 'Recording Date', 'Recording Year', 'Release Date', 'Release Year', 'Sort Title', 'Subtitle', 'Title'],
  Details: ['Box Set', 'Country', 'Extra', 'Is Live', 'Media Condition', 'Package/Sleeve Condition', 'Packaging', 'RPM', 'Sound', 'SPARS', 'Storage Device', 'Storage Device Slot', 'Studio', 'Vinyl Color', 'Vinyl Weight'],
  Edition: ['Discs', 'Length', 'Tracks'],
  Classical: ['Chorus', 'Composer', 'Composition', 'Conductor', 'Orchestra'],
  People: ['Engineer', 'Musician', 'Producer', 'Songwriter'],
  Personal: ['Added Date', 'Added Year', 'Collection Status', 'Current Value', 'Index', 'Last Cleaned Date', 'Last Cleaned Year', 'Last Played Date', 'Location', 'Modified Date', 'My Rating', 'Notes', 'Owner', 'Play Count', 'Played Year', 'Purchase Date', 'Purchase Price', 'Purchase Store', 'Purchase Year', 'Quantity', 'Signed by', 'Tags'],
  Loan: ['Due Date', 'Loan Date', 'Loaned To'],
};

export function ManageColumnFavoritesModal({
  isOpen,
  onClose,
  favorites,
  onSave,
  selectedId,
  onSelect
}: ManageColumnFavoritesModalProps) {
  const [localFavorites, setLocalFavorites] = useState<ColumnFavorite[]>(favorites);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [selectedFavoriteForEdit, setSelectedFavoriteForEdit] = useState<ColumnFavorite | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Main']));

  if (!isOpen) return null;

  const handleEdit = (favorite: ColumnFavorite) => {
    setSelectedFavoriteForEdit(favorite);
    setShowColumnSelector(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this favorite?')) {
      setLocalFavorites(localFavorites.filter(f => f.id !== id));
    }
  };

  const handleRename = (id: string) => {
    const favorite = localFavorites.find(f => f.id === id);
    if (favorite) {
      setEditingId(id);
      setEditingName(favorite.name);
    }
  };

  const handleSaveRename = () => {
    if (editingId && editingName.trim()) {
      setLocalFavorites(localFavorites.map(f =>
        f.id === editingId ? { ...f, name: editingName.trim() } : f
      ));
      setEditingId(null);
      setEditingName('');
    }
  };

  const handleAddNew = () => {
    const newId = `favorite-${Date.now()}`;
    const newFavorite: ColumnFavorite = {
      id: newId,
      name: 'New Favorite',
      columns: ['Artist', 'Title']
    };
    setLocalFavorites([...localFavorites, newFavorite]);
    setSelectedFavoriteForEdit(newFavorite);
    setShowColumnSelector(true);
  };

  const handleSaveColumns = (columns: string[]) => {
    if (selectedFavoriteForEdit) {
      setLocalFavorites(localFavorites.map(f =>
        f.id === selectedFavoriteForEdit.id ? { ...f, columns } : f
      ));
      setShowColumnSelector(false);
      setSelectedFavoriteForEdit(null);
    }
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-[31000]"
        onClick={onClose}
      />

      <div
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-md max-h-[80vh] flex flex-col z-[31001] shadow-xl transition-all duration-200 ${
          showColumnSelector ? 'w-full max-w-[900px]' : 'w-full max-w-[600px]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#FF8C42] text-white px-4 py-3 rounded-t-md flex justify-between items-center">
          <h2 className="m-0 text-base font-semibold">
            Manage Column Favorites
          </h2>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-white text-2xl cursor-pointer p-1 leading-none hover:text-white/80"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Favorites List */}
          <div className={`flex flex-col border-r border-gray-200 ${
            showColumnSelector ? 'w-[280px]' : 'w-full border-none'
          }`}>
            <div className="p-4 border-b border-gray-200">
              <button
                onClick={handleAddNew}
                className="w-full py-2 px-3 bg-blue-400 text-white border-none rounded text-[13px] font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:bg-blue-500"
              >
                <span className="text-base">+</span>
                <span>New Favorite</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {localFavorites.map(favorite => (
                <div
                  key={favorite.id}
                  className={`mb-1 border rounded transition-colors ${
                    selectedId === favorite.id 
                      ? 'border-blue-400 bg-blue-50' 
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 p-2">
                    <input
                      type="radio"
                      checked={selectedId === favorite.id}
                      onChange={() => onSelect(favorite.id)}
                      className="cursor-pointer"
                    />
                    {editingId === favorite.id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={handleSaveRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        className="flex-1 px-1.5 py-1 border border-blue-400 rounded text-[13px] text-gray-900 outline-none"
                      />
                    ) : (
                      <span className="flex-1 text-[13px] font-medium text-gray-900">
                        {favorite.name}
                      </span>
                    )}
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(favorite)}
                        title="Edit columns"
                        className="p-1 bg-transparent border-none cursor-pointer text-sm hover:scale-110"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleRename(favorite.id)}
                        title="Rename"
                        className="p-1 bg-transparent border-none cursor-pointer text-sm hover:scale-110"
                      >
                        📝
                      </button>
                      <button
                        onClick={() => handleDelete(favorite.id)}
                        title="Delete"
                        className="p-1 bg-transparent border-none cursor-pointer text-sm text-red-500 hover:text-red-600 hover:scale-110"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div className="px-2 pb-2 pl-8 text-[11px] text-gray-400">
                    {favorite.columns.length} columns
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column Selector */}
          {showColumnSelector && selectedFavoriteForEdit && (
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <h3 className="m-0 text-sm font-semibold text-gray-800">
                  Select Columns for: {selectedFavoriteForEdit.name}
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {Object.entries(COLUMN_FIELDS).map(([groupName, fields]) => {
                  const isExpanded = expandedGroups.has(groupName);
                  return (
                    <div key={groupName} className="mb-1">
                      <button
                        onClick={() => toggleGroup(groupName)}
                        className="w-full flex items-center gap-2 p-2 bg-[#2C2C2C] text-white border-none rounded cursor-pointer text-[13px] font-semibold text-left hover:bg-[#3a3a3a]"
                      >
                        <span className={`text-[10px] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                          ▶
                        </span>
                        <span>{groupName}</span>
                      </button>

                      {isExpanded && (
                        <div className="pl-7 pt-1">
                          {fields.map(field => {
                            const isSelected = selectedFavoriteForEdit.columns.includes(field);

                            return (
                              <label
                                key={field}
                                className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer text-[13px] rounded mb-0.5 text-gray-900 transition-colors ${
                                  isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const newColumns = e.target.checked
                                      ? [...selectedFavoriteForEdit.columns, field]
                                      : selectedFavoriteForEdit.columns.filter(c => c !== field);
                                    setSelectedFavoriteForEdit({
                                      ...selectedFavoriteForEdit,
                                      columns: newColumns
                                    });
                                  }}
                                  className="cursor-pointer accent-blue-500"
                                />
                                <span>{field}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={() => handleSaveColumns(selectedFavoriteForEdit.columns)}
                  className="w-full py-2 px-3 bg-blue-400 text-white border-none rounded text-[13px] font-semibold cursor-pointer hover:bg-blue-500"
                >
                  Save Column Selection
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 border border-gray-300 rounded text-[13px] cursor-pointer text-gray-800 hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(localFavorites);
            }}
            className="px-4 py-2 bg-blue-400 text-white border-none rounded text-[13px] font-semibold cursor-pointer hover:bg-blue-500"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}