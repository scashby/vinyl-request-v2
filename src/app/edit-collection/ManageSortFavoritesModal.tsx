// src/app/edit-collection/ManageSortFavoritesModal.tsx
'use client';

import { useState } from 'react';

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
  selectedId: string;
  onSelect: (id: string) => void;
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
  onSelect
}: ManageSortFavoritesModalProps) {
  const [localFavorites, setLocalFavorites] = useState<SortFavorite[]>(favorites);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showSortSelector, setShowSortSelector] = useState(false);
  const [selectedFavoriteForEdit, setSelectedFavoriteForEdit] = useState<SortFavorite | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Main']));
  const [searchQuery, setSearchQuery] = useState('');

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
    const newId = `favorite-${Date.now()}`;
    const newFavorite: SortFavorite = {
      id: newId,
      name: 'New Sort Favorite',
      fields: [{ field: 'Artist', direction: 'asc' }]
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
        <div className="bg-[#FF8C42] text-white px-4 py-3 rounded-t-md flex justify-between items-center">
          <h2 className="m-0 text-base font-semibold">
            Manage Sorting Favorites
          </h2>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-white text-2xl cursor-pointer p-1 leading-none hover:text-white/80"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
              {localFavorites.map(favorite => (
                <div
                  key={favorite.id}
                  className={`mb-1 border rounded transition-colors ${
                    selectedId === favorite.id 
                      ? 'border-[#5BA3D0] border-2 bg-[#f0f8ff]' 
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
                        className="flex-1 px-1.5 py-1 border border-[#5BA3D0] rounded text-[13px] text-gray-900 outline-none"
                      />
                    ) : (
                      <span className="flex-1 text-[13px] font-medium text-gray-900">
                        {favorite.name}
                      </span>
                    )}
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(favorite)}
                        title="Edit sort fields"
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
                    {favorite.fields.map(f => `${f.field} ${f.direction.toUpperCase()}`).join(' | ')}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {localFavorites.map(favorite => (
                <div
                  key={favorite.id}
                  style={{
                    marginBottom: '4px',
                    border: selectedId === favorite.id ? '2px solid #5BA3D0' : '1px solid #e0e0e0',
                    borderRadius: '3px',
                    backgroundColor: selectedId === favorite.id ? '#f0f8ff' : 'white',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px',
                  }}>
                    <input
                      type="radio"
                      checked={selectedId === favorite.id}
                      onChange={() => onSelect(favorite.id)}
                      style={{ cursor: 'pointer' }}
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
                        style={{
                          flex: 1,
                          padding: '4px 6px',
                          border: '1px solid #5BA3D0',
                          borderRadius: '2px',
                          fontSize: '13px',
                          color: '#1a1a1a',
                        }}
                      />
                    ) : (
                      <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>
                        {favorite.name}
                      </span>
                    )}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => handleEdit(favorite)}
                        title="Edit sort fields"
                        style={{
                          padding: '4px 8px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleRename(favorite.id)}
                        title="Rename"
                        style={{
                          padding: '4px 8px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                        }}
                      >
                        📝
                      </button>
                      <button
                        onClick={() => handleDelete(favorite.id)}
                        title="Delete"
                        style={{
                          padding: '4px 8px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: '#ef4444',
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div style={{
                    padding: '4px 8px 8px 32px',
                    fontSize: '11px',
                    color: '#999',
                  }}>
                    {favorite.fields.map(f => `${f.field} ${f.direction.toUpperCase()}`).join(' | ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sort Field Selector */}
          {showSortSelector && selectedFavoriteForEdit && (
            <div className="flex-1 flex flex-col">
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
                <div style={{ flex: 1, overflowY: 'auto', borderRight: '1px solid #e0e0e0', paddingRight: '12px' }}>
                  {Object.entries(SORT_FIELDS).map(([groupName, fields]) => {
                    const isExpanded = expandedGroups.has(groupName);
                    const filteredFields = searchQuery
                      ? fields.filter(f => f.toLowerCase().includes(searchQuery.toLowerCase()))
                      : fields;
                    
                    if (filteredFields.length === 0) return null;

                    return (
                      <div key={groupName} style={{ marginBottom: '4px' }}>
                        <button
                          onClick={() => toggleGroup(groupName)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            background: '#2C2C2C',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 600,
                            textAlign: 'left',
                          }}
                        >
                          <span style={{
                            fontSize: '10px',
                            transition: 'transform 0.2s',
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                          }}>
                            ▶
                          </span>
                          <span>{groupName}</span>
                        </button>

                        {isExpanded && (
                          <div style={{ paddingLeft: '12px', paddingTop: '4px' }}>
                            {filteredFields.map(field => {
                              const isSelected = selectedFavoriteForEdit.fields.some(f => f.field === field);

                              return (
                                <label
                                  key={field}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '6px 8px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    borderRadius: '3px',
                                    marginBottom: '2px',
                                    color: '#1a1a1a',
                                    backgroundColor: isSelected ? '#f0f0f0' : 'transparent',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected) e.currentTarget.style.background = '#f5f5f5';
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleField(field)}
                                    style={{ cursor: 'pointer' }}
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

              <div style={{ padding: '16px', borderTop: '1px solid #e0e0e0' }}>
                <button
                  onClick={() => handleSaveSortFields(selectedFavoriteForEdit.fields)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#5BA3D0',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Save Sort Fields
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f0f0f0',
              border: '1px solid #d0d0d0',
              borderRadius: '3px',
              fontSize: '13px',
              cursor: 'pointer',
              color: '#1a1a1a',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(localFavorites);
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#5BA3D0',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}