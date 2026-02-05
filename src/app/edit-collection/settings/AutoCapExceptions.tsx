// src/app/edit-collection/settings/AutoCapExceptions.tsx
'use client';

import { useState } from 'react';
import type { AutoCapMode } from './AutoCapSettings';

export const DEFAULT_EXCEPTIONS = [
  'a', 'the', 'in', 'of', 'for', 'with', 'on',
  've', 're', 'll', 'm', 't', 's', 'i',
  'II', 'III', 'IV', 'V', 'VI', 'VII', 'IX', 'X'
];

interface AutoCapExceptionsProps {
  isOpen: boolean;
  onClose: () => void;
  exceptions: string[];
  onSave: (exceptions: string[]) => void;
}

export function applyAutoCap(text: string, mode: AutoCapMode, exceptions: string[]): string {
  if (!text) return text;

  const words = text.split(' ');
  
  return words.map((word, index) => {
    // First and last word always capitalize
    if (index === 0 || index === words.length - 1) {
      return capitalizeWord(word);
    }

    const lowerWord = word.toLowerCase();
    
    switch (mode) {
      case 'All':
        // Capitalize every word
        return capitalizeWord(word);
        
      case 'First':
        // Only first word (already handled above)
        return word;
        
      case 'FirstExceptions':
        // Capitalize first word and all others except exceptions
        if (exceptions.includes(lowerWord)) {
          return lowerWord;
        }
        return capitalizeWord(word);
        
      default:
        return word;
    }
  }).join(' ');
}

function capitalizeWord(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function AutoCapExceptions({ isOpen, onClose, exceptions, onSave }: AutoCapExceptionsProps) {
  const [localExceptions, setLocalExceptions] = useState<string[]>(exceptions);
  const [newException, setNewException] = useState('');

  if (!isOpen) return null;

  const handleAdd = () => {
    if (newException.trim() && !localExceptions.includes(newException.trim().toLowerCase())) {
      setLocalExceptions([...localExceptions, newException.trim().toLowerCase()].sort());
      setNewException('');
    }
  };

  const handleRemove = (exception: string) => {
    setLocalExceptions(localExceptions.filter(e => e !== exception));
  };

  const handleReset = () => {
    setLocalExceptions(DEFAULT_EXCEPTIONS);
  };

  const handleSave = () => {
    onSave(localExceptions);
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
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          width: '500px',
          maxHeight: '600px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111827' }}>
            Auto Capitalization Exceptions
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '0',
              lineHeight: '1',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#6b7280' }}>
            Words in this list will not be capitalized (except when they are the first or last word).
          </p>

          {/* Add new exception */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <input
              type="text"
              value={newException}
              onChange={(e) => setNewException(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="Add new exception..."
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px',
                color: '#111827',
              }}
            />
            <button
              onClick={handleAdd}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Add
            </button>
          </div>

          {/* Exception list */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              padding: '12px',
              backgroundColor: '#f9fafb',
              borderRadius: '6px',
              minHeight: '100px',
              maxHeight: '300px',
              overflowY: 'auto',
            }}
          >
            {localExceptions.map((exception) => (
              <div
                key={exception}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: '#374151',
                }}
              >
                {exception}
                <button
                  onClick={() => handleRemove(exception)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    padding: '0',
                    fontSize: '16px',
                    lineHeight: '1',
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Reset button */}
          <button
            onClick={handleReset}
            style={{
              marginTop: '12px',
              padding: '6px 12px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Reset to Defaults
          </button>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f3f4f6',
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
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '500',
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
// AUDIT: inspected, no changes.
