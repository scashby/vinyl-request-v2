// src/app/edit-collection/pickers/EditModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  itemName: string;
  itemSortName?: string; // ADDED
  onSave: (newName: string, newSortName?: string) => void; // UPDATED signature
  itemLabel?: string;
  showSortName?: boolean; // ADDED
}

export function EditModal({
  isOpen,
  onClose,
  title,
  itemName,
  itemSortName = '',
  onSave,
  itemLabel = 'Item',
  showSortName = false,
}: EditModalProps) {
  const [localName, setLocalName] = useState(itemName);
  const [localSortName, setLocalSortName] = useState(itemSortName);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalName(itemName);
    setLocalSortName(itemSortName || '');
    setError(null);
  }, [itemName, itemSortName, isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // Auto-generate sort name if empty when name changes
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setLocalName(newName);
    setError(null);
    
    // Only auto-update sort name if it hasn't been manually edited or was matching logic
    if (showSortName) {
      let autoSort = newName;
      if (newName.startsWith('The ')) autoSort = newName.substring(4) + ', The';
      else if (newName.startsWith('A ')) autoSort = newName.substring(2) + ', A';
      
      // Simple heuristic: if sort name was empty or matched previous auto-logic, update it
      // For now, we'll just auto-fill if the user hasn't explicitly cleared it or typed something distinct
      if (!localSortName || localSortName === itemName || localSortName.endsWith(', The') || localSortName.endsWith(', A')) {
         setLocalSortName(autoSort);
      }
    }
  };

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmedName = localName.trim();
    const trimmedSortName = localSortName.trim();
    
    if (!trimmedName) {
      setError(`${itemLabel} name cannot be empty`);
      return;
    }

    if (trimmedName === itemName && trimmedSortName === itemSortName) {
      onClose();
      return;
    }

    onSave(trimmedName, showSortName ? trimmedSortName : undefined);
    onClose();
  };

  const handleCancel = () => {
    setLocalName(itemName);
    setLocalSortName(itemSortName || '');
    setError(null);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
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
        zIndex: 30003,
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '6px',
          width: '450px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f97316', // Matched orange style
          }}
        >
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'white' }}>
            {title}
          </h3>
          <button
            onClick={handleCancel}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: '1',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#374151',
              }}
            >
              {itemLabel} Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={localName}
              onChange={handleNameChange}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: error ? '1px solid #ef4444' : '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
                color: '#111827'
              }}
              placeholder={`Enter ${itemLabel.toLowerCase()} name`}
            />
          </div>

          {showSortName && (
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#374151',
                }}
              >
                Sort Name
              </label>
              <input
                type="text"
                value={localSortName}
                onChange={(e) => setLocalSortName(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#111827'
                }}
                placeholder="Sort name (optional)"
              />
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: '6px',
                color: '#ef4444',
                fontSize: '12px',
              }}
            >
              {error}
            </div>
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
            backgroundColor: 'white',
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