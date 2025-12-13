// src/app/edit-collection/settings/SettingsModal.tsx - NEW
'use client';

import { useState } from 'react';
import { AutoCapSettings, type AutoCapMode } from './AutoCapSettings';
import { AutoCapExceptions, DEFAULT_EXCEPTIONS } from './AutoCapExceptions';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<'main' | 'autocap' | 'exceptions'>('main');
  const [autoCapMode, setAutoCapMode] = useState<AutoCapMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('autoCapMode') as AutoCapMode) || 'FirstExceptions';
    }
    return 'FirstExceptions';
  });
  const [autoCapExceptions, setAutoCapExceptions] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('autoCapExceptions');
      return stored ? JSON.parse(stored) : DEFAULT_EXCEPTIONS;
    }
    return DEFAULT_EXCEPTIONS;
  });

  if (!isOpen) return null;

  const handleAutoCapModeChange = (mode: AutoCapMode) => {
    setAutoCapMode(mode);
    localStorage.setItem('autoCapMode', mode);
  };

  const handleAutoCapExceptionsChange = (exceptions: string[]) => {
    setAutoCapExceptions(exceptions);
    localStorage.setItem('autoCapExceptions', JSON.stringify(exceptions));
  };

  if (activeSection === 'autocap') {
    return (
      <AutoCapSettings
        isOpen={true}
        onClose={() => setActiveSection('main')}
        currentMode={autoCapMode}
        onSave={(mode) => {
          handleAutoCapModeChange(mode);
          setActiveSection('main');
        }}
        onManageExceptions={() => setActiveSection('exceptions')}
      />
    );
  }

  if (activeSection === 'exceptions') {
    return (
      <AutoCapExceptions
        isOpen={true}
        onClose={() => setActiveSection('autocap')}
        exceptions={autoCapExceptions}
        onSave={(exceptions) => {
          handleAutoCapExceptionsChange(exceptions);
          setActiveSection('autocap');
        }}
      />
    );
  }

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
        zIndex: 30000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '6px',
          width: '600px',
          maxHeight: '80vh',
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
            padding: '16px 20px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111827' }}>
            Settings
          </h2>
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

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Auto Capitalization */}
            <div
              onClick={() => setActiveSection('autocap')}
              style={{
                padding: '16px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f9fafb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                  Auto Capitalization
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  Current mode: <strong>{autoCapMode === 'UPPER' ? 'UPPER CASE' : autoCapMode === 'lower' ? 'lower case' : autoCapMode === 'First' ? 'First letter only' : 'First Letter of Each Word with Exceptions'}</strong>
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#6b7280" strokeWidth="2">
                <path d="M7 4l6 6-6 6" />
              </svg>
            </div>

            {/* Future Settings Sections */}
            <div
              style={{
                padding: '16px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                opacity: 0.5,
                cursor: 'not-allowed',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                Display Preferences
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>
                Coming soon
              </div>
            </div>

            <div
              style={{
                padding: '16px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                opacity: 0.5,
                cursor: 'not-allowed',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                Data & Sync
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>
                Coming soon
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
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
            Done
          </button>
        </div>
      </div>
    </div>
  );
}