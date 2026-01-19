// src/app/edit-collection/tabs/EnrichmentTab.tsx
'use client';

import React from 'react';
import type { Album } from 'types/album';

interface EnrichmentTabProps {
  album: Album;
  onChange: (field: keyof Album, value: any) => void;
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
    <div className="max-w-3xl mx-auto space-y-8">
      
      {/* SECTION 1: EXTERNAL FACTS */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-blue-100/50 border-b border-blue-200 flex justify-between items-center">
          <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide">
            External Data Sources
          </h3>
          <span className="text-xs text-blue-600">
            {album.enrichment_summary ? Object.keys(album.enrichment_summary).length : 0} Sources
          </span>
        </div>
        
        <div className="p-4 space-y-3">
          {album.enrichment_summary && Object.keys(album.enrichment_summary).length > 0 ? (
            Object.entries(album.enrichment_summary).map(([source, text]) => (
              <div key={source} className="flex gap-3 bg-white p-3 rounded border border-blue-100 shadow-sm">
                <div className="w-32 shrink-0">
                  <span className="text-xs font-bold text-gray-500 uppercase bg-gray-100 px-2 py-1 rounded">
                    {source.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-sm text-gray-800 break-words flex-1">
                  {String(text).startsWith('http') ? (
                    <a href={String(text)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {String(text)}
                    </a>
                  ) : (
                    String(text)
                  )}
                </div>
                <button 
                  onClick={() => {
                    const newSummary = { ...album.enrichment_summary };
                    delete newSummary[source];
                    onChange('enrichment_summary', newSummary);
                  }}
                  className="text-gray-400 hover:text-red-500 text-lg leading-none"
                  title="Remove this fact"
                >
                  ×
                </button>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-400 text-sm py-4 italic">
              No external enrichment data found. Run "Enrich Collection" to populate.
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: SONIC DNA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* LEFT: Basic Stats */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-700 border-b border-gray-200 pb-2">
            Musical Properties
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">BPM (Tempo)</label>
              <input 
                type="number" 
                value={album.tempo_bpm || ''} 
                onChange={(e) => onChange('tempo_bpm', parseInt(e.target.value) || null)}
                className="w-full p-2 border border-gray-300 rounded text-sm"
                placeholder="e.g. 120"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Musical Key</label>
              <input 
                type="text" 
                value={album.musical_key || ''} 
                onChange={(e) => onChange('musical_key', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded text-sm"
                placeholder="e.g. C Major"
              />
            </div>
          </div>

          <div className="pt-2">
             {renderSlider('Energy', 'energy', 'accent-orange-500')}
             {renderSlider('Danceability', 'danceability', 'accent-purple-500')}
          </div>
        </div>

        {/* RIGHT: Moods */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-700 border-b border-gray-200 pb-2 mb-4">
            Mood & Atmosphere
          </h3>
          
          {renderSlider('Acoustic', 'mood_acoustic', 'accent-amber-600')}
          {renderSlider('Electronic', 'mood_electronic', 'accent-cyan-500')}
          {renderSlider('Happy', 'mood_happy', 'accent-yellow-400')}
          {renderSlider('Sad', 'mood_sad', 'accent-blue-400')}
          {renderSlider('Aggressive', 'mood_aggressive', 'accent-red-500')}
          {renderSlider('Relaxed', 'mood_relaxed', 'accent-indigo-400')}
          {renderSlider('Party', 'mood_party', 'accent-pink-500')}
        </div>
      </div>

    </div>
  );
}