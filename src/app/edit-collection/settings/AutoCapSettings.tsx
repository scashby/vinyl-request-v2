// src/app/edit-collection/settings/AutoCapSettings.tsx
'use client';

import { useState, useEffect } from 'react';

export type AutoCapMode = 'UPPER' | 'lower' | 'First' | 'FirstExceptions';

interface AutoCapSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: AutoCapMode;
  onSave: (mode: AutoCapMode) => void;
  onManageExceptions: () => void;
}

export function AutoCapSettings({
  isOpen,
  onClose,
  currentMode,
  onSave,
  onManageExceptions,
}: AutoCapSettingsProps) {
  const [selectedMode, setSelectedMode] = useState<AutoCapMode>(currentMode);

  useEffect(() => {
    setSelectedMode(currentMode);
  }, [currentMode, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(selectedMode);
    onClose();
  };

  const handleCancel = () => {
    setSelectedMode(currentMode);
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
        zIndex: 30005,
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
          }}
        >
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#111827' }}>
            Auto Capitalization
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

        {/* Content */}
        <div style={{ padding: '16px' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '13px',
              fontWeight: '500',
              color: '#374151',
            }}
          >
            Auto Cap Method
          </label>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                border: selectedMode === 'UPPER' ? '2px solid #3b82f6' : '2px solid transparent',
                backgroundColor: selectedMode === 'UPPER' ? '#eff6ff' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (selectedMode !== 'UPPER') {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedMode !== 'UPPER') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <input
                type="radio"
                name="autocap"
                checked={selectedMode === 'UPPER'}
                onChange={() => setSelectedMode('UPPER')}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                  margin: 0,
                }}
              />
              <span style={{ fontSize: '13px', color: '#111827', fontWeight: selectedMode === 'UPPER' ? '600' : '400' }}>
                UPPER CASE
              </span>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                border: selectedMode === 'lower' ? '2px solid #3b82f6' : '2px solid transparent',
                backgroundColor: selectedMode === 'lower' ? '#eff6ff' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (selectedMode !== 'lower') {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedMode !== 'lower') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <input
                type="radio"
                name="autocap"
                checked={selectedMode === 'lower'}
                onChange={() => setSelectedMode('lower')}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                  margin: 0,
                }}
              />
              <span style={{ fontSize: '13px', color: '#111827', fontWeight: selectedMode === 'lower' ? '600' : '400' }}>
                lower case
              </span>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                border: selectedMode === 'First' ? '2px solid #3b82f6' : '2px solid transparent',
                backgroundColor: selectedMode === 'First' ? '#eff6ff' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (selectedMode !== 'First') {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedMode !== 'First') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <input
                type="radio"
                name="autocap"
                checked={selectedMode === 'First'}
                onChange={() => setSelectedMode('First')}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                  margin: 0,
                }}
              />
              <span style={{ fontSize: '13px', color: '#111827', fontWeight: selectedMode === 'First' ? '600' : '400' }}>
                First letter only
              </span>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                border: selectedMode === 'FirstExceptions' ? '2px solid #3b82f6' : '2px solid transparent',
                backgroundColor: selectedMode === 'FirstExceptions' ? '#eff6ff' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (selectedMode !== 'FirstExceptions') {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedMode !== 'FirstExceptions') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <input
                type="radio"
                name="autocap"
                checked={selectedMode === 'FirstExceptions'}
                onChange={() => setSelectedMode('FirstExceptions')}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                  margin: 0,
                }}
              />
              <span style={{ fontSize: '13px', color: '#111827', fontWeight: selectedMode === 'FirstExceptions' ? '600' : '400' }}>
                First Letter of Each Word with Exceptions
              </span>
            </label>
          </div>

          <button
            onClick={onManageExceptions}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Manage Exceptions
          </button>
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