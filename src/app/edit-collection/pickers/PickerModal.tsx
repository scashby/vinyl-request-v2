// src/app/edit-collection/pickers/PickerModal.tsx
'use client';

import { useState, useEffect } from 'react';

interface PickerItem {
  id: string;
  name: string;
  count?: number;
}

interface PickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  mode: 'single' | 'multi';
  items: PickerItem[];
  selectedIds: string | string[];
  onSave: (selectedIds: string | string[]) => void;
  onManage: () => void;
  onNew: () => void;
  searchPlaceholder?: string;
  itemLabel?: string;
}

export function PickerModal({
  isOpen,
  onClose,
  title,
  mode,
  items,
  selectedIds,
  onSave,
  onManage,
  onNew,
  searchPlaceholder = 'Search...',
  itemLabel = 'Item',
}: PickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelectedIds, setLocalSelectedIds] = useState<string | string[]>(selectedIds);

  useEffect(() => {
    setLocalSelectedIds(selectedIds);
  }, [selectedIds, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectionChange = (itemId: string) => {
    if (mode === 'single') {
      setLocalSelectedIds(itemId);
    } else {
      const currentIds = Array.isArray(localSelectedIds) ? localSelectedIds : [];
      if (currentIds.includes(itemId)) {
        setLocalSelectedIds(currentIds.filter(id => id !== itemId));
      } else {
        setLocalSelectedIds([...currentIds, itemId]);
      }
    }
  };

  const handleSave = () => {
    onSave(localSelectedIds);
    onClose();
  };

  const handleCancel = () => {
    setLocalSelectedIds(selectedIds);
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
        zIndex: 30001,
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '6px',
          width: '500px',
          maxHeight: '600px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - WHITE like CLZ */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'white',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#111827' }}>
            {title}
          </h3>
          <button
            onClick={handleCancel}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#6b7280',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: '1',
            }}
          >
            ×
          </button>
        </div>

        {/* Search + Buttons Row */}
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
            placeholder={searchPlaceholder}
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
          <button
            onClick={onNew}
            style={{
              padding: '6px 12px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            New {itemLabel}
          </button>
          <button
            onClick={onManage}
            style={{
              padding: '6px 12px',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Manage {itemLabel}s
          </button>
        </div>

        {/* Items List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 16px',
          }}
        >
          {filteredItems.length === 0 ? (
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
            filteredItems.map((item) => {
              const isSelected =
                mode === 'single'
                  ? localSelectedIds === item.id
                  : Array.isArray(localSelectedIds) && localSelectedIds.includes(item.id);

              return (
                <label
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    borderRadius: '3px',
                    marginBottom: '1px',
                    backgroundColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <input
                      type={mode === 'single' ? 'radio' : 'checkbox'}
                      checked={isSelected}
                      onChange={() => handleSelectionChange(item.id)}
                      style={{
                        width: '16px',
                        height: '16px',
                        cursor: 'pointer',
                        margin: 0,
                      }}
                    />
                    <span style={{ fontSize: '13px', color: '#111827' }}>{item.name}</span>
                  </div>
                  {item.count !== undefined && (
                    <span
                      style={{
                        fontSize: '13px',
                        color: '#6b7280',
                        fontWeight: '400',
                      }}
                    >
                      {item.count}
                    </span>
                  )}
                </label>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          <button
            onClick={handleCancel}
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
            onClick={handleSave}
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
            Save
          </button>
        </div>
      </div>
    </div>
  );
}