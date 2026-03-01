// src/app/edit-collection/ManageSortFavoritesModal.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

export interface SortField {
  field: string;
  direction: 'asc' | 'desc';
}

export interface SortFavorite {
  id: string;
  name: string;
  fields: SortField[];
}

interface ManageSortFavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  favorites: SortFavorite[];
  onSave: (favorites: SortFavorite[]) => void;
  selectedId?: string;
  onSelect?: (id: string) => void;
  title?: string;
  sortFields?: Record<string, string[]>;
}

const SORT_FIELDS = {
  Main: ['Artist', 'Barcode', 'Cat No', 'Core AlbumID', 'Format', 'Genre', 'Label', 'Original Release Date', 'Original Release Month', 'Original Release Year', 'Recording Date', 'Recording Month', 'Recording Year', 'Release Date', 'Release Month', 'Release Year', 'Sort Title', 'Subtitle', 'Title'],
  Details: ['Box Set', 'Country', 'Extra', 'Is Live', 'Media Condition', 'Package/Sleeve Condition', 'Packaging', 'RPM', 'Sound', 'SPARS', 'Storage Device', 'Storage Device Slot', 'Studio', 'Vinyl Color', 'Vinyl Weight'],
  Edition: ['Discs', 'Length', 'Tracks'],
  Classical: ['Chorus', 'Composer', 'Composition', 'Conductor', 'Orchestra'],
  People: ['Engineer', 'Musician', 'Producer', 'Songwriter'],
  Personal: ['Added Date', 'Added Year', 'Collection Status', 'Current Value', 'Index', 'Last Cleaned Date', 'Last Cleaned Year', 'Last Played Date', 'Location', 'Modified Date', 'My Rating', 'Notes', 'Owner', 'Play Count', 'Played Year', 'Purchase Date', 'Purchase Price', 'Purchase Store', 'Purchase Year', 'Quantity', 'Signed by', 'Tags'],
  Loan: ['Due Date', 'Loan Date', 'Loaned To'],
};

export function ManageSortFavoritesModal({
  isOpen,
  onClose,
  favorites,
  onSave,
  selectedId,
  onSelect,
  title = 'Manage Sorting Favorites',
  sortFields,
}: ManageSortFavoritesModalProps) {
  const [localFavorites, setLocalFavorites] = useState<SortFavorite[]>(favorites);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showSortSelector, setShowSortSelector] = useState(false);
  const [selectedFavoriteForEdit, setSelectedFavoriteForEdit] = useState<SortFavorite | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Main']));
  const [searchQuery, setSearchQuery] = useState('');
  const effectiveSortFields = useMemo(() => sortFields ?? SORT_FIELDS, [sortFields]);

  useEffect(() => {
    if (!isOpen) return;
    setLocalFavorites(favorites);
    setEditingId(null);
    setEditingName('');
    setShowSortSelector(false);
    setSelectedFavoriteForEdit(null);
    const firstGroup = Object.keys(effectiveSortFields)[0] ?? 'Main';
    setExpandedGroups(new Set([firstGroup]));
    setSearchQuery('');
  }, [effectiveSortFields, favorites, isOpen]);

  if (!isOpen) return null;

  const handleEdit = (favorite: SortFavorite) => {
    setSelectedFavoriteForEdit(favorite);
    setShowSortSelector(true);
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
    const firstField = Object.values(effectiveSortFields)[0]?.[0] ?? 'Artist';
    const newId = `favorite-${Date.now()}`;
    const newFavorite: SortFavorite = {
      id: newId,
      name: 'New Sort Favorite',
      fields: [{ field: firstField, direction: 'asc' }]
    };
    setLocalFavorites([...localFavorites, newFavorite]);
    setSelectedFavoriteForEdit(newFavorite);
    setShowSortSelector(true);
  };

  const handleSaveSortFields = (fields: SortField[]) => {
    if (selectedFavoriteForEdit) {
      setLocalFavorites(localFavorites.map(f =>
        f.id === selectedFavoriteForEdit.id ? { ...f, fields } : f
      ));
      setShowSortSelector(false);
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

  const toggleField = (field: string) => {
    if (!selectedFavoriteForEdit) return;
    
    const exists = selectedFavoriteForEdit.fields.find(f => f.field === field);
    if (exists) {
      setSelectedFavoriteForEdit({
        ...selectedFavoriteForEdit,
        fields: selectedFavoriteForEdit.fields.filter(f => f.field !== field)
      });
    } else {
      setSelectedFavoriteForEdit({
        ...selectedFavoriteForEdit,
        fields: [...selectedFavoriteForEdit.fields, { field, direction: 'asc' }]
      });
    }
  };

  const toggleDirection = (field: string) => {
    if (!selectedFavoriteForEdit) return;
    
    setSelectedFavoriteForEdit({
      ...selectedFavoriteForEdit,
      fields: selectedFavoriteForEdit.fields.map(f =>
        f.field === field ? { ...f, direction: f.direction === 'asc' ? 'desc' : 'asc' } : f
      )
    });
  };

  const removeField = (field: string) => {
    if (!selectedFavoriteForEdit) return;
    
    setSelectedFavoriteForEdit({
      ...selectedFavoriteForEdit,
      fields: selectedFavoriteForEdit.fields.filter(f => f.field !== field)
    });
  };

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-[31000]"
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-md flex flex-col z-[31001] shadow-xl max-h-[80vh] transition-all duration-200 ${
          showSortSelector ? 'w-full max-w-[900px]' : 'w-full max-w-[600px]'
        }`}
      >
        {/* Header */}
        <div className="bg-[#FF8C42] text-white px-4 py-3 rounded-t-md flex justify-between items-center shrink-0">
          <h2 className="m-0 text-base font-semibold">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-white text-2xl cursor-pointer p-1 leading-none hover:text-white/80"
          >
            ×
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Favorites List */}
          <div className={`flex flex-col ${
            showSortSelector ? 'w-[280px] border-r border-gray-200' : 'w-full'
          }`}>
            <div className="p-4 border-b border-gray-200">
              <button
                onClick={handleAddNew}
                className="w-full px-3 py-2 bg-[#5BA3D0] text-white border-none rounded text-[13px] font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:bg-[#4a8eb8] transition-colors"
              >
                <span className="text-base">+</span>
                <span>New Favorite</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {localFavorites.map((fav) => (
                <div
                  key={fav.id}
                  onClick={() => handleEdit(fav)}
                  className={`flex items-center justify-between p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 group ${
                    selectedFavoriteForEdit?.id === fav.id ? 'bg-blue-50' : ''
                  } ${selectedId === fav.id ? 'bg-blue-50/20' : ''}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {onSelect && (
                      <input
                        type="radio"
                        checked={selectedId === fav.id}
                        onChange={() => onSelect(fav.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer shrink-0"
                      />
                    )}
                    
                    {editingId === fav.id ? (
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={handleSaveRename}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 px-2 py-1 text-[13px] border border-blue-300 rounded outline-none"
                        autoFocus
                      />
                    ) : (
                      <span className="text-[13px] font-medium text-gray-700">
                        {fav.name}
                      </span>
                    )}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRename(fav.id);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                      >
                        ✎
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(fav.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sort Field Selector */}
          {showSortSelector && selectedFavoriteForEdit && (
            <div className="flex-1 flex flex-col border-l border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="m-0 mb-3 text-sm font-semibold text-gray-800">
                  Select Sort Fields for: {selectedFavoriteForEdit.name}
                </h3>
                <input
                  type="text"
                  placeholder="🔍 Search fields..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-[13px] text-gray-900 outline-none focus:border-blue-400 transition-colors"
                />
              </div>

              <div className="flex-1 flex gap-3 p-3 overflow-hidden">
                {/* Available Fields */}
                <div className="flex-1 overflow-y-auto pr-3 border-r border-gray-200">
                  {Object.entries(effectiveSortFields).map(([groupName, fields]) => {
                    const isExpanded = expandedGroups.has(groupName);
                    const filteredFields = searchQuery
                      ? fields.filter(f => f.toLowerCase().includes(searchQuery.toLowerCase()))
                      : fields;
                    
                    if (filteredFields.length === 0) return null;

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
                          <div className="pl-3 pt-1">
                            {filteredFields.map(field => {
                              const isSelected = selectedFavoriteForEdit.fields.some(f => f.field === field);

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
                                    onChange={() => toggleField(field)}
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

                {/* Selected Fields */}
                <div className="w-[280px] flex flex-col">
                  <div className="text-[13px] font-semibold mb-2 text-gray-800">
                    Selected Fields ({selectedFavoriteForEdit.fields.length})
                  </div>
                  <div className="flex-1 overflow-y-auto bg-gray-50 rounded-md p-2">
                    {selectedFavoriteForEdit.fields.map((sortField, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 mb-1.5 p-2 bg-white rounded border border-gray-200 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <span className="text-base text-gray-400 cursor-grab">☰</span>
                        <span className="flex-1 text-[13px] text-gray-900">{sortField.field}</span>
                        <button
                          onClick={() => toggleDirection(sortField.field)}
                          className="px-2 py-1 bg-blue-600 text-white border-none rounded text-[10px] font-bold cursor-pointer hover:bg-blue-700 transition-colors"
                        >
                          {sortField.direction.toUpperCase()}
                        </button>
                        <button
                          onClick={() => removeField(sortField.field)}
                          className="bg-transparent border-none text-gray-400 text-xl cursor-pointer leading-none p-0 hover:text-red-500 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={() => handleSaveSortFields(selectedFavoriteForEdit.fields)}
                  className="w-full py-2 bg-[#5BA3D0] text-white border-none rounded text-[13px] font-semibold cursor-pointer hover:bg-[#4a8eb8] transition-colors"
                >
                  Save Sort Fields
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 border border-gray-200 rounded text-[13px] cursor-pointer text-gray-800 hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(localFavorites);
            }}
            className="px-4 py-2 bg-[#5BA3D0] text-white border-none rounded text-[13px] font-semibold cursor-pointer hover:bg-[#4a8eb8] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
// AUDIT: inspected, no changes.
