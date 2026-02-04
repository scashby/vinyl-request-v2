// src/app/browse/album-detail/[id]/page.tsx
"use client";

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from 'src/lib/supabaseClient';
import type { Database } from 'src/types/supabase';

// Updated to match new DB Schema
interface DbTrack {
  id?: number;
  recording_id?: number;
  position: string | number;
  title: string;
  duration?: string;
  duration_seconds?: number;
  isrc?: string;
  bpm?: number;
  side?: string;
  artist?: string;
  type?: 'track' | 'header';
}

interface Album {
  id: number;
  inventory_id?: number;
  recording_id?: number;
  title: string;
  artist: string;
  image_url: string;
  year?: string | number;
  format?: string;
  
  // Phase 4 Fixes: New Columns
  location?: string;        // Was 'folder'
  personal_notes?: string;  // Was 'notes'
  release_notes?: string;   // New field
  media_condition?: string;
  
  // Phase 4 Fixes: JSON Data source
  tracks?: DbTrack[];       // Was 'tracklists' string
  
  blocked_tracks?: { position: string; reason: string }[];
}

type ReleaseRow = Database['public']['Tables']['releases']['Row'];
type RecordingRow = Database['public']['Tables']['recordings']['Row'];
type ReleaseTrackRecording = Pick<
  RecordingRow,
  'id' | 'title' | 'duration_seconds' | 'isrc' | 'bpm'
>;

type ReleaseTrackQueryRow = {
  id: number;
  position: string;
  side: string | null;
  recording_id: number | null;
  title_override: string | null;
  recording?: ReleaseTrackRecording | null;
};

const toSingle = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;


interface EventData {
  id: number;
  title: string;
  date: string;
  has_queue: boolean;
  queue_types?: string[];
}

function AlbumDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params?.id as string;
  const eventId = searchParams.get('eventId');
  const albumIdNum = Number(id);
  const eventIdNum = eventId ? Number(eventId) : null;

  const [album, setAlbum] = useState<Album | null>(null);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const buildFormatLabel = (release?: Partial<ReleaseRow> | null) => {
    if (!release) return '';
    const parts = [release.media_type, ...(release.format_details ?? [])].filter(Boolean);
    const base = parts.join(', ');
    const qty = release.qty ?? 1;
    if (!base) return '';
    return qty > 1 ? `${qty}x${base}` : base;
  };

  const formatDuration = (seconds?: number | null) => {
    if (!seconds && seconds !== 0) return '';
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.floor(seconds % 60);
    return `${minutes}:${remaining.toString().padStart(2, '0')}`;
  };

  const fetchAlbum = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('inventory')
        .select(
          `id,
           personal_notes,
           media_condition,
           location,
           release:releases (
             id,
             media_type,
             release_year,
             notes,
             qty,
             format_details,
             master:masters (
               id,
               title,
               cover_image_url,
               artist:artists (id, name)
             ),
             release_tracks:release_tracks (
               id,
               position,
               side,
               recording_id,
               title_override,
               recording:recordings (
                 id,
                 title,
                 duration_seconds,
                 isrc,
                 bpm
               )
             )
           )`
        )
        .eq('id', albumIdNum)
        .single();

      if (error) {
        setError(error.message);
        return;
      }
      if (!data) {
        setError('Album not found');
        return;
      }

      const release = toSingle(data.release);
      const master = toSingle(release?.master);
      const artist = toSingle(master?.artist);
      const imageUrl = master?.cover_image_url || '';

      const tracks = (release?.release_tracks || []).map((track: ReleaseTrackQueryRow) => ({
        id: track.id,
        recording_id: track.recording_id ?? track.recording?.id,
        position: track.position,
        title: track.title_override || track.recording?.title || '',
        duration_seconds: track.recording?.duration_seconds ?? null,
        duration: formatDuration(track.recording?.duration_seconds ?? null),
        isrc: track.recording?.isrc ?? undefined,
        bpm: track.recording?.bpm ?? undefined,
        side: track.side,
        type: 'track',
      }));

      setAlbum({
        id: data.id,
        inventory_id: data.id,
        title: master?.title || '',
        artist: artist?.name || '',
        image_url: imageUrl,
        year: release?.release_year ? String(release.release_year) : '',
        format: buildFormatLabel(release),
        location: data.location,
        personal_notes: data.personal_notes,
        release_notes: release?.notes,
        media_condition: data.media_condition,
        tracks,
      } as Album);
    } catch {
      setError('Failed to load album');
    } finally {
      setLoading(false);
    }
  }, [albumIdNum]);

  const fetchEventData = useCallback(async () => {
    if (!eventIdNum || Number.isNaN(eventIdNum)) return;
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventIdNum)
        .single();
      if (!error && data) {
        setEventData(data as EventData);
      }
    } catch (error) {
      console.error('Error fetching event data:', error);
    }
  }, [eventIdNum]);

  useEffect(() => {
    if (id) fetchAlbum();
    if (eventIdNum) fetchEventData();
  }, [id, eventIdNum, fetchAlbum, fetchEventData]);

  const handleAddToQueue = async (side: string) => {
    if (!eventId || !album) return;
    setSubmittingRequest(true);
    try {
      if (!album.inventory_id) {
        throw new Error('Missing inventory ID for request.');
      }

      const { data: existing, error } = await supabase
        .from('requests_v3')
        .select('id, votes')
        .eq('event_id', eventIdNum)
        .eq('inventory_id', album.inventory_id)
        .is('recording_id', null)
        .maybeSingle();

      if (error) throw error;

      if (existing) {
        await supabase.from('requests_v3').update({ votes: (existing.votes || 1) + 1 }).eq('id', existing.id);
        setRequestStatus(`Upvoted Side ${side}`);
      } else {
        await supabase.from('requests_v3').insert([{
          event_id: eventIdNum,
          inventory_id: album.inventory_id,
          recording_id: null,
          votes: 1,
          status: 'open',
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

  const handleAddTrackToQueue = async (track: DbTrack) => {
    if (!eventId || !album) return;
    setSubmittingRequest(true);
    try {
      if (album.inventory_id && track.recording_id) {
        const { data: existing, error } = await supabase
          .from('requests_v3')
          .select('id, votes')
          .eq('event_id', eventIdNum)
          .eq('inventory_id', album.inventory_id)
          .eq('recording_id', track.recording_id)
          .maybeSingle();

        if (error) throw error;

        if (existing) {
          await supabase.from('requests_v3').update({ votes: (existing.votes || 1) + 1 }).eq('id', existing.id);
          setRequestStatus(`Upvoted: ${track.title}`);
        } else {
          await supabase.from('requests_v3').insert([{
            event_id: eventIdNum,
            inventory_id: album.inventory_id,
            recording_id: track.recording_id,
            votes: 1,
            status: 'open',
          }]);
          setRequestStatus(`Requested: ${track.title}`);
        }
      } else {
        throw new Error('Missing inventory or recording ID for track request.');
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
      if (!album.inventory_id) {
        throw new Error('Missing inventory ID for request.');
      }

      const { data: existing, error } = await supabase
        .from('requests_v3')
        .select('id, votes')
        .eq('event_id', eventIdNum)
        .eq('inventory_id', album.inventory_id)
        .is('recording_id', null)
        .maybeSingle();

      if (error) throw error;

      if (existing) {
        await supabase.from('requests_v3').update({ votes: (existing.votes || 1) + 1 }).eq('id', existing.id);
        setRequestStatus(`Upvoted Album`);
      } else {
        await supabase.from('requests_v3').insert([{
          event_id: eventIdNum,
          inventory_id: album.inventory_id,
          recording_id: null,
          votes: 1,
          status: 'open',
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

  // Fixed: Derive sides from release_tracks.side
  const getAvailableSides = () => {
    const sides = new Set<string>();
    if (album?.tracks && Array.isArray(album.tracks)) {
      album.tracks.forEach((track) => {
        if (track.side) {
          sides.add(track.side);
        }
      });
    }
    
    // Default fallback if no side data found
    if (sides.size === 0) { 
        sides.add('A'); 
        sides.add('B'); 
    }
    return Array.from(sides).sort();
  };

  const hasTracks = album?.tracks && Array.isArray(album.tracks) && album.tracks.length > 0;

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white"><div className="text-xl font-light tracking-widest animate-pulse">LOADING</div></div>;
  if (error) return <div className="min-h-screen bg-black flex items-center justify-center text-red-500">Error: {error}</div>;
  if (!album) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Album not found</div>;

  const imageUrl = album.image_url && album.image_url.toLowerCase() !== 'no' ? album.image_url : '/images/coverplaceholder.png';
  const queueTypes = eventData?.queue_types || ['side'];
  const queueTypesArray = Array.isArray(queueTypes) ? queueTypes : [queueTypes];

  return (
    <div className="min-h-screen relative font-sans text-white bg-black selection:bg-blue-500 selection:text-white">
      
      {/* --- BACKGROUND LAYER --- */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <Image
          src={imageUrl}
          alt=""
          fill
          className="object-cover blur-[100px] opacity-60 scale-125"
          priority
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/90" />
      </div>

      <div className="h-[72px]" />

      {/* --- SECONDARY HEADER --- */}
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
        {/* Cover Art */}
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
            {/* Fixed: Use 'location' instead of 'folder' */}
            {[album.year, album.format, album.location].filter(Boolean).map((tag, i) => (
              <span key={i} className="px-3 py-1 bg-white/10 backdrop-blur-md rounded border border-white/10 text-xs font-bold uppercase tracking-wider text-gray-200">
                {tag}
              </span>
            ))}
          </div>

          {/* Fixed: Use 'personal_notes' */}
          {(album.personal_notes || album.release_notes) && (
            <div className="bg-black/30 backdrop-blur-md p-4 rounded-lg border border-white/5 mb-8 text-gray-300 text-sm leading-relaxed max-w-2xl">
              {album.personal_notes && <p className="mb-2">{album.personal_notes}</p>}
              {album.release_notes && <p className="text-gray-400 italic">{album.release_notes}</p>}
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
      {hasTracks && (
        <div className="relative z-10 container mx-auto px-4 pb-24 max-w-5xl">
          <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white uppercase tracking-widest">Track Listing</h3>
              {queueTypesArray.includes('track') && (
                <span className="text-[10px] uppercase font-bold text-gray-500 bg-black/50 px-2 py-1 rounded">Tap + to add</span>
              )}
            </div>
            
            <div className="divide-y divide-white/5">
              {/* Fixed: Map over structured tracks array */}
              {album.tracks!.map((track, i) => {
                const blocked = album.blocked_tracks?.find(b => b.position === String(track.position));
                
                // Optional: Render Side headers if side changes
                const prevTrack = i > 0 ? album.tracks![i - 1] : null;
                const showSideHeader = track.side && (!prevTrack || prevTrack.side !== track.side);

                return (
                  <div key={i}>
                    {showSideHeader && (
                        <div className="px-4 py-2 bg-white/5 text-xs font-bold text-gray-400 uppercase tracking-widest border-y border-white/5">
                            Side {track.side}
                        </div>
                    )}
                    <div className={`group flex items-center p-4 hover:bg-white/5 transition-colors ${blocked ? 'opacity-40 grayscale' : ''}`}>
                      <span className="w-10 text-sm font-mono text-gray-500 text-center">{track.position}</span>
                      <div className="flex-1 px-4 min-w-0">
                        <div className="text-sm font-bold text-white truncate">{track.title}</div>
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
                  </div>
                );
              })}
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
