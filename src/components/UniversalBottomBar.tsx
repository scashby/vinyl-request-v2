// src/components/UniversalBottomBar.tsx
'use client';

import React from 'react';
import type { Album } from '@/types/album';

interface UniversalBottomBarProps {
  // Make all props optional so it can be used in the root layout
  album?: Album | null;
  onSave?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  isSaving?: boolean;
  hasChanges?: boolean;
}

export function UniversalBottomBar({ 
  album, 
  onSave, 
  onPrevious, 
  onNext, 
  isSaving = false, 
  hasChanges = false 
}: UniversalBottomBarProps) {
  
  // If no album data is passed (e.g., when sitting in the root layout), don't render anything
  if (!album) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-50 flex items-center justify-between">
      
      {/* Left: Navigation */}
      <div className="flex gap-2">
        <button 
          onClick={onPrevious}
          disabled={!onPrevious}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Previous
        </button>
        <button 
          onClick={onNext}
          disabled={!onNext}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>

      {/* Center: Status */}
      <div className="text-sm text-gray-600 font-medium">
        {hasChanges ? (
          <span className="text-amber-600">⚠️ Unsaved changes</span>
        ) : (
          <span className="text-gray-400">All changes saved</span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex gap-3">
        <button 
          onClick={onSave}
          disabled={!hasChanges || isSaving}
          className={`px-6 py-2 text-sm font-bold text-white rounded-md shadow-sm transition-all ${
            hasChanges 
              ? 'bg-blue-600 hover:bg-blue-700' 
              : 'bg-gray-400 cursor-not-allowed opacity-50'
          }`}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}