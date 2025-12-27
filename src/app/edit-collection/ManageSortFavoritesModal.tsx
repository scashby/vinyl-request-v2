// src/app/edit-collection/ManageSortFavoritesModal.tsx
'use client';

import { useState } from 'react';
import { ColumnId, COLUMN_DEFINITIONS, COLUMN_GROUPS } from './columnDefinitions';

interface SortField {
  column: ColumnId;
  direction: 'asc' | 'desc';
}

interface SortFavorite {
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
  const [showFieldSelector, setShowFieldSelector] = useState(false);
  const [selectedFavoriteForEdit, setSelectedFavoriteForEdit] = useState<SortFavorite | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['main']));

  if (!isOpen) return null;

  const handleEdit = (favorite: SortFavorite) => {
    setSelectedFavoriteForEdit(favorite);
    setShowFieldSelector(true);
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
    const newId = `sort-${Date.now()}`;
    const newFavorite: SortFavorite = {
      id: newId,
      name: 'New Sort',
      fields: [{ column: 'artist', direction: 'asc' }]
    };
    setLocalFavorites([...localFavorites, newFavorite]);
    setSelectedFavoriteForEdit(newFavorite);
    setShowFieldSelector(true);
  };

  const handleSaveFields = (fields: SortField[]) => {
    if (selectedFavoriteForEdit) {
      setLocalFavorites(localFavorites.map(f =>
        f.id === selectedFavoriteForEdit.id ? { ...f, fields } : f
      ));
      setShowFieldSelector(false);
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

  const formatFieldName = (field: SortField): string => {
    const col = COLUMN_DEFINITIONS[field.column];
    const direction = field.direction === 'asc' ? '↑' : '↓';
    return `${col?.label || field.column} ${direction}`;
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
          width: showFieldSelector ? '900px' : '600px',
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
            width: showFieldSelector ? '280px' : '100%',
            borderRight: showFieldSelector ? '1px solid #e0e0e0' : 'none',
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
                        }}
                      />
                    ) : (
                      <span style={{ flex: 1, fontSize: '13px', fontWeight: 500 }}>
                        {favorite.name}
                      </span>
                    )}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => handleEdit(favorite)}
                        title="Edit fields"
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
                    {favorite.fields.map(f => formatFieldName(f)).join(' / ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Field Selector */}
          {showFieldSelector && selectedFavoriteForEdit && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '16px', borderBottom: '1px solid #e0e0e0' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#333' }}>
                  Select Sort Fields for: {selectedFavoriteForEdit.name}
                </h3>
              </div>

              {/* Selected Fields */}
              <div style={{ padding: '16px', borderBottom: '1px solid #e0e0e0' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  Selected Fields (click to toggle direction):
                </div>
                {selectedFavoriteForEdit.fields.length === 0 ? (
                  <div style={{ fontSize: '13px', color: '#999', fontStyle: 'italic' }}>
                    No fields selected
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {selectedFavoriteForEdit.fields.map((field, index) => (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 10px',
                          backgroundColor: '#f0f8ff',
                          border: '1px solid #5BA3D0',
                          borderRadius: '4px',
                          fontSize: '13px',
                        }}
                      >
                        <button
                          onClick={() => {
                            const newFields = [...selectedFavoriteForEdit.fields];
                            newFields[index] = {
                              ...field,
                              direction: field.direction === 'asc' ? 'desc' : 'asc'
                            };
                            setSelectedFavoriteForEdit({
                              ...selectedFavoriteForEdit,
                              fields: newFields
                            });
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            padding: '0',
                          }}
                        >
                          {field.direction === 'asc' ? '↑' : '↓'}
                        </button>
                        <span>{COLUMN_DEFINITIONS[field.column]?.label}</span>
                        <button
                          onClick={() => {
                            const newFields = selectedFavoriteForEdit.fields.filter((_, i) => i !== index);
                            setSelectedFavoriteForEdit({
                              ...selectedFavoriteForEdit,
                              fields: newFields
                            });
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#ef4444',
                            fontSize: '14px',
                            padding: '0',
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Available Fields */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {COLUMN_GROUPS.map(group => {
                  const isExpanded = expandedGroups.has(group.id);
                  const sortableColumns = group.columns.filter(colId => 
                    COLUMN_DEFINITIONS[colId]?.sortable
                  );

                  if (sortableColumns.length === 0) return null;

                  return (
                    <div key={group.id} style={{ marginBottom: '4px' }}>
                      <button
                        onClick={() => toggleGroup(group.id)}
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
                        <span>{group.icon}</span>
                        <span>{group.label}</span>
                      </button>

                      {isExpanded && (
                        <div style={{ paddingLeft: '28px', paddingTop: '4px' }}>
                          {sortableColumns.map(colId => {
                            const col = COLUMN_DEFINITIONS[colId];
                            if (!col) return null;

                            return (
                              <button
                                key={colId}
                                onClick={() => {
                                  const newField: SortField = {
                                    column: colId,
                                    direction: 'asc'
                                  };
                                  setSelectedFavoriteForEdit({
                                    ...selectedFavoriteForEdit,
                                    fields: [...selectedFavoriteForEdit.fields, newField]
                                  });
                                }}
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '6px 8px',
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  borderRadius: '3px',
                                  marginBottom: '2px',
                                  textAlign: 'left',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#f5f5f5';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                <span style={{ fontSize: '16px' }}>+</span>
                                <span>{col.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ padding: '16px', borderTop: '1px solid #e0e0e0' }}>
                <button
                  onClick={() => handleSaveFields(selectedFavoriteForEdit.fields)}
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