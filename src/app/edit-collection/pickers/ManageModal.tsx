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
  itemLabel?: string; // e.g., "Label", "Format", "Genre"
  allowMerge?: boolean; // Some lists may not allow merging
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

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setMergeMode(false);
      setSelectedForMerge([]);
      setDeleteConfirmId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter items based on search
  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort items alphabetically
  const sortedItems = [...filteredItems].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );

  const handleMergeToggle = () => {
    if (mergeMode) {
      // Exiting merge mode - clear selections
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
        zIndex: 30002, // Higher than PickerModal (30001)
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          width: '90%',
          maxWidth: '700px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111827' }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#6b7280',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: '1',
            }}
          >
            ×
          </button>
        </div>

        {/* Search + Merge Toggle */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            gap: '12px',
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
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
              outline: 'none',
            }}
          />
          {allowMerge && (
            <button
              onClick={handleMergeToggle}
              style={{
                padding: '8px 16px',
                background: mergeMode ? '#ef4444' : '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {mergeMode ? 'Cancel Merge' : 'Merge Mode'}
            </button>
          )}
        </div>

        {/* Merge Info Banner */}
        {mergeMode && (
          <div
            style={{
              padding: '12px 20px',
              backgroundColor: '#fef3c7',
              borderBottom: '1px solid #fbbf24',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '14px', color: '#92400e', fontWeight: '500' }}>
              {selectedForMerge.length === 0
                ? `Select 2 or more ${itemLabel.toLowerCase()}s to merge`
                : `${selectedForMerge.length} ${itemLabel.toLowerCase()}${selectedForMerge.length === 1 ? '' : 's'} selected`}
            </span>
            {selectedForMerge.length >= 2 && (
              <button
                onClick={handleMergeConfirm}
                style={{
                  padding: '6px 16px',
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

        {/* Items List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 20px',
          }}
        >
          {sortedItems.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: '14px',
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
                    padding: '10px 12px',
                    borderRadius: '4px',
                    backgroundColor: isSelectedForMerge ? '#f0f9ff' : 'transparent',
                    marginBottom: '2px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    {mergeMode && (
                      <input
                        type="checkbox"
                        checked={isSelectedForMerge}
                        onChange={() => handleMergeSelection(item.id)}
                        style={{
                          width: '16px',
                          height: '16px',
                          cursor: 'pointer',
                          accentColor: '#3b82f6',
                        }}
                      />
                    )}
                    <span style={{ fontSize: '14px', color: '#111827', flex: 1 }}>
                      {item.name}
                    </span>
                    {item.count !== undefined && (
                      <span
                        style={{
                          fontSize: '13px',
                          color: '#6b7280',
                          fontWeight: '500',
                          marginRight: '12px',
                        }}
                      >
                        {item.count}
                      </span>
                    )}
                  </div>

                  {!mergeMode && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {isDeleteConfirming ? (
                        <>
                          <button
                            onClick={() => handleDeleteConfirm(item.id)}
                            style={{
                              padding: '6px 12px',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            Confirm
                          </button>
                          <button
                            onClick={handleDeleteCancel}
                            style={{
                              padding: '6px 12px',
                              background: '#e5e7eb',
                              color: '#374151',
                              border: 'none',
                              borderRadius: '4px',
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
                          <button
                            onClick={() => onEdit(item.id)}
                            style={{
                              padding: '6px 12px',
                              background: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(item.id)}
                            style={{
                              padding: '6px 12px',
                              background: '#e5e7eb',
                              color: '#374151',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '500',
                              cursor: 'pointer',
                            }}
                          >
                            Delete
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

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              background: '#e5e7eb',
              color: '#374151',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}