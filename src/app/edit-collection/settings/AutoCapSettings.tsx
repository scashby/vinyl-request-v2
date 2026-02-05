// src/app/edit-collection/settings/AutoCapSettings.tsx
'use client';

import { useState } from 'react';

export type AutoCapMode = 'All' | 'First' | 'FirstExceptions';

interface AutoCapSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: AutoCapMode;
  onSave: (mode: AutoCapMode) => void;
  onManageExceptions: () => void;
}

export function AutoCapSettings({ isOpen, onClose, currentMode, onSave, onManageExceptions }: AutoCapSettingsProps) {
  const [selectedMode, setSelectedMode] = useState<AutoCapMode>(currentMode);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(selectedMode);
    onClose();
  };

  const modes: { value: AutoCapMode; label: string; description: string }[] = [
    {
      value: 'All',
      label: 'Capitalize All Words',
      description: 'Every word will be capitalized',
    },
    {
      value: 'First',
      label: 'Capitalize First Word Only',
      description: 'Only the first word will be capitalized',
    },
    {
      value: 'FirstExceptions',
      label: 'First Word + Exceptions',
      description: 'Capitalize all words except exceptions (articles, prepositions, etc.)',
    },
  ];

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
            Auto Capitalization Settings
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
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {modes.map((mode) => (
              <label
                key={mode.value}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '16px',
                  border: selectedMode === mode.value ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: selectedMode === mode.value ? '#eff6ff' : 'white',
                }}
              >
                <input
                  type="radio"
                  name="autoCapMode"
                  value={mode.value}
                  checked={selectedMode === mode.value}
                  onChange={(e) => setSelectedMode(e.target.value as AutoCapMode)}
                  style={{
                    marginTop: '2px',
                    cursor: 'pointer',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                    {mode.label}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>
                    {mode.description}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {/* Manage Exceptions button */}
          {selectedMode === 'FirstExceptions' && (
            <button
              onClick={onManageExceptions}
              style={{
                marginTop: '16px',
                padding: '8px 16px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Manage Exception Words
            </button>
          )}
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
