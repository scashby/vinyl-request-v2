// src/components/UniversalBottomBar.tsx
'use client';

import React from 'react';
import type { Album } from '@/types/album';

interface UniversalBottomBarProps {
  album?: Album | null;
  
  // Navigation
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  
  // Actions
  onSave?: () => void;
  onCancel?: () => void;
  
  // State
  isSaving?: boolean;
  hasChanges?: boolean;
  
  // Extra Tools
  onOpenLocationPicker?: () => void;
  onChange?: <K extends keyof Album>(field: K, value: Album[K]) => void;
}

export function UniversalBottomBar({ 
  album, 
  onSave, 
  onCancel,
  onPrevious, 
  onNext, 
  hasPrevious,
  hasNext,
  isSaving = false, 
  hasChanges = false,
  onOpenLocationPicker
}: UniversalBottomBarProps) {
  
  // If no album data is passed (e.g. root layout), render nothing
  if (!album) {
    return null;
  }

  // Determine disabled states based on explicit flags or callback existence
  const prevDisabled = hasPrevious === false || !onPrevious;
  const nextDisabled = hasNext === false || !onNext;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 flex items-center justify-between">
      
      {/* LEFT: Navigation & Tools */}
      <div className="flex gap-3">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button 
            onClick={onPrevious}
            disabled={prevDisabled}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all"
            title="Previous Album"
          >
            ← Prev
          </button>
          <div className="w-px bg-gray-300 my-1 mx-1"></div>
          <button 
            onClick={onNext}
            disabled={nextDisabled}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all"
            title="Next Album"
          >
            Next →
          </button>
        </div>

        {onOpenLocationPicker && (
          <button
            onClick={onOpenLocationPicker}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
          >
            📍 Location
          </button>
        )}
      </div>

      {/* CENTER: Status Indicator */}
      <div className="hidden md:flex flex-col items-center">
        {hasChanges ? (
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wide">Unsaved Changes</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-400">
            <span className="text-xs font-medium uppercase tracking-wide">All saved</span>
          </div>
        )}
      </div>

      {/* RIGHT: Main Actions */}
      <div className="flex gap-3">
        {onCancel && (
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-transparent hover:bg-gray-100 rounded-md transition-colors"
          >
            Close
          </button>
        )}
        
        <button 
          onClick={onSave}
          disabled={!hasChanges || isSaving}
          className={`px-6 py-2 text-sm font-bold text-white rounded-md shadow-sm transition-all flex items-center gap-2 ${
            hasChanges 
              ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-md hover:-translate-y-0.5' 
              : 'bg-gray-300 cursor-not-allowed text-gray-500'
          }`}
        >
          {isSaving ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Saving...</span>
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </div>
  );
}