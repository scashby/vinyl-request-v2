// src/app/edit-collection/pickers/EditModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  itemName: string;
  onSave: (newName: string) => void;
  itemLabel?: string; // e.g., "Label", "Format", "Genre"
}

export function EditModal({
  isOpen,
  onClose,
  title,
  itemName,
  onSave,
  itemLabel = 'Item',
}: EditModalProps) {
  const [localName, setLocalName] = useState(itemName);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset local state when modal opens or itemName changes
  useEffect(() => {
    setLocalName(itemName);
    setError(null);
  }, [itemName, isOpen]);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmedName = localName.trim();
    
    // Validation
    if (!trimmedName) {
      setError(`${itemLabel} name cannot be empty`);
      return;
    }

    if (trimmedName === itemName) {
      // No change - just close
      onClose();
      return;
    }

    onSave(trimmedName);
    onClose();
  };

  const handleCancel = () => {
    setLocalName(itemName); // Reset to original
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
        zIndex: 30003, // Higher than ManageModal (30002)
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          width: '90%',
          maxWidth: '500px',
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

        {/* Content */}
        <div style={{ padding: '20px' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
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
            onChange={(e) => {
              setLocalName(e.target.value);
              setError(null); // Clear error on change
            }}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: error ? '1px solid #ef4444' : '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            placeholder={`Enter ${itemLabel.toLowerCase()} name`}
          />
          {error && (
            <div
              style={{
                marginTop: '8px',
                color: '#ef4444',
                fontSize: '13px',
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #e5e7eb',
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
            onClick={handleSave}
            style={{
              padding: '8px 20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
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