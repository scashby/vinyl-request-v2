// src/app/edit-collection/components/ClassicalTab.tsx
'use client';

import React from 'react';
import { AlbumData } from '@/types/collection';

interface ClassicalTabProps {
  albumData: AlbumData;
  onFieldChange: (field: keyof AlbumData, value: string) => void;
}

export default function ClassicalTab({ albumData, onFieldChange }: ClassicalTabProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Composer Field */}
        <div className="flex items-center gap-3">
          <label className="text-[13px] text-[#e8e6e3] w-[120px] text-right flex-shrink-0">
            Composer:
          </label>
          <div className="flex-1 flex items-center gap-2">
            <button
              type="button"
              className="h-[26px] px-3 bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] text-[13px] border border-[#555555] rounded flex items-center justify-between min-w-[200px] transition-colors"
              onClick={() => {
                // TODO: Open Composer picker modal
                console.log('Open Composer picker');
              }}
            >
              <span className="text-[#999999]">
                {albumData.composer || 'Select...'}
              </span>
              <svg className="w-3 h-3 ml-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            {albumData.composer && (
              <button
                type="button"
                className="h-[26px] w-[26px] bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] border border-[#555555] rounded flex items-center justify-center transition-colors"
                onClick={() => onFieldChange('composer', '')}
                title="Clear composer"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Conductor Field */}
        <div className="flex items-center gap-3">
          <label className="text-[13px] text-[#e8e6e3] w-[120px] text-right flex-shrink-0">
            Conductor:
          </label>
          <div className="flex-1 flex items-center gap-2">
            <button
              type="button"
              className="h-[26px] px-3 bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] text-[13px] border border-[#555555] rounded flex items-center justify-between min-w-[200px] transition-colors"
              onClick={() => {
                // TODO: Open Conductor picker modal
                console.log('Open Conductor picker');
              }}
            >
              <span className="text-[#999999]">
                {albumData.conductor || 'Select...'}
              </span>
              <svg className="w-3 h-3 ml-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            {albumData.conductor && (
              <button
                type="button"
                className="h-[26px] w-[26px] bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] border border-[#555555] rounded flex items-center justify-center transition-colors"
                onClick={() => onFieldChange('conductor', '')}
                title="Clear conductor"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Chorus Field */}
        <div className="flex items-center gap-3">
          <label className="text-[13px] text-[#e8e6e3] w-[120px] text-right flex-shrink-0">
            Chorus:
          </label>
          <div className="flex-1 flex items-center gap-2">
            <button
              type="button"
              className="h-[26px] px-3 bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] text-[13px] border border-[#555555] rounded flex items-center justify-between min-w-[200px] transition-colors"
              onClick={() => {
                // TODO: Open Chorus picker modal
                console.log('Open Chorus picker');
              }}
            >
              <span className="text-[#999999]">
                {albumData.chorus || 'Select...'}
              </span>
              <svg className="w-3 h-3 ml-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            {albumData.chorus && (
              <button
                type="button"
                className="h-[26px] w-[26px] bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] border border-[#555555] rounded flex items-center justify-center transition-colors"
                onClick={() => onFieldChange('chorus', '')}
                title="Clear chorus"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Composition Field */}
        <div className="flex items-center gap-3">
          <label className="text-[13px] text-[#e8e6e3] w-[120px] text-right flex-shrink-0">
            Composition:
          </label>
          <div className="flex-1 flex items-center gap-2">
            <button
              type="button"
              className="h-[26px] px-3 bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] text-[13px] border border-[#555555] rounded flex items-center justify-between min-w-[200px] transition-colors"
              onClick={() => {
                // TODO: Open Composition picker modal
                console.log('Open Composition picker');
              }}
            >
              <span className="text-[#999999]">
                {albumData.composition || 'Select...'}
              </span>
              <svg className="w-3 h-3 ml-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            {albumData.composition && (
              <button
                type="button"
                className="h-[26px] w-[26px] bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] border border-[#555555] rounded flex items-center justify-center transition-colors"
                onClick={() => onFieldChange('composition', '')}
                title="Clear composition"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Orchestra Field */}
        <div className="flex items-center gap-3">
          <label className="text-[13px] text-[#e8e6e3] w-[120px] text-right flex-shrink-0">
            Orchestra:
          </label>
          <div className="flex-1 flex items-center gap-2">
            <button
              type="button"
              className="h-[26px] px-3 bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] text-[13px] border border-[#555555] rounded flex items-center justify-between min-w-[200px] transition-colors"
              onClick={() => {
                // TODO: Open Orchestra picker modal
                console.log('Open Orchestra picker');
              }}
            >
              <span className="text-[#999999]">
                {albumData.orchestra || 'Select...'}
              </span>
              <svg className="w-3 h-3 ml-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            {albumData.orchestra && (
              <button
                type="button"
                className="h-[26px] w-[26px] bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] border border-[#555555] rounded flex items-center justify-center transition-colors"
                onClick={() => onFieldChange('orchestra', '')}
                title="Clear orchestra"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}