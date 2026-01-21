// src/app/browse/album-detail/[id]/page.tsx
"use client";

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from 'src/lib/supabaseClient';

interface Track {
  position?: string;
  title: string;
  name?: string;
  artist?: string;
  duration?: string;
}

interface Album {
  id: number;
  title: string;
  artist: string;
  image_url: string;
  year?: string;
  format?: string;
  folder?: string;
  media_condition?: string;
  notes?: string;
  is_1001?: boolean;
  tracklists?: string;
  sides?: Record<string, Track[] | string[]>;
  blocked_tracks?: { position: string; reason: string }[];
}

interface EventData {
  id: number;
  title: string;
  date: string;
  has_queue: boolean;
  queue_types?: string[];
  queue_type?: string;
}

function AlbumDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params?.id as string;
  const eventId = searchParams.get('eventId');

  const [album, setAlbum] = useState<Album | null>(null);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const fetchAlbum = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('collection')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        setError(error.message);
      } else {
        setAlbum(data as Album);
      }
    } catch {
      setError('Failed to load album');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchEventData = useCallback(async () => {
    if (!eventId) return;
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      if (!error && data) {
        setEventData(data as EventData);
      }
    } catch (error) {
      console.error('Error fetching event data:', error);
    }
  }, [eventId]);

  useEffect(() => {
    if (id) fetchAlbum();
    if (eventId) fetchEventData();
  }, [id, eventId, fetchAlbum, fetchEventData]);

  const handleAddToQueue = async (side: string) => {
    if (!eventId || !album) return;
    setSubmittingRequest(true);
    try {
      const { data: existing, error } = await supabase
        .from('requests')
        .select('id, votes')
        .eq('event_id', eventId)
        .eq('album_id', id)
        .eq('side', side)
        .maybeSingle();

      if (error) throw error;

      if (existing) {
        await supabase.from('requests').update({ votes: (existing.votes || 1) + 1 }).eq('id', existing.id);
        setRequestStatus(`Upvoted Side ${side}`);
      } else {
        await supabase.from('requests').insert([{
          album_id: id, artist: album.artist, title: album.title, side, event_id: eventId, votes: 1, status: 'open'
        }]);
        setRequestStatus(`Requested Side ${side}`);
      }
    } catch (e) {
      console.error(e);
      setRequestStatus('Error adding to queue');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleAddTrackToQueue = async (track: Track) => {
    if (!eventId || !album) return;
    setSubmittingRequest(true);
    try {
      const { data: existing, error } = await supabase
        .from('requests')
        .select('id, votes')
        .eq('event_id', eventId)
        .eq('album_id', id)
        .eq('track_number', track.position || '')
        .maybeSingle();

      if (error) throw error;

      if (existing) {
        await supabase.from('requests').update({ votes: (existing.votes || 1) + 1 }).eq('id', existing.id);
        setRequestStatus(`Upvoted: ${track.title}`);
      } else {
        await supabase.from('requests').insert([{
          album_id: id, artist: track.artist || album.artist, title: track.title || track.name,
          track_number: track.position || '', track_name: track.title || track.name,
          track_duration: track.duration || '', event_id: eventId, votes: 1, status: 'open', side: null
        }]);
        setRequestStatus(`Requested: ${track.title}`);
      }
    } catch (e) {
      console.error(e);
      setRequestStatus('Error adding track');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleAddAlbumToQueue = async () => {
    if (!eventId || !album) return;
    setSubmittingRequest(true);
    try {
      const { data: existing, error } = await supabase
        .from('requests')
        .select('id, votes')
        .eq('event_id', eventId)
        .eq('album_id', id)
        .is('side', null)
        .is('track_number', null)
        .maybeSingle();

      if (error) throw error;

      if (existing) {
        await supabase.from('requests').update({ votes: (existing.votes || 1) + 1 }).eq('id', existing.id);
        setRequestStatus(`Upvoted Album`);
      } else {
        await supabase.from('requests').insert([{
          album_id: id, artist: album.artist, title: album.title, side: null, track_number: null,
          track_name: null, event_id: eventId, votes: 1, status: 'open'
        }]);
        setRequestStatus(`Requested Album`);
      }
    } catch (e) {
      console.error(e);
      setRequestStatus('Error adding album');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const goToEvent = () => router.push(`/events/event-detail/${eventId}`);
  const goToBrowse = () => router.push(`/browse/browse-albums?eventId=${eventId}`);
  const goToQueue = () => router.push(`/browse/browse-queue?eventId=${eventId}`);

  const getAvailableSides = () => {
    const sides = new Set<string>();
    if (album?.tracklists) {
      try {
        const parsed = JSON.parse(album.tracklists);
        if (Array.isArray(parsed)) parsed.forEach(t => t.position?.match(/^([A-Z])/) && sides.add(t.position.match(/^([A-Z])/)[1]));
      } catch {
        album.tracklists.split('\n').forEach(t => t.match(/^([A-Z])\d+/) && sides.add(t.match(/^([A-Z])\d+/)[1]));
      }
    }
    if (sides.size === 0 && album?.sides) Object.keys(album.sides).forEach(s => sides.add(s.toUpperCase()));
    if (sides.size === 0) { sides.add('A'); sides.add('B'); }
    return Array.from(sides).sort();
  };

  const getTracksList = (): Track[] => {
    if (!album?.tracklists) return [];
    try {
      const parsed = JSON.parse(album.tracklists);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return album.tracklists.split('\n').filter(t => t.trim()).map((t, i) => {
        const match = t.trim().match(/^(\d+\.?\s*)?(.+)$/);
        return { position: String(i + 1), title: match ? match[2] : t.trim(), artist: album.artist, duration: '--:--' };
      });
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white"><div className="text-xl font-light tracking-widest animate-pulse">LOADING</div></div>;
  if (error) return <div className="min-h-screen bg-black flex items-center justify-center text-red-500">Error: {error}</div>;
  if (!album) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Album not found</div>;

  const imageUrl = album.image_url && album.image_url.toLowerCase() !== 'no' ? album.image_url : '/images/coverplaceholder.png';
  const queueTypes = eventData?.queue_types || (eventData?.queue_type ? [eventData.queue_type] : ['side']);
  const queueTypesArray = Array.isArray(queueTypes) ? queueTypes : [queueTypes];

  return (
    <div className="min-h-screen relative font-sans text-white bg-black selection:bg-blue-500 selection:text-white">
      
      {/* --- BACKGROUND LAYER --- */}
      {/* 1. The blurred image provides the "smart color" ambience. */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <Image
          src={imageUrl}
          alt=""
          fill
          className="object-cover blur-[100px] opacity-60 scale-125"
          priority
          unoptimized
        />
        {/* 2. A gradient overlay ensures text at the bottom is always readable against the color. */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/90" />
      </div>

      {/* Spacer to push content below the Fixed Main Navigation (approx 72px) */}
      <div className="h-[72px]" />

      {/* --- SECONDARY HEADER --- */}
      {/* Sticky positioning at 57px (height of main nav when scrolled) to lock them together */}
      {eventId && (
        <div className="sticky top-[57px] z-40 bg-black/90 border-b border-white/10 shadow-2xl backdrop-blur-md">
          <div className="container mx-auto px-4 py-3 flex gap-4 items-center justify-between">
            <div className="flex gap-3">
              <button onClick={goToBrowse} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all">
                ← Browse
              </button>
              <button onClick={goToQueue} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)]">
                Queue
              </button>
            </div>
            {eventData && (
               <div 
                 className="text-right hidden sm:block cursor-pointer hover:opacity-80 transition-opacity"
                 onClick={goToEvent}
               >
                 <div className="text-[10px] text-gray-400 uppercase tracking-widest">Event</div>
                 <div className="text-xs font-bold text-white">{eventData.title}</div>
               </div>
            )}
          </div>
        </div>
      )}

      {/* --- ALBUM HEADER CONTENT --- */}
      <div className="relative z-10 container mx-auto px-4 py-12 flex flex-col md:flex-row gap-10 items-start">
        {/* Cover Art - High Elevation Shadow */}
        <div className="relative shrink-0 mx-auto md:mx-0 w-[280px] md:w-[350px]">
          <div className="aspect-square relative rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden">
            <Image
              src={imageUrl}
              alt={album.title}
              fill
              className="object-cover"
              priority
              unoptimized
            />
          </div>
        </div>
        
        {/* Info */}
        <div className="flex-1 w-full pt-2">
          <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-2 drop-shadow-lg">
            {album.title}
          </h1>
          <h2 className="text-2xl md:text-3xl text-gray-200 font-medium mb-6 drop-shadow-md">
            {album.artist}
          </h2>
          
          <div className="flex flex-wrap gap-2 mb-6">
            {[album.year, album.format, album.folder].filter(Boolean).map((tag, i) => (
              <span key={i} className="px-3 py-1 bg-white/10 backdrop-blur-md rounded border border-white/10 text-xs font-bold uppercase tracking-wider text-gray-200">
                {tag}
              </span>
            ))}
            {album.is_1001 && (
              <span className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/50 text-yellow-200 rounded text-xs font-bold uppercase tracking-wider">
                ★ 1001 Albums
              </span>
            )}
          </div>

          {album.notes && (
            <div className="bg-black/30 backdrop-blur-md p-4 rounded-lg border border-white/5 mb-8 text-gray-300 text-sm leading-relaxed max-w-2xl">
              {album.notes}
            </div>
          )}

          {/* Voting / Request Section */}
          {eventId && eventData?.has_queue && (
            <div className="bg-black/40 backdrop-blur-md p-5 rounded-xl border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white">Make a Request</h3>
                {requestStatus && <span className="text-xs font-bold text-emerald-400 animate-pulse">{requestStatus}</span>}
              </div>

              {queueTypesArray.includes('side') && (
                <div className="flex flex-wrap gap-2">
                  {getAvailableSides().map((side) => (
                    <button
                      key={side}
                      onClick={() => handleAddToQueue(side)}
                      disabled={submittingRequest}
                      className="px-6 py-3 bg-white text-black hover:bg-gray-200 rounded-lg font-bold text-sm transition-transform active:scale-95 disabled:opacity-50"
                    >
                      Side {side}
                    </button>
                  ))}
                </div>
              )}

              {queueTypesArray.includes('album') && (
                <button
                  onClick={handleAddAlbumToQueue}
                  disabled={submittingRequest}
                  className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] active:scale-95"
                >
                  Request Full Album
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- TRACK LISTING --- */}
      {/* High contrast container: Black background with blur to ensure readability over the colorful background */}
      {(album?.tracklists || album?.sides) && (
        <div className="relative z-10 container mx-auto px-4 pb-24 max-w-5xl">
          <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white uppercase tracking-widest">Track Listing</h3>
              {queueTypesArray.includes('track') && (
                <span className="text-[10px] uppercase font-bold text-gray-500 bg-black/50 px-2 py-1 rounded">Tap + to add</span>
              )}
            </div>
            
            <div className="divide-y divide-white/5">
              {album.tracklists ? (
                getTracksList().map((track, i) => {
                  const blocked = album.blocked_tracks?.find(b => b.position === track.position);
                  return (
                    <div key={i} className={`group flex items-center p-4 hover:bg-white/5 transition-colors ${blocked ? 'opacity-40 grayscale' : ''}`}>
                      <span className="w-8 text-sm font-mono text-gray-500 text-center">{track.position || i + 1}</span>
                      <div className="flex-1 px-4 min-w-0">
                        <div className="text-sm font-bold text-white truncate">{track.title || track.name}</div>
                        <div className="text-xs text-gray-400 truncate">{track.artist || album.artist}</div>
                      </div>
                      <span className="text-xs font-mono text-gray-600 mr-4">{track.duration || '--:--'}</span>
                      {queueTypesArray.includes('track') && eventId && eventData?.has_queue && !blocked && (
                        <button
                          onClick={() => handleAddTrackToQueue(track)}
                          disabled={submittingRequest}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-blue-600 hover:scale-110 transition-all"
                        >
                          +
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                Object.entries(album.sides || {}).map(([side, tracks]) => (
                  <div key={side}>
                    <div className="px-4 py-2 bg-white/5 text-xs font-bold text-gray-400 uppercase tracking-widest border-y border-white/5">Side {side}</div>
                    {Array.isArray(tracks) && tracks.map((track, i) => (
                      <div key={i} className="flex items-center p-4 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                        <span className="w-8 text-sm font-mono text-gray-500 text-center">{i + 1}</span>
                        <div className="flex-1 px-4 font-medium text-gray-200">
                          {typeof track === 'string' ? track : (track.title || track.name)}
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AlbumDetailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AlbumDetailContent />
    </Suspense>
  );
}