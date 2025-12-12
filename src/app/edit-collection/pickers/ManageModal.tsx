// src/app/edit-collection/pickers/ManageModal.tsx
'use client';

import { useState, useEffect } from 'react';

interface ManageItem {
  id: string;
  name: string;
  count?: number;
}

interface ManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: ManageItem[];
  onEdit: (itemId: string) => void;
  onDelete: (itemId: string) => void;
  onMerge: (itemIds: string[]) => void;
  itemLabel?: string;
  allowMerge?: boolean;
}

export function ManageModal({
  isOpen,
  onClose,
  title,
  items,
  onEdit,
  onDelete,
  onMerge,
  itemLabel = 'Item',
  allowMerge = true,
}: ManageModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setMergeMode(false);
      setSelectedForMerge([]);
      setDeleteConfirmId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedItems = [...filteredItems].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );

  const handleMergeToggle = () => {
    if (mergeMode) {
      setSelectedForMerge([]);
    }
    setMergeMode(!mergeMode);
  };

  const handleMergeSelection = (itemId: string) => {
    if (selectedForMerge.includes(itemId)) {
      setSelectedForMerge(selectedForMerge.filter(id => id !== itemId));
    } else {
      setSelectedForMerge([...selectedForMerge, itemId]);
    }
  };

  const handleMergeConfirm = () => {
    if (selectedForMerge.length >= 2) {
      onMerge(selectedForMerge);
      setMergeMode(false);
      setSelectedForMerge([]);
    }
  };

  const handleDeleteClick = (itemId: string) => {
    setDeleteConfirmId(itemId);
  };

  const handleDeleteConfirm = (itemId: string) => {
    onDelete(itemId);
    setDeleteConfirmId(null);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmId(null);
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
        zIndex: 30002,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '6px',
          width: mergeMode ? '900px' : '600px',
          maxHeight: '600px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - WHITE in normal mode, ORANGE in merge mode */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: mergeMode ? '#f59e0b' : 'white',
          }}
        >
          <h3 style={{ 
            margin: 0, 
            fontSize: '16px', 
            fontWeight: '600', 
            color: mergeMode ? 'white' : '#111827' 
          }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: mergeMode ? 'white' : '#6b7280',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: '1',
            }}
          >
            ×
          </button>
        </div>

        {/* Search + Merge Mode Toggle */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <input
            type="text"
            placeholder={`Search ${itemLabel}s...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: '6px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '13px',
              outline: 'none',
            }}
          />
          {allowMerge && (
            <button
              onClick={handleMergeToggle}
              style={{
                padding: '6px 12px',
                background: mergeMode ? '#ef4444' : '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {mergeMode ? 'Cancel Merge' : 'Merge Mode'}
            </button>
          )}
        </div>

        {/* Yellow Banner in Merge Mode */}
        {mergeMode && (
          <div
            style={{
              padding: '10px 16px',
              backgroundColor: '#fef3c7',
              borderBottom: '1px solid #fbbf24',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '13px', color: '#92400e', fontWeight: '500' }}>
              {selectedForMerge.length === 0
                ? `Select 2 or more ${itemLabel.toLowerCase()}s to merge`
                : `${selectedForMerge.length} ${itemLabel.toLowerCase()}${selectedForMerge.length === 1 ? '' : 's'} selected`}
            </span>
            {selectedForMerge.length >= 2 && (
              <button
                onClick={handleMergeConfirm}
                style={{
                  padding: '5px 14px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Merge Selected
              </button>
            )}
          </div>
        )}

        {/* Content Area */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          overflow: 'hidden' 
        }}>
          {/* Items List */}
          <div
            style={{
              flex: mergeMode ? '0 0 60%' : '1',
              overflowY: 'auto',
              padding: '8px 16px',
              borderRight: mergeMode ? '1px solid #e5e7eb' : 'none',
            }}
          >
            {sortedItems.length === 0 ? (
              <div
                style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: '#9ca3af',
                  fontSize: '13px',
                }}
              >
                {searchQuery ? 'No items match your search' : 'No items available'}
              </div>
            ) : (
              sortedItems.map((item) => {
                const isDeleteConfirming = deleteConfirmId === item.id;
                const isSelectedForMerge = selectedForMerge.includes(item.id);

                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: '3px',
                      backgroundColor: isSelectedForMerge ? '#eff6ff' : 'transparent',
                      marginBottom: '1px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      {mergeMode && (
                        <input
                          type="checkbox"
                          checked={isSelectedForMerge}
                          onChange={() => handleMergeSelection(item.id)}
                          style={{
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                            margin: 0,
                          }}
                        />
                      )}
                      <span style={{ fontSize: '13px', color: '#111827', flex: 1 }}>
                        {item.name}
                      </span>
                      {item.count !== undefined && (
                        <span
                          style={{
                            fontSize: '13px',
                            color: '#6b7280',
                            fontWeight: '400',
                            marginRight: '8px',
                          }}
                        >
                          {item.count}
                        </span>
                      )}
                    </div>

                    {!mergeMode && (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {isDeleteConfirming ? (
                          <>
                            <button
                              onClick={() => handleDeleteConfirm(item.id)}
                              style={{
                                padding: '4px 10px',
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                fontSize: '12px',
                                fontWeight: '500',
                                cursor: 'pointer',
                              }}
                            >
                              Confirm
                            </button>
                            <button
                              onClick={handleDeleteCancel}
                              style={{
                                padding: '4px 10px',
                                background: '#e5e7eb',
                                color: '#374151',
                                border: 'none',
                                borderRadius: '3px',
                                fontSize: '12px',
                                fontWeight: '500',
                                cursor: 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Pencil Icon */}
                            <button
                              onClick={() => onEdit(item.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                color: '#6b7280',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                              title="Edit"
                            >
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                                <path d="M11.5 1.5l1 1-8 8-1.5.5.5-1.5 8-8zm1.5-.5c-.3-.3-.7-.3-1 0l-1 1 1 1 1-1c.3-.3.3-.7 0-1l-.5-.5-.5.5zm-10 11l1-3 2 2-3 1z"/>
                              </svg>
                            </button>
                            {/* X Icon */}
                            <button
                              onClick={() => handleDeleteClick(item.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                color: '#6b7280',
                                display: 'flex',
                                alignItems: 'center',
                                fontSize: '16px',
                                lineHeight: '1',
                              }}
                              title="Delete"
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Right Panel in Merge Mode */}
          {mergeMode && selectedForMerge.length > 0 && (
            <div style={{ 
              flex: '0 0 40%', 
              padding: '16px',
              backgroundColor: '#f9fafb',
              overflowY: 'auto',
            }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                Checkbox the {itemLabel}s you want to merge:
              </div>
              {selectedForMerge.map(id => {
                const item = items.find(i => i.id === id);
                if (!item) return null;
                return (
                  <div key={id} style={{
                    padding: '6px 8px',
                    backgroundColor: 'white',
                    borderRadius: '3px',
                    marginBottom: '4px',
                    fontSize: '13px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}>
                    <span>{item.name}</span>
                    <span style={{ color: '#6b7280' }}>{item.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: mergeMode ? 'space-between' : 'center',
            gap: '8px',
          }}
        >
          {mergeMode ? (
            <>
              <button
                onClick={() => {
                  setMergeMode(false);
                  setSelectedForMerge([]);
                }}
                style={{
                  padding: '6px 16px',
                  background: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleMergeConfirm}
                disabled={selectedForMerge.length < 2}
                style={{
                  padding: '6px 16px',
                  background: selectedForMerge.length >= 2 ? '#3b82f6' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: selectedForMerge.length >= 2 ? 'pointer' : 'not-allowed',
                }}
              >
                Merge to
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              style={{
                padding: '6px 20px',
                background: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}