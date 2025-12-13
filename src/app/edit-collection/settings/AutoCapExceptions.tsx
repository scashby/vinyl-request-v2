// src/app/edit-collection/settings/AutoCapExceptions.tsx
'use client';

import { useState, useEffect } from 'react';

// Default exceptions from CLZ
const DEFAULT_EXCEPTIONS = [
  't', 's', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'IX', 'X',
  'the', 'in', 'of', 'a', 'for', 'with', 'on', 've', 're', 'll', 'm'
];

interface AutoCapExceptionsProps {
  isOpen: boolean;
  onClose: () => void;
  exceptions: string[];
  onSave: (exceptions: string[]) => void;
}

export function AutoCapExceptions({
  isOpen,
  onClose,
  exceptions,
  onSave,
}: AutoCapExceptionsProps) {
  const [localExceptions, setLocalExceptions] = useState<string[]>(exceptions);
  const [newException, setNewException] = useState('');

  useEffect(() => {
    setLocalExceptions(exceptions);
  }, [exceptions, isOpen]);

  if (!isOpen) return null;

  const handleAddException = () => {
    const trimmed = newException.trim();
    if (trimmed && !localExceptions.includes(trimmed)) {
      setLocalExceptions([...localExceptions, trimmed].sort());
      setNewException('');
    }
  };

  const handleRemoveException = (exception: string) => {
    setLocalExceptions(localExceptions.filter(e => e !== exception));
  };

  const handleSave = () => {
    onSave(localExceptions);
    onClose();
  };

  const handleCancel = () => {
    setLocalExceptions(exceptions);
    setNewException('');
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
        zIndex: 30006,
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '6px',
          width: '550px',
          maxHeight: '600px',
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
          }}
        >
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#111827' }}>
            Auto Cap Exceptions
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

        {/* Add New Exception */}
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
            placeholder="Add new exception..."
            value={newException}
            onChange={(e) => setNewException(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddException();
              }
            }}
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
            onClick={handleAddException}
            disabled={!newException.trim()}
            style={{
              padding: '6px 12px',
              background: newException.trim() ? '#3b82f6' : '#d1d5db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: newException.trim() ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
            }}
          >
            Add
          </button>
        </div>

        {/* Exceptions List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 16px',
          }}
        >
          {localExceptions.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: '13px',
              }}
            >
              No exceptions configured
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {localExceptions.map((exception) => (
                <div
                  key={exception}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    background: '#f3f4f6',
                    borderRadius: '4px',
                    fontSize: '13px',
                    color: '#111827',
                  }}
                >
                  <span>{exception}</span>
                  <button
                    onClick={() => handleRemoveException(exception)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#6b7280',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: '16px',
                      lineHeight: '1',
                      fontWeight: '300',
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
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

// Helper function to apply auto-cap with exceptions
export function applyAutoCap(text: string, mode: 'UPPER' | 'lower' | 'First' | 'FirstExceptions', exceptions: string[]): string {
  if (!text) return text;

  switch (mode) {
    case 'UPPER':
      return text.toUpperCase();
    
    case 'lower':
      return text.toLowerCase();
    
    case 'First':
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    
    case 'FirstExceptions':
      return text.split(' ').map((word, index) => {
        // First word always capitalized
        if (index === 0) {
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
        
        // Check if word is an exception
        if (exceptions.includes(word.toLowerCase())) {
          return word.toLowerCase();
        }
        
        // Check if word is all caps (like roman numerals)
        if (exceptions.includes(word.toUpperCase())) {
          return word.toUpperCase();
        }
        
        // Default: capitalize first letter
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }).join(' ');
    
    default:
      return text;
  }
}

export { DEFAULT_EXCEPTIONS };