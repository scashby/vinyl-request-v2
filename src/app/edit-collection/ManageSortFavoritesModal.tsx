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
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 31000,
        }}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'white',
          borderRadius: '4px',
          width: showSortSelector ? '900px' : '600px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 31001,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div style={{
          backgroundColor: '#FF8C42',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '4px 4px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
            Manage Sorting Favorites
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: '1',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Favorites List */}
          <div style={{
            width: showSortSelector ? '280px' : '100%',
            borderRight: showSortSelector ? '1px solid #e0e0e0' : 'none',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e0e0e0' }}>
              <button
                onClick={handleAddNew}
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ fontSize: '16px' }}>+</span>
                <span>New Favorite</span>
              </button>
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
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '16px', borderBottom: '1px solid #e0e0e0' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#333' }}>
                  Select Sort Fields for: {selectedFavoriteForEdit.name}
                </h3>
                <input
                  type="text"
                  placeholder="🔍 Search fields..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    border: '1px solid #D8D8D8',
                    borderRadius: '4px',
                    fontSize: '13px',
                    color: '#1a1a1a',
                  }}
                />
              </div>

              <div style={{ flex: 1, display: 'flex', gap: '12px', padding: '12px', overflow: 'hidden' }}>
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
                <div style={{ width: '280px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#333' }}>
                    Selected Fields ({selectedFavoriteForEdit.fields.length})
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', background: '#f8f8f8', borderRadius: '4px', padding: '8px' }}>
                    {selectedFavoriteForEdit.fields.map((sortField, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '6px',
                          padding: '8px',
                          background: 'white',
                          borderRadius: '4px',
                          border: '1px solid #D8D8D8',
                        }}
                      >
                        <span style={{ fontSize: '16px', color: '#888', cursor: 'grab' }}>☰</span>
                        <span style={{ flex: 1, fontSize: '13px', color: '#1a1a1a' }}>{sortField.field}</span>
                        <button
                          onClick={() => toggleDirection(sortField.field)}
                          style={{
                            padding: '4px 10px',
                            background: '#0066cc',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {sortField.direction.toUpperCase()}
                        </button>
                        <button
                          onClick={() => removeField(sortField.field)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#666',
                            fontSize: '18px',
                            cursor: 'pointer',
                            lineHeight: '1',
                            padding: 0,
                          }}
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