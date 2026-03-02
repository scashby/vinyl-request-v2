// src/app/edit-collection/tabs/EnrichmentTab.tsx
'use client';

import React from 'react';
import type { Album } from 'types/album';

interface EnrichmentTabProps {
  album: Album;
  onChange: (field: keyof Album, value: unknown) => void;
}

const toStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
};

const parseListInput = (value: string): string[] =>
  Array.from(
    new Set(
      value
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

const prettyJson = (value: unknown): string => {
  if (!value || typeof value !== 'object') return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
};

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

  const renderListEditor = (label: string, field: keyof Album, placeholder: string, rows = 3) => (
    <div>
      <label className="block text-[12px] font-semibold text-gray-500 mb-1">{label}</label>
      <textarea
        rows={rows}
        value={toStringArray(album[field]).join('\n')}
        onChange={(e) => onChange(field, parseListInput(e.target.value))}
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
        placeholder={placeholder}
      />
      <div className="text-[11px] text-gray-400 mt-1">One item per line (or comma-separated).</div>
    </div>
  );

  return (
    <div className="p-4 space-y-6">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-3">Similar Albums</div>
          {renderListEditor('Last.fm Similar Albums', 'lastfm_similar_albums', 'Album 1\nAlbum 2', 4)}
          <div className="mt-3">
            <label className="block text-[12px] font-semibold text-gray-500 mb-1">AllMusic Similar Albums (Deprecated)</label>
            <textarea
              rows={3}
              value={toStringArray(album.allmusic_similar_albums).join('\n')}
              readOnly
              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm bg-gray-50 text-gray-500"
              placeholder="No active producer/consumer configured."
            />
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-3">Chart & Recognition</div>
          {renderListEditor('Chart Positions', 'chart_positions', 'US Billboard 200 #3')}
          {renderListEditor('Awards', 'awards', 'Grammy Award: Best Album')}
          {renderListEditor('Certifications', 'certifications', 'RIAA Platinum')}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-3">Reviews & Context</div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1">Pitchfork Score</label>
              <input
                type="text"
                value={album.pitchfork_score ?? ''}
                onChange={(e) => onChange('pitchfork_score', e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                placeholder="e.g. 8.4"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1">Pitchfork Review</label>
              <textarea
                rows={3}
                value={album.pitchfork_review || ''}
                onChange={(e) => onChange('pitchfork_review', e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1">Critical Reception</label>
              <textarea
                rows={4}
                value={album.critical_reception || ''}
                onChange={(e) => onChange('critical_reception', e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-3">Context Details</div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1">Cultural Significance</label>
              <textarea
                rows={4}
                value={album.cultural_significance || ''}
                onChange={(e) => onChange('cultural_significance', e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1">Recording Location</label>
              <input
                type="text"
                value={album.recording_location || ''}
                onChange={(e) => onChange('recording_location', e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                placeholder="Studio/location"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1">Apple Music Editorial Notes</label>
              <textarea
                rows={3}
                value={album.apple_music_editorial_notes || ''}
                onChange={(e) => onChange('apple_music_editorial_notes', e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-3">Release Metadata Extras</div>
        {renderListEditor('Companies', 'companies', 'Pressed By: ...\nManufactured By: ...')}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-3">Musical Properties</div>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1">BPM (Tempo)</label>
              <input
                type="number"
                value={album.tempo_bpm || ''}
                onChange={(e) => onChange('tempo_bpm', parseInt(e.target.value, 10) || null)}
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
          <div className="mb-3">
            <label className="block text-[12px] font-semibold text-gray-500 mb-1">Time Signature</label>
            <input
              type="number"
              value={album.time_signature || ''}
              onChange={(e) => onChange('time_signature', parseInt(e.target.value, 10) || null)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              placeholder="e.g. 4"
            />
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

      <details className="border border-gray-200 rounded-md bg-gray-50">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">
          Admin Diagnostics
        </summary>
        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-semibold text-gray-500 mb-1">Enrichment Summary (JSON)</label>
            <textarea
              rows={8}
              readOnly
              value={prettyJson(album.enrichment_summary)}
              className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs bg-white text-gray-600 font-mono"
              placeholder="No enrichment summary payload"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-gray-500 mb-1">Enriched Metadata (JSON)</label>
            <textarea
              rows={8}
              readOnly
              value={prettyJson(album.enriched_metadata)}
              className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs bg-white text-gray-600 font-mono"
              placeholder="No enriched metadata payload"
            />
          </div>
        </div>
      </details>
    </div>
  );
}
// AUDIT: expanded to surface hidden enrichment fields and admin diagnostics.
