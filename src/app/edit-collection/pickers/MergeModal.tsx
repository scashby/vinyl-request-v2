// src/app/edit-collection/pickers/MergeModal.tsx
'use client';

import { useState, useEffect } from 'react';

interface MergeItem {
  id: string;
  name: string;
  count?: number;
}

interface MergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: MergeItem[]; // Items being merged
  onMerge: (primaryId: string, mergeIntoIds: string[]) => void;
  itemLabel?: string; // e.g., "Label", "Format", "Genre"
}

export function MergeModal({
  isOpen,
  onClose,
  title,
  items,
  onMerge,
  itemLabel = 'Item',
}: MergeModalProps) {
  const [primaryId, setPrimaryId] = useState<string>('');

  // Set first item as primary by default when modal opens
  useEffect(() => {
    if (isOpen && items.length > 0 && !primaryId) {
      setPrimaryId(items[0].id);
    }
  }, [isOpen, items, primaryId]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPrimaryId('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Sort items by count (descending), then by name
  const sortedItems = [...items].sort((a, b) => {
    const countDiff = (b.count || 0) - (a.count || 0);
    if (countDiff !== 0) return countDiff;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  const primaryItem = sortedItems.find(item => item.id === primaryId);
  const totalCount = sortedItems.reduce((sum, item) => sum + (item.count || 0), 0);

  const handleMerge = () => {
    if (!primaryId) return;
    
    const mergeIntoIds = sortedItems
      .filter(item => item.id !== primaryId)
      .map(item => item.id);
    
    onMerge(primaryId, mergeIntoIds);
    onClose();
  };

  const handleCancel = () => {
    setPrimaryId('');
    onClose();
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
        zIndex: 30004, // Higher than EditModal (30003)
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          width: '90%',
          maxWidth: '600px',
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
            onClick={handleCancel}
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

        {/* Info Banner */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#fef3c7',
            borderBottom: '1px solid #fbbf24',
          }}
        >
          <div style={{ fontSize: '14px', color: '#92400e', fontWeight: '500', marginBottom: '4px' }}>
            Merging {items.length} {itemLabel.toLowerCase()}s
          </div>
          <div style={{ fontSize: '13px', color: '#78350f' }}>
            Select which {itemLabel.toLowerCase()} should be kept as the primary. All albums from the other {itemLabel.toLowerCase()}s will be moved to the primary.
          </div>
        </div>

        {/* Items List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
          }}
        >
          <div style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
            Select Primary {itemLabel}:
          </div>
          
          {sortedItems.map((item) => {
            const isPrimary = primaryId === item.id;

            return (
              <label
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 12px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  transition: 'background-color 0.15s',
                  backgroundColor: isPrimary ? '#f0f9ff' : 'transparent',
                  marginBottom: '4px',
                  border: isPrimary ? '2px solid #3b82f6' : '2px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isPrimary) {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isPrimary) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <input
                    type="radio"
                    name="primary"
                    checked={isPrimary}
                    onChange={() => setPrimaryId(item.id)}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                      accentColor: '#3b82f6',
                    }}
                  />
                  <span style={{ fontSize: '14px', color: '#111827', fontWeight: isPrimary ? '600' : '400' }}>
                    {item.name}
                  </span>
                </div>
                {item.count !== undefined && (
                  <span
                    style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      fontWeight: '500',
                    }}
                  >
                    {item.count} album{item.count !== 1 ? 's' : ''}
                  </span>
                )}
              </label>
            );
          })}
        </div>

        {/* Preview Section */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#f9fafb',
            borderTop: '1px solid #e5e7eb',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
            After Merge:
          </div>
          <div
            style={{
              padding: '12px',
              backgroundColor: 'white',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: '#111827', fontWeight: '500' }}>
                {primaryItem?.name || 'Select a primary item'}
              </span>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>
                {totalCount} album{totalCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
            The other {items.length - 1} {itemLabel.toLowerCase()}{items.length - 1 !== 1 ? 's' : ''} will be deleted.
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            onClick={handleCancel}
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
            Cancel
          </button>
          <button
            onClick={handleMerge}
            disabled={!primaryId}
            style={{
              padding: '8px 20px',
              background: primaryId ? '#ef4444' : '#d1d5db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: primaryId ? 'pointer' : 'not-allowed',
            }}
          >
            Merge {itemLabel}s
          </button>
        </div>
      </div>
    </div>
  );
}