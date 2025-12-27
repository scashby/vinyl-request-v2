// src/app/edit-collection/ManageColumnFavoritesModal.tsx
'use client';

import { useState } from 'react';
import { ColumnId, COLUMN_DEFINITIONS, COLUMN_GROUPS } from './columnDefinitions';

interface ColumnFavorite {
  id: string;
  name: string;
  columns: ColumnId[];
}

interface ManageColumnFavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  favorites: ColumnFavorite[];
  onSave: (favorites: ColumnFavorite[]) => void;
  selectedId: string;
  onSelect: (id: string) => void;
}

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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['main']));

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
      columns: ['artist', 'title']
    };
    setLocalFavorites([...localFavorites, newFavorite]);
    setSelectedFavoriteForEdit(newFavorite);
    setShowColumnSelector(true);
  };

  const handleSaveColumns = (columns: ColumnId[]) => {
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
          width: showColumnSelector ? '900px' : '600px',
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
            Manage Column Favorites
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
            width: showColumnSelector ? '280px' : '100%',
            borderRight: showColumnSelector ? '1px solid #e0e0e0' : 'none',
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
                        title="Edit columns"
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
                    {favorite.columns.length} columns
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column Selector */}
          {showColumnSelector && selectedFavoriteForEdit && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '16px', borderBottom: '1px solid #e0e0e0' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#333' }}>
                  Select Columns for: {selectedFavoriteForEdit.name}
                </h3>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {COLUMN_GROUPS.map(group => {
                  const isExpanded = expandedGroups.has(group.id);
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
                          {group.columns.map(colId => {
                            const col = COLUMN_DEFINITIONS[colId];
                            if (!col) return null;
                            const isSelected = selectedFavoriteForEdit.columns.includes(colId);

                            return (
                              <label
                                key={colId}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '6px 8px',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  borderRadius: '3px',
                                  marginBottom: '2px',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#f5f5f5';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const newColumns = e.target.checked
                                      ? [...selectedFavoriteForEdit.columns, colId]
                                      : selectedFavoriteForEdit.columns.filter(id => id !== colId);
                                    setSelectedFavoriteForEdit({
                                      ...selectedFavoriteForEdit,
                                      columns: newColumns
                                    });
                                  }}
                                  style={{ cursor: 'pointer' }}
                                />
                                <span>{col.label}</span>
                              </label>
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
                  onClick={() => handleSaveColumns(selectedFavoriteForEdit.columns)}
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
                  Save Column Selection
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