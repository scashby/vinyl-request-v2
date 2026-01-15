// src/app/edit-collection/settings/SettingsModal.tsx - FIXED: Correct AutoCapMode values
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
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30000]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg w-[600px] max-h-[80vh] flex flex-col overflow-hidden shadow-xl"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="m-0 text-lg font-semibold text-gray-900">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-2xl cursor-pointer text-gray-500 p-0 leading-none hover:text-gray-700"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex flex-col gap-3">
            {/* Auto Capitalization */}
            <div
              onClick={() => setActiveSection('autocap')}
              className="p-4 border border-gray-200 rounded-md cursor-pointer flex justify-between items-center hover:bg-gray-50 transition-colors group"
            >
              <div>
                <div className="text-sm font-semibold text-gray-900 mb-1">
                  Auto Capitalization
                </div>
                <div className="text-xs text-gray-500">
                  Current mode: <strong className="text-gray-700">{autoCapMode === 'All' ? 'Capitalize All Words' : autoCapMode === 'First' ? 'First Word Only' : 'First Word + Exceptions'}</strong>
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#6b7280" strokeWidth="2" className="text-gray-400 group-hover:text-gray-600">
                <path d="M7 4l6 6-6 6" />
              </svg>
            </div>

            {/* Future Settings Sections */}
            <div className="p-4 border border-gray-200 rounded-md opacity-50 cursor-not-allowed">
              <div className="text-sm font-semibold text-gray-900 mb-1">
                Display Preferences
              </div>
              <div className="text-xs text-gray-500">
                Coming soon
              </div>
            </div>

            <div className="p-4 border border-gray-200 rounded-md opacity-50 cursor-not-allowed">
              <div className="text-sm font-semibold text-gray-900 mb-1">
                Data & Sync
              </div>
              <div className="text-xs text-gray-500">
                Coming soon
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-500 text-white border-none rounded text-sm font-semibold cursor-pointer hover:bg-blue-600"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}