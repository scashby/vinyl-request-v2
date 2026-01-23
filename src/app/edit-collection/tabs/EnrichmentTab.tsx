// src/app/edit-collection/tabs/EnrichmentTab.tsx
'use client';

import React from 'react';
import type { Album } from 'types/album';

interface EnrichmentTabProps {
  album: Album;
  onChange: <K extends keyof Album>(field: K, value: Album[K]) => void;
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
      
      {/* SECTION 1: EXTERNAL SOURCES */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-blue-100/50 border-b border-blue-200 flex justify-between items-center">
          <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide">
            Enrichment Sources
          </h3>
          <span className="text-xs text-blue-600">
            {album.enrichment_sources?.length || 0} Sources
          </span>
        </div>
        
        <div className="p-4">
          {album.enrichment_sources && album.enrichment_sources.length > 0 ? (
             <div className="flex flex-wrap gap-2">
                {album.enrichment_sources.map((source) => (
                  <span key={source} className="text-xs font-bold text-blue-700 uppercase bg-white border border-blue-200 px-2 py-1 rounded shadow-sm">
                    {source}
                  </span>
                ))}
             </div>
          ) : (
            <div className="text-center text-gray-400 text-sm py-2 italic">
              No external enrichment data found. Run &quot;Enrich Collection&quot; to populate.
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: SONIC DNA */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-sm font-bold text-gray-700 border-b border-gray-200 pb-2 mb-4">
            Musical Properties
          </h3>
          
          <div className="grid grid-cols-2 gap-6 mb-6">
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

          <div className="space-y-4">
             {renderSlider('Energy', 'energy', 'accent-orange-500')}
             {renderSlider('Danceability', 'danceability', 'accent-purple-500')}
             {/* Valence exists in DB if you want to add it later: renderSlider('Valence', 'valence', 'accent-green-500') */}
          </div>
      </div>
    </div>
  );
}