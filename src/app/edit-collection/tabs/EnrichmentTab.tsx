// src/app/edit-collection/tabs/EnrichmentTab.tsx
'use client';

import React from 'react';
import type { Album } from 'types/album';

interface EnrichmentTabProps {
  album: Album;
  onChange: (field: keyof Album, value: unknown) => void;
}

export function EnrichmentTab({ album, onChange }: EnrichmentTabProps) {
  
  const renderSlider = (label: string, field: keyof Album, colorClass: string) => {
    const val = typeof album[field] === 'number' ? album[field] as number : 0;
    return (
      <div className="flex items-center gap-3 mb-2">
        <div className="w-24 text-xs font-semibold text-gray-500">{label}</div>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.01"
          value={val}
          onChange={(e) => onChange(field, parseFloat(e.target.value))}
          className={`flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 ${colorClass}`}
        />
        <div className="w-12 text-right text-xs font-mono text-gray-600">
          {Math.round(val * 100)}%
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-6">
      {/* Enrichment Sources */}
      <div>
        <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Enrichment Sources</h3>
          <span className="text-xs text-gray-500">{album.enrichment_sources?.length || 0} Sources</span>
        </div>
        {album.enrichment_sources && album.enrichment_sources.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {album.enrichment_sources.map((source) => (
              <span key={source} className="text-[11px] font-semibold text-gray-700 uppercase bg-gray-100 border border-gray-200 px-2 py-1 rounded">
                {source}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-[13px] text-gray-400 italic">
            No external enrichment data found. Run &quot;Enrich Collection&quot; to populate.
          </div>
        )}
      </div>

      {/* Sonic / Mood */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-3">Musical Properties</div>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1">BPM (Tempo)</label>
              <input
                type="number"
                value={album.tempo_bpm || ''}
                onChange={(e) => onChange('tempo_bpm', parseInt(e.target.value) || null)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                placeholder="e.g. 120"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1">Musical Key</label>
              <input
                type="text"
                value={album.musical_key || ''}
                onChange={(e) => onChange('musical_key', e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                placeholder="e.g. C Major"
              />
            </div>
          </div>
          {renderSlider('Energy', 'energy', 'accent-orange-500')}
          {renderSlider('Danceability', 'danceability', 'accent-purple-500')}
        </div>

        <div>
          <div className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-3">Mood Profile</div>
          {renderSlider('Acoustic', 'mood_acoustic', 'accent-slate-500')}
          {renderSlider('Electronic', 'mood_electronic', 'accent-indigo-500')}
          {renderSlider('Happy', 'mood_happy', 'accent-yellow-500')}
          {renderSlider('Sad', 'mood_sad', 'accent-blue-500')}
          {renderSlider('Aggressive', 'mood_aggressive', 'accent-red-500')}
          {renderSlider('Relaxed', 'mood_relaxed', 'accent-green-500')}
          {renderSlider('Party', 'mood_party', 'accent-pink-500')}
        </div>
      </div>
    </div>
  );
}
// AUDIT: updated for UI parity with CLZ reference.
