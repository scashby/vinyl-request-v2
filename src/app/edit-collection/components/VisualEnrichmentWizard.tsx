'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, Check, Image as ImageIcon, ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react';

// --- Types (Match API Response) ---
interface ImageCandidate {
  source: 'Spotify' | 'Discogs' | 'MusicBrainz';
  url: string;
  width?: number;
  height?: number;
  type: 'front' | 'back' | 'gallery';
}

interface VisualEnrichmentWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (images: { front: string | null; back: string | null; gallery: string[] }) => Promise<void>;
  artist: string;
  album: string;
}

type WizardStep = 'loading' | 'front' | 'back' | 'gallery';

export default function VisualEnrichmentWizard({
  isOpen,
  onClose,
  onSave,
  artist,
  album
}: VisualEnrichmentWizardProps) {
  // --- State ---
  const [step, setStep] = useState<WizardStep>('loading');
  const [candidates, setCandidates] = useState<ImageCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sandbox State (The temporary selections)
  const [selectedFront, setSelectedFront] = useState<ImageCandidate | null>(null);
  const [selectedBack, setSelectedBack] = useState<ImageCandidate | null>(null);
  const [selectedGallery, setSelectedGallery] = useState<Set<string>>(new Set());

  // --- Logic ---
  const resetState = useCallback(() => {
    setStep('loading');
    setCandidates([]);
    setSelectedFront(null);
    setSelectedBack(null);
    setSelectedGallery(new Set());
    setError(null);
    setIsSaving(false);
  }, []);

  const fetchImages = useCallback(async () => {
    try {
      setStep('loading');
      const res = await fetch('/api/enrich-sources/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, album }),
      });

      const result = await res.json();

      if (!result.success) throw new Error(result.error || 'Failed to fetch images');

      const images: ImageCandidate[] = result.data || [];
      setCandidates(images);

      // Smart Pre-selection: Highest resolution image that is 'front' or 'Spotify'
      const bestFront = images
        .filter(i => i.type === 'front' || i.source === 'Spotify')
        .sort((a, b) => (b.width || 0) - (a.width || 0))[0];

      if (bestFront) setSelectedFront(bestFront);

      setStep('front');
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch images');
      }
    }
  }, [artist, album]);

  // --- Effects ---
  useEffect(() => {
    if (isOpen) {
      resetState();
      fetchImages();
    }
  }, [isOpen, resetState, fetchImages]);

  const getAvailableImages = () => {
    return candidates.filter(img => {
      if (step === 'back' && img.url === selectedFront?.url) return false;
      if (step === 'gallery' && (img.url === selectedFront?.url || img.url === selectedBack?.url)) return false;
      return true;
    });
  };

  const handleNext = () => {
    if (step === 'front') {
        setStep('back');
    } else if (step === 'back') {
      const galleryCandidates = getAvailableImages().filter(img => img.type === 'gallery' || img.type === 'back');
      const newSet = new Set(selectedGallery);
      galleryCandidates.forEach(img => newSet.add(img.url));
      setSelectedGallery(newSet);
      setStep('gallery');
    }
  };

  const handleBack = () => {
    if (step === 'back') setStep('front');
    else if (step === 'gallery') setStep('back');
  };

  const handleFinish = async () => {
    setIsSaving(true);
    try {
        await onSave({
            front: selectedFront?.url || null,
            back: selectedBack?.url || null,
            gallery: Array.from(selectedGallery),
        });
        onClose();
    } catch (e) {
        console.error("Save failed", e);
    } finally {
        setIsSaving(false);
    }
  };

  const toggleGallerySelection = (url: string) => {
    const newSet = new Set(selectedGallery);
    if (newSet.has(url)) newSet.delete(url);
    else newSet.add(url);
    setSelectedGallery(newSet);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 w-full max-w-6xl h-[90vh] rounded-xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ImageIcon className="text-purple-400" /> 
              Visual Enrichment
            </h2>
            <p className="text-sm text-slate-400 font-mono mt-1">{artist} — {album}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-900 relative custom-scrollbar">
          
          {step === 'loading' && (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
              <p className="text-slate-300 animate-pulse">Scouring Discogs, Spotify & MusicBrainz...</p>
            </div>
          )}

          {error && (
            <div className="h-full flex flex-col items-center justify-center text-red-400 space-y-4">
              <AlertCircle size={48} />
              <div className="text-center">
                <p className="text-lg font-bold">Unable to fetch images.</p>
                <p className="text-sm opacity-70">{error}</p>
              </div>
              <button onClick={fetchImages} className="mt-4 px-6 py-2 bg-slate-800 rounded-lg hover:bg-slate-700 text-white border border-slate-700">
                Retry Search
              </button>
            </div>
          )}

          {step !== 'loading' && !error && (
            <div className="space-y-8">
              {/* Steps */}
              <div className="flex items-center justify-center gap-2">
                <StepBadge active={step === 'front'} label="1. Front Cover" completed={!!selectedFront} />
                <div className="w-12 h-[1px] bg-slate-700" />
                <StepBadge active={step === 'back'} label="2. Back Cover" completed={!!selectedBack} />
                <div className="w-12 h-[1px] bg-slate-700" />
                <StepBadge active={step === 'gallery'} label="3. Gallery" completed={selectedGallery.size > 0} />
              </div>

              {/* Instructions */}
              <div className="text-center max-w-2xl mx-auto">
                <h3 className="text-3xl font-bold text-white mb-2">
                  {step === 'front' && "Select the Best Front Cover"}
                  {step === 'back' && "Select a Back Cover"}
                  {step === 'gallery' && "Curate the Gallery"}
                </h3>
                <p className="text-slate-400 text-lg">
                  {step === 'front' && "We found these candidates. The highest resolution image is pre-selected."}
                  {step === 'back' && "Usually found on Discogs. If none match, you can skip this step."}
                  {step === 'gallery' && "Select any extra artwork, inner sleeves, or variants you want to keep."}
                </p>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 pb-20">
                {getAvailableImages().map((img, idx) => {
                  const isSelected = 
                    (step === 'front' && selectedFront?.url === img.url) ||
                    (step === 'back' && selectedBack?.url === img.url) ||
                    (step === 'gallery' && selectedGallery.has(img.url));

                  return (
                    <div 
                      key={`${img.source}-${idx}`}
                      onClick={() => {
                        if (step === 'front') setSelectedFront(img);
                        if (step === 'back') setSelectedBack(isSelected ? null : img);
                        if (step === 'gallery') toggleGallerySelection(img.url);
                      }}
                      className={`
                        group relative aspect-square rounded-xl overflow-hidden cursor-pointer border-4 transition-all duration-300 ease-out
                        ${isSelected 
                            ? 'border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)] scale-[1.02]' 
                            : 'border-transparent hover:border-slate-600 hover:scale-[1.01]'
                        }
                      `}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={img.url} 
                        alt={`${img.source} candidate`} 
                        className="w-full h-full object-cover bg-slate-800"
                        loading="lazy"
                      />
                      <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md text-[10px] text-white px-2 py-1 rounded-md font-mono">
                        {img.width ? `${img.width}x${img.height}` : 'Unknown'}
                      </div>
                      <div className={`
                        absolute top-2 right-2 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider
                        ${img.source === 'Spotify' ? 'bg-[#1DB954] text-black' : 
                          img.source === 'Discogs' ? 'bg-[#333] text-white' : 'bg-[#BA478F] text-white'}
                      `}>
                        {img.source}
                      </div>
                      
                      {isSelected && (
                        <div className="absolute inset-0 bg-purple-900/30 flex items-center justify-center animate-in fade-in duration-200">
                          <div className="bg-purple-600 rounded-full p-3 shadow-lg transform transition-transform">
                            <Check className="text-white" size={32} strokeWidth={3} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {getAvailableImages().length === 0 && (
                <div className="text-center py-24 text-slate-500 bg-slate-950/30 rounded-xl border border-dashed border-slate-800">
                  <p className="text-xl">No specific images found for this step.</p>
                  <button onClick={handleNext} className="mt-4 text-purple-400 hover:text-purple-300 underline">
                    Skip this step
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-950 flex justify-between items-center">
          <button 
            onClick={handleBack}
            disabled={step === 'front' || step === 'loading' || isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-0 transition-all font-medium"
          >
            <ArrowLeft size={18} /> Back
          </button>

          <div className="flex gap-4">
            {step === 'back' && !selectedBack && (
               <button 
               onClick={handleNext}
               className="px-6 py-2 rounded-lg text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 transition-all font-medium"
             >
               Skip Back Cover
             </button>
            )}

            {step !== 'gallery' ? (
              <button 
                onClick={handleNext}
                disabled={step === 'loading' || (step === 'front' && !selectedFront)}
                className="flex items-center gap-2 px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold shadow-lg shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                Next Step <ChevronRight size={18} />
              </button>
            ) : (
              <button 
                onClick={handleFinish}
                disabled={isSaving}
                className="flex items-center gap-2 px-10 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-lg shadow-green-900/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-wait"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} 
                {isSaving ? 'Saving...' : 'Apply & Save'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function StepBadge({ active, completed, label }: { active: boolean; completed: boolean; label: string }) {
  const [num, text] = label.split('. ');
  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-full transition-all duration-300 ${active ? 'bg-slate-800 border border-slate-600' : 'opacity-50'}`}>
      <div className={`
        w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
        ${completed && !active ? 'bg-green-500 text-slate-900' : active ? 'bg-purple-500 text-white' : 'bg-slate-700 text-slate-400'}
      `}>
        {completed && !active ? <Check size={14} /> : num}
      </div>
      <span className={`text-sm font-medium ${active ? 'text-white' : 'text-slate-400'}`}>
        {text}
      </span>
    </div>
  );
}