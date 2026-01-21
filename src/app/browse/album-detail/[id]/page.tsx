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
    if (id) {
      fetchAlbum();
    }
    if (eventId) {
      fetchEventData();
    }
  }, [id, eventId, fetchAlbum, fetchEventData]);

  // Handler for side-based queue
  const handleAddToQueue = async (side: string) => {
    if (!eventId || !album) {
      setRequestStatus('Error: Missing info');
      return;
    }

    setSubmittingRequest(true);
    try {
      const { data: existingRows, error: findErr } = await supabase
        .from('requests')
        .select('id, votes')
        .eq('event_id', eventId)
        .eq('album_id', id)
        .eq('side', side)
        .order('timestamp', { ascending: true })
        .limit(1);

      if (findErr) throw findErr;

      const existing = Array.isArray(existingRows) ? existingRows[0] : null;

      if (existing) {
        const newVotes = (existing.votes ?? 0) + 1;
        const { error: updateErr } = await supabase
          .from('requests')
          .update({ votes: newVotes })
          .eq('id', existing.id);

        if (updateErr) throw updateErr;

        setRequestStatus(`Vote added! (x${newVotes})`);
      } else {
        const { error: insertErr } = await supabase.from('requests').insert([{
          album_id: id,
          artist: album.artist,
          title: album.title,
          side: side,
          event_id: eventId,
          votes: 1,
          status: 'open'
        }]);

        if (insertErr) throw insertErr;

        setRequestStatus(`Side ${side} added!`);
      }
    } catch (e) {
      console.error(e);
      setRequestStatus('Failed to add');
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Handler for track-based queue
  const handleAddTrackToQueue = async (track: Track) => {
    if (!eventId || !album) return;

    setSubmittingRequest(true);
    try {
      const { data: existingRows, error: findErr } = await supabase
        .from('requests')
        .select('id, votes')
        .eq('event_id', eventId)
        .eq('album_id', id)
        .eq('track_number', track.position || '')
        .order('timestamp', { ascending: true })
        .limit(1);

      if (findErr) throw findErr;

      const existing = Array.isArray(existingRows) ? existingRows[0] : null;

      if (existing) {
        const newVotes = (existing.votes ?? 0) + 1;
        await supabase
          .from('requests')
          .update({ votes: newVotes })
          .eq('id', existing.id);

        setRequestStatus(`Vote added! (x${newVotes})`);
      } else {
        await supabase.from('requests').insert([{
          album_id: id,
          artist: track.artist || album.artist,
          title: track.title || track.name,
          track_number: track.position || '',
          track_name: track.title || track.name,
          track_duration: track.duration || '',
          event_id: eventId,
          votes: 1,
          status: 'open',
          side: null
        }]);

        setRequestStatus(`Track added!`);
      }
    } catch (e) {
      console.error(e);
      setRequestStatus('Failed to add');
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Handler for album-based queue
  const handleAddAlbumToQueue = async () => {
    if (!eventId || !album) return;

    setSubmittingRequest(true);
    try {
      const { data: existingRows, error: findErr } = await supabase
        .from('requests')
        .select('id, votes')
        .eq('event_id', eventId)
        .eq('album_id', id)
        .is('side', null)
        .is('track_number', null)
        .order('timestamp', { ascending: true })
        .limit(1);

      if (findErr) throw findErr;

      const existing = Array.isArray(existingRows) ? existingRows[0] : null;

      if (existing) {
        const newVotes = (existing.votes ?? 0) + 1;
        await supabase
          .from('requests')
          .update({ votes: newVotes })
          .eq('id', existing.id);

        setRequestStatus(`Vote added! (x${newVotes})`);
      } else {
        await supabase.from('requests').insert([{
          album_id: id,
          artist: album.artist,
          title: album.title,
          side: null,
          track_number: null,
          track_name: null,
          event_id: eventId,
          votes: 1,
          status: 'open'
        }]);

        setRequestStatus(`Album requested!`);
      }
    } catch (e) {
      console.error(e);
      setRequestStatus('Failed to add');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const goToEvent = () => {
    if (eventId) {
      router.push(`/events/event-detail/${eventId}`);
    }
  };

  const goToBrowse = () => {
    if (eventId) {
      router.push(`/browse/browse-albums?eventId=${eventId}`);
    } else {
      router.push('/browse/browse-albums');
    }
  };

  const goToQueue = () => {
    if (eventId) {
      router.push(`/browse/browse-queue?eventId=${eventId}`);
    }
  };

  const getAvailableSides = () => {
    const sides = new Set<string>();
    
    if (album?.tracklists) {
      try {
        const parsedTracks = JSON.parse(album.tracklists);
        if (Array.isArray(parsedTracks)) {
          parsedTracks.forEach(track => {
            if (track.position) {
              const sideMatch = track.position.match(/^([A-Z])/);
              if (sideMatch) sides.add(sideMatch[1]);
            }
          });
        }
      } catch {
        const trackLines = album.tracklists.split('\n').filter(track => track.trim());
        trackLines.forEach(track => {
          const sideMatch = track.match(/^([A-Z])\d+/);
          if (sideMatch) sides.add(sideMatch[1]);
        });
      }
    }
    
    if (sides.size === 0 && album?.sides) {
      Object.keys(album.sides).forEach(side => sides.add(side.toUpperCase()));
    }
    
    if (sides.size === 0) {
      sides.add('A');
      sides.add('B');
    }
    
    return Array.from(sides).sort();
  };

  const getTracksList = (): Track[] => {
    if (!album?.tracklists) return [];

    try {
      const parsedTracks = JSON.parse(album.tracklists);
      if (Array.isArray(parsedTracks)) return parsedTracks;
      return [];
    } catch {
      return album.tracklists.split('\n').filter(track => track.trim()).map((track, index) => {
        const trackMatch = track.trim().match(/^(\d+\.?\s*)?(.+)$/);
        const trackName = trackMatch ? trackMatch[2] : track.trim();
        return {
          position: String(index + 1),
          title: trackName,
          artist: album.artist,
          duration: '--:--'
        };
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <p className="text-xl animate-pulse">Loading album...</p>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-red-400">
        <p className="text-xl">Album not found</p>
      </div>
    );
  }

  const imageUrl = album.image_url && album.image_url.toLowerCase() !== 'no' 
    ? album.image_url 
    : '/images/coverplaceholder.png';

  const queueTypes = eventData?.queue_types || (eventData?.queue_type ? [eventData.queue_type] : ['side']);
  const queueTypesArray = Array.isArray(queueTypes) ? queueTypes : [queueTypes];

  return (
    // 1. Base Container
    <div className="min-h-screen relative font-sans text-white">
      
      {/* 2. SMART BACKGROUND: Uses the album image itself, heavily blurred */}
      <div className="fixed inset-0 w-full h-full -z-50 bg-black">
        <Image
          src={imageUrl}
          alt="Ambient Background"
          fill
          className="object-cover blur-[100px] opacity-60 scale-125"
          priority
          unoptimized
        />
        {/* Dark overlay to ensure text contrast */}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Spacer to push content down past the MAIN site header */}
      <div className="h-[72px]" />

      {/* 3. SECONDARY STICKY MENU */}
      {/* Sticky at top-[60px] to sit right below the main nav bar */}
      {eventId && (
        <div className="sticky top-[60px] z-40 bg-black/80 backdrop-blur-md border-b border-white/10 shadow-xl">
          <div className="container mx-auto px-4 py-3 flex gap-4 items-center">
            <button
              onClick={goToBrowse}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95"
            >
              ← Browse
            </button>
            
            <button
              onClick={goToQueue}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95"
            >
              Queue
            </button>

            <button
              onClick={goToEvent}
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95"
            >
              Event
            </button>

            {eventData && (
              <span className="text-gray-400 text-xs ml-auto font-medium hidden md:block uppercase tracking-widest">
                Playing at: <span className="text-white">{eventData.title}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* 4. MAIN CONTENT */}
      <div className="relative z-10 container mx-auto px-4 py-12 flex flex-col md:flex-row gap-8 md:gap-12 items-start">
        {/* Album Art */}
        <div className="relative group shrink-0 mx-auto md:mx-0">
          <Image
            src={imageUrl}
            alt={`${album.artist} - ${album.title}`}
            width={350}
            height={350}
            className="rounded-lg shadow-2xl w-[280px] h-[280px] md:w-[350px] md:h-[350px] object-cover ring-1 ring-white/10"
            unoptimized
          />
        </div>
        
        {/* Album Metadata */}
        <div className="flex-1 w-full">
          <h1 className="text-4xl md:text-6xl font-black mb-2 leading-none tracking-tight drop-shadow-xl">
            {album.title}
          </h1>
          <h2 className="text-2xl md:text-3xl text-gray-200 font-bold mb-6 drop-shadow-lg">{album.artist}</h2>
          
          <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-widest mb-6 text-gray-400">
            {album.year && <span className="bg-black/40 px-3 py-1 rounded border border-white/10">{album.year}</span>}
            {album.format && <span className="bg-black/40 px-3 py-1 rounded border border-white/10">{album.format}</span>}
            {album.folder && <span className="bg-black/40 px-3 py-1 rounded border border-white/10">{album.folder}</span>}
            {album.is_1001 && (
              <span className="bg-white text-black px-3 py-1 rounded font-black border border-white">1001 Albums</span>
            )}
          </div>
          
          {album.media_condition && (
            <div className="mb-4 text-sm text-gray-300">
              <span className="opacity-70 mr-2">Condition:</span> 
              <span className="font-bold text-white bg-white/10 px-2 py-0.5 rounded">{album.media_condition}</span>
            </div>
          )}
          
          {album.notes && (
            <div className="p-4 bg-black/40 rounded-xl backdrop-blur-sm border border-white/10 mb-8 max-w-2xl">
              <p className="text-gray-200 text-sm leading-relaxed">{album.notes}</p>
            </div>
          )}

          {/* Voting / Queue Buttons */}
          {eventId && eventData?.has_queue && (
            <div className="pt-6 border-t border-white/10">
              {queueTypesArray.includes('side') && (
                <div className="mb-6">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3">Request Side</h3>
                  <div className="flex flex-wrap gap-3">
                    {getAvailableSides().map((side) => (
                      <button
                        key={side}
                        onClick={() => handleAddToQueue(side)}
                        disabled={submittingRequest}
                        className="bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-lg px-6 py-3 font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50"
                      >
                        Side {side}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {queueTypesArray.includes('album') && (
                <button
                  onClick={handleAddAlbumToQueue}
                  disabled={submittingRequest}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl px-8 py-4 font-bold shadow-lg shadow-blue-900/30 transition-all active:scale-95"
                >
                  Request Full Album
                </button>
              )}
              
              {requestStatus && (
                <div className="mt-4 inline-block px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 rounded-lg text-sm font-bold animate-pulse">
                  {requestStatus}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5. TRACK LISTING with Black Background */}
      {(album?.tracklists || album?.sides) && (
        <div className="relative z-10 container mx-auto px-4 pb-20 max-w-5xl">
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/10 bg-white/5">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                Track Listing
              </h3>
            </div>
            
            <div className="p-0">
              {album.tracklists ? (
                // Single list
                getTracksList().map((track, i) => {
                  const blocked = album.blocked_tracks?.find(b => b.position === track.position);
                  return (
                    <div key={i} className={`grid grid-cols-[3rem_1fr_auto] md:grid-cols-[3rem_1fr_1fr_4rem_3rem] items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors ${blocked ? 'opacity-40 grayscale' : ''}`}>
                      <span className="text-gray-500 font-mono text-sm text-center">{track.position || i + 1}</span>
                      <div className="font-bold text-gray-200 pr-4">{track.title || track.name}</div>
                      <div className="hidden md:block text-sm text-gray-400 truncate pr-4">{track.artist || album.artist}</div>
                      <span className="hidden md:block text-xs font-mono text-gray-600 text-right">{track.duration || '--:--'}</span>
                      
                      {queueTypesArray.includes('track') && eventId && eventData?.has_queue && !blocked && (
                        <div className="text-right">
                          <button
                            onClick={() => handleAddTrackToQueue(track)}
                            disabled={submittingRequest}
                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-blue-600 text-white flex items-center justify-center transition-colors"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                // Sides object
                Object.entries(album.sides || {}).map(([side, tracks]) => (
                  <div key={side} className="mb-0 border-b border-white/5 last:border-0">
                    <div className="bg-white/5 px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Side {side}
                    </div>
                    {Array.isArray(tracks) && tracks.map((track, i) => (
                      <div key={i} className="flex items-center p-4 hover:bg-white/5 transition-colors border-t border-white/5 first:border-0">
                        <span className="w-12 text-center text-gray-600 font-mono text-xs">{i + 1}</span>
                        <div className="flex-1 font-medium text-gray-300">
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