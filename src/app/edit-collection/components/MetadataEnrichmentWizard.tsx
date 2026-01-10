// src/app/edit-collection/components/MetadataEnrichmentWizard.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Check, Save, Loader2, AlertCircle, ArrowRight, Database, Globe } from 'lucide-react';
import { Album } from '../../../types/album'; 

// --- Types ---
interface NormalizedMetadata {
  source: 'Discogs' | 'MusicBrainz' | 'TheAudioDB';
  releaseDate?: string;
  label?: string;
  catalogNumber?: string;
  country?: string;
  genres: string[];
  styles: string[];
  credits: { role: string; name: string }[];
  description?: string;
  score: number;
}

interface MetadataEnrichmentWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Album>) => Promise<void>;
  album: Album;
}

type Tab = 'basics' | 'genres' | 'credits' | 'review';

export default function MetadataEnrichmentWizard({
  isOpen,
  onClose,
  onSave,
  album
}: MetadataEnrichmentWizardProps) {
  // --- State ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<NormalizedMetadata[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('basics');
  const [isSaving, setIsSaving] = useState(false);

  // The "Sandbox" - Storing the user's choices
  const [pendingData, setPendingData] = useState<Partial<Album>>({});

  // --- Logic ---
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/enrich-sources/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist: album.artist, album: album.title }),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      setSources(result.data || []);
      
      // Initialize pending data with current DB values to start
      setPendingData({
        year: album.year,
        labels: album.labels,
        cat_no: album.cat_no,
        country: album.country,
        genres: album.genres || [],
        styles: album.styles || [],
        // We initialize others as needed
      });

    } catch (err: unknown) {
        if (err instanceof Error) setError(err.message);
        else setError("An unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, [album]);

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen, fetchData]);

  // Helper: Get unique values from all sources for a specific field
  const getSuggestions = (field: keyof NormalizedMetadata) => {
    const values = new Set<string>();
    sources.forEach(s => {
      const val = s[field];
      if (val && typeof val === 'string') values.add(val);
    });
    return Array.from(values);
  };

  const getArraySuggestions = (field: 'genres' | 'styles') => {
    const counts = new Map<string, number>();
    sources.forEach(s => {
      if (s[field]) {
        s[field].forEach(item => {
          counts.set(item, (counts.get(item) || 0) + 1);
        });
      }
    });
    // Return sorted by frequency
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(pendingData);
    setIsSaving(false);
    onClose();
  };

  // --- Renderers ---

  const renderComparisonRow = (label: string, field: keyof Album, suggestions: string[]) => {
    const currentVal = pendingData[field] as string || '—';
    
    return (
      <div className="grid grid-cols-12 gap-4 py-4 border-b border-slate-800 items-center">
        <div className="col-span-3 text-slate-400 font-medium">{label}</div>
        
        {/* Current / Selected Value */}
        <div className="col-span-4">
          <div className="bg-slate-800 px-3 py-2 rounded text-white flex items-center justify-between border border-slate-600">
            <span className="truncate" title={currentVal}>{currentVal}</span>
            <Database size={14} className="text-purple-400" />
          </div>
        </div>

        <div className="col-span-1 flex justify-center">
            <ArrowRight size={16} className="text-slate-600" />
        </div>

        {/* Suggestions */}
        <div className="col-span-4 flex flex-wrap gap-2">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => setPendingData(prev => ({ ...prev, [field]: s }))}
              className={`
                px-3 py-1 text-sm rounded-full border transition-colors
                ${pendingData[field] === s 
                  ? 'bg-green-600 border-green-500 text-white' 
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-purple-500'}
              `}
            >
              {s}
            </button>
          ))}
          {suggestions.length === 0 && <span className="text-slate-600 italic text-sm">No new data found</span>}
        </div>
      </div>
    );
  };

  const renderTagCloud = (field: 'genres' | 'styles', label: string) => {
    const currentTags = new Set(pendingData[field] as string[] || []);
    const suggestions = getArraySuggestions(field);

    const toggleTag = (tag: string) => {
      const newTags = new Set(currentTags);
      if (newTags.has(tag)) newTags.delete(tag);
      else newTags.add(tag);
      setPendingData(prev => ({ ...prev, [field]: Array.from(newTags) }));
    };

    return (
      <div className="mb-8">
        <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            {label}
            <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">{currentTags.size} selected</span>
        </h4>
        <div className="flex flex-wrap gap-2 p-4 bg-slate-950/50 rounded-xl border border-slate-800">
          {suggestions.map(([tag, count]) => {
            const isSelected = currentTags.has(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`
                  px-3 py-1.5 rounded text-sm font-medium transition-all flex items-center gap-2
                  ${isSelected 
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}
                `}
              >
                {tag}
                {count > 1 && <span className="bg-black/20 px-1.5 rounded text-[10px]">{count}</span>}
                {isSelected && <Check size={12} />}
              </button>
            );
          })}
          {suggestions.length === 0 && <div className="text-slate-500 italic">No suggestions found.</div>}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 w-full max-w-5xl h-[85vh] rounded-xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Globe className="text-blue-400" /> 
              Metadata Manager
            </h2>
            <p className="text-sm text-slate-400">{album.artist} — {album.title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><X size={24} /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-slate-900 flex">
            {/* Sidebar Tabs */}
            <div className="w-64 bg-slate-950/50 border-r border-slate-800 p-4 space-y-2">
                {[
                    { id: 'basics', label: 'Basic Details' },
                    { id: 'genres', label: 'Genres & Styles' },
                    { id: 'credits', label: 'Credits (Beta)' }, // Placeholder for now
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as Tab)}
                        className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' : 'text-slate-400 hover:bg-slate-800'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Main Area */}
            <div className="flex-1 p-8 relative">
                {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur z-10">
                        <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
                        <p className="text-slate-300">Aggregating metadata sources...</p>
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-900/20 border border-red-900/50 text-red-300 rounded-lg flex items-center gap-3">
                        <AlertCircle /> {error}
                    </div>
                )}

                {!loading && !error && (
                    <>
                        {activeTab === 'basics' && (
                            <div className="space-y-2">
                                {renderComparisonRow("Release Year", "year", getSuggestions('releaseDate').map(d => d ? d.substring(0, 4) : '').filter(Boolean))}
                                {renderComparisonRow("Label", "labels", getSuggestions('label'))}
                                {renderComparisonRow("Catalog #", "cat_no", getSuggestions('catalogNumber'))}
                                {renderComparisonRow("Country", "country", getSuggestions('country'))}
                            </div>
                        )}

                        {activeTab === 'genres' && (
                            <div>
                                <p className="text-slate-400 mb-6 text-sm">
                                    Combine tags from Discogs, MusicBrainz, and TheAudioDB. Click to toggle.
                                </p>
                                {renderTagCloud('genres', 'Genres')}
                                {renderTagCloud('styles', 'Styles')}
                            </div>
                        )}

                        {activeTab === 'credits' && (
                            <div className="text-center py-20 text-slate-500">
                                <p>Deep credit merging coming in Phase 4.</p>
                                <p className="text-sm mt-2">Currently available credits are saved automatically if selected.</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
            <button 
                onClick={handleSave}
                disabled={isSaving || loading}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold transition-all disabled:opacity-50"
            >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Save Changes
            </button>
        </div>
      </div>
    </div>
  );
}