// src/app/browse/album-detail/[id]/page.tsx
"use client";

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from 'src/lib/supabaseClient';
import { addOrVoteRequest } from 'src/lib/addOrVoteRequest';

interface DbTrack {
  position: string | number;
  title: string;
  duration?: string;
  side?: string;
  recordingId?: number | null;
}

interface Album {
  id: number;
  releaseId?: number;
  title: string;
  artist: string;
  image_url: string;
  year?: string;
  mediaType?: string;
  formatDetails?: string[];
  
  // Phase 4 Fixes: New Columns
  location?: string;        // Was 'folder'
  personal_notes?: string;  // Was 'notes'
  release_notes?: string;   // New field
  media_condition?: string;
  
  // Phase 4 Fixes: JSON Data source
  tracks?: DbTrack[];       // Was 'tracklists' string
  
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
        .from('inventory')
        .select(`
          id,
          location,
          media_condition,
          personal_notes,
          release:release_id (
            id,
            media_type,
            format_details,
            notes,
            release_year,
            release_date,
            master:master_id (
              id,
              title,
              cover_image_url,
              original_release_year,
              artist:main_artist_id (
                id,
                name
              )
            ),
            release_tracks (
              id,
              position,
              side,
              title_override,
              recording:recording_id (
                id,
                title,
                duration_seconds
              )
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        setError(error.message);
      } else {
        const release = data.release;
        const master = release?.master;
        const artistName = master?.artist?.name || 'Unknown Artist';
        const releaseYear = master?.original_release_year
          ?? release?.release_year
          ?? (release?.release_date ? new Date(release.release_date).getFullYear() : '');
        const tracks: DbTrack[] = (release?.release_tracks || []).map((track) => {
          const durationSeconds = track.recording?.duration_seconds;
          const duration = durationSeconds
            ? `${Math.floor(durationSeconds / 60).toString().padStart(2, '0')}:${(durationSeconds % 60).toString().padStart(2, '0')}`
            : undefined;
          return {
            position: track.position,
            title: track.title_override || track.recording?.title || 'Untitled',
            duration,
            side: track.side || undefined,
            recordingId: track.recording?.id ?? null,
          };
        });

        setAlbum({
          id: data.id,
          releaseId: release?.id ?? undefined,
          title: master?.title || 'Untitled',
          artist: artistName,
          image_url: master?.cover_image_url || '',
          year: releaseYear ? String(releaseYear) : '',
          mediaType: release?.media_type || undefined,
          formatDetails: release?.format_details || [],
          location: data.location || undefined,
          personal_notes: data.personal_notes || undefined,
          release_notes: release?.notes || undefined,
          media_condition: data.media_condition || undefined,
          tracks,
        });
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
      const updated = await addOrVoteRequest({
        eventId,
        inventoryId: album.id,
        recordingId: null,
        artistName: album.artist,
        trackTitle: `Side ${side}`,
        status: 'pending',
      });
      setRequestStatus(`Requested Side ${side} (Votes: x${updated?.votes ?? 1})`);
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
      const updated = await addOrVoteRequest({
        eventId,
        inventoryId: album.id,
        recordingId: track.recordingId ?? null,
        artistName: album.artist,
        trackTitle: track.title,
        status: 'pending',
      });
      setRequestStatus(`Requested: ${track.title} (Votes: x${updated?.votes ?? 1})`);
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
      const updated = await addOrVoteRequest({
        eventId,
        inventoryId: album.id,
        recordingId: null,
        artistName: album.artist,
        trackTitle: null,
        status: 'pending',
      });
      setRequestStatus(`Requested Album (Votes: x${updated?.votes ?? 1})`);
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

  // Fixed: Derive sides from 'tracks' JSON array
  const getAvailableSides = () => {
    const sides = new Set<string>();
    if (album?.tracks && Array.isArray(album.tracks)) {
        album.tracks.forEach(t => {
            if (t.side) {
                sides.add(t.side);
            } else if (typeof t.position === 'string' && t.position.match(/^[A-Z]/)) {
                // Fallback: extract 'A' from 'A1' if side property is missing
                sides.add(t.position.charAt(0));
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
  const formatLabel = [album.mediaType, ...(album.formatDetails || [])].filter(Boolean).join(', ');
  const queueTypes = eventData?.queue_types || (eventData?.queue_type ? [eventData.queue_type] : ['side']);
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
            {[album.year, formatLabel, album.location].filter(Boolean).map((tag, i) => (
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
                        <div className="text-xs text-gray-400 truncate">{album.artist}</div>
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
