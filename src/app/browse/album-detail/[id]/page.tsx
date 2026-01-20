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
    if (!eventId) {
      setRequestStatus('No event selected');
      return;
    }
    if (!album) {
      setRequestStatus('Album not loaded');
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

        setRequestStatus(`Added vote: ${album.title} — Side ${side}. Votes: x${newVotes}`);
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

        setRequestStatus(`Added ${album.title} — Side ${side} to queue! Votes: x1`);
      }
    } catch (e) {
      console.error(e);
      setRequestStatus('Failed to add to queue');
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Handler for track-based queue
  const handleAddTrackToQueue = async (track: Track) => {
    if (!eventId) {
      setRequestStatus('No event selected');
      return;
    }
    if (!album) {
      setRequestStatus('Album not loaded');
      return;
    }

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
        const { error: updateErr } = await supabase
          .from('requests')
          .update({ votes: newVotes })
          .eq('id', existing.id);

        if (updateErr) throw updateErr;

        setRequestStatus(`Added vote: ${track.title || track.name}. Votes: x${newVotes}`);
      } else {
        const { error: insertErr } = await supabase.from('requests').insert([{
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

        if (insertErr) throw insertErr;

        setRequestStatus(`Added "${track.title || track.name}" to queue! Votes: x1`);
      }
    } catch (e) {
      console.error(e);
      setRequestStatus('Failed to add to queue');
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Handler for album-based queue
  const handleAddAlbumToQueue = async () => {
    if (!eventId) {
      setRequestStatus('No event selected');
      return;
    }
    if (!album) {
      setRequestStatus('Album not loaded');
      return;
    }

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
        const { error: updateErr } = await supabase
          .from('requests')
          .update({ votes: newVotes })
          .eq('id', existing.id);

        if (updateErr) throw updateErr;

        setRequestStatus(`Added vote for full album: ${album.title}. Votes: x${newVotes}`);
      } else {
        const { error: insertErr } = await supabase.from('requests').insert([{
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

        if (insertErr) throw insertErr;

        setRequestStatus(`Added full album "${album.title}" to queue! Votes: x1`);
      }
    } catch (e) {
      console.error(e);
      setRequestStatus('Failed to add to queue');
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
              if (sideMatch) {
                sides.add(sideMatch[1]);
              }
            }
          });
        }
      } catch {
        const trackLines = album.tracklists.split('\n').filter(track => track.trim());
        trackLines.forEach(track => {
          const sideMatch = track.match(/^([A-Z])\d+/);
          if (sideMatch) {
            sides.add(sideMatch[1]);
          }
        });
      }
    }
    
    if (sides.size === 0 && album?.sides) {
      Object.keys(album.sides).forEach(side => {
        sides.add(side.toUpperCase());
      });
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
      
      if (Array.isArray(parsedTracks)) {
        return parsedTracks;
      }
      return [];
    } catch {
      // Parse plain text format
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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-red-400">
        <p className="text-xl">Error: {error}</p>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <p className="text-xl">Album not found</p>
      </div>
    );
  }

  const imageUrl = album.image_url && album.image_url.toLowerCase() !== 'no' 
    ? album.image_url 
    : '/images/coverplaceholder.png';

  // Handle both old queue_type (singular) and new queue_types (array)
  const queueTypes = eventData?.queue_types || (eventData?.queue_type ? [eventData.queue_type] : ['side']);
  const queueTypesArray = Array.isArray(queueTypes) ? queueTypes : [queueTypes];

  return (
    // FIX: Added pt-[120px] to push content down below the fixed header
    <div className="min-h-screen bg-gray-900 text-white relative overflow-hidden font-sans pt-[120px]">
      {/* Background Blur */}
      <div 
        className="absolute inset-0 bg-cover bg-center blur-3xl opacity-30 scale-110 pointer-events-none"
        style={{ backgroundImage: `url(${imageUrl})` }}
      />

      {/* Top Navigation Bar */}
      {eventId && (
        <div className="relative z-20 bg-black/80 backdrop-blur-md border-b border-white/10 p-3 pl-16 flex gap-4 items-center flex-wrap shadow-lg">
          <button
            onClick={goToBrowse}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-95"
          >
            ← Browse Collection
          </button>
          
          <button
            onClick={goToQueue}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-95"
          >
            🎵 View Queue
          </button>

          <button
            onClick={goToEvent}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-95"
          >
            📅 Event Details
          </button>

          {eventData && (
            <span className="text-gray-300 text-sm ml-auto font-medium hidden md:block">
              Event: <span className="text-white">{eventData.title}</span>
            </span>
          )}
        </div>
      )}

      {/* Album Header */}
      <div className="relative z-10 container mx-auto px-4 py-12 flex flex-col md:flex-row gap-8 md:gap-12 items-start">
        <div className="relative group shrink-0 mx-auto md:mx-0">
          <Image
            src={imageUrl}
            alt={`${album.artist} - ${album.title}`}
            width={300}
            height={300}
            className="rounded-xl shadow-2xl w-[250px] h-[250px] md:w-[350px] md:h-[350px] object-cover ring-1 ring-white/20"
            unoptimized
          />
        </div>
        
        <div className="flex-1 flex flex-col justify-center w-full">
          <h1 className="text-4xl md:text-6xl font-black mb-2 leading-tight tracking-tight drop-shadow-lg">
            {album.title}
            {album.is_1001 ? (
              <span 
                title="On the 1001 Albums list" 
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold leading-none border border-white/30 bg-black/60 text-white ml-3 align-middle -translate-y-2"
              >
                1001
              </span>
            ) : null}
          </h1>
          <h2 className="text-2xl md:text-3xl text-gray-300 font-bold mb-4 drop-shadow-md">{album.artist}</h2>
          
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-400 font-medium uppercase tracking-widest mb-6">
            {album.year && <span>Year: <span className="text-gray-200">{album.year}</span></span>}
            {album.year && album.format && <span className="text-gray-600">•</span>}
            {album.format && <span>Format: <span className="text-gray-200">{album.format}</span></span>}
            {album.format && album.folder && <span className="text-gray-600">•</span>}
            {album.folder && <span>Category: <span className="text-gray-200">{album.folder}</span></span>}
          </div>
          
          {album.media_condition && (
            <div className="inline-block bg-white/5 border border-white/10 rounded px-3 py-1 text-sm text-gray-300 mb-4 self-start">
              Condition: <span className="text-white font-semibold">{album.media_condition}</span>
            </div>
          )}
          
          {album.notes && (
            <div className="p-4 bg-white/5 rounded-xl backdrop-blur-md border border-white/10 max-w-2xl">
              <strong className="block text-gray-400 text-xs uppercase tracking-wider mb-1">Notes</strong>
              <p className="text-gray-200 leading-relaxed">{album.notes}</p>
            </div>
          )}

          {/* Queue Actions - Adaptive based on queue types */}
          {eventId && eventData?.has_queue && (
            <div className="mt-8 pt-8 border-t border-white/10">
              {queueTypesArray.includes('side') && (
                <>
                  <h3 className="text-white mb-4 text-lg font-bold flex items-center gap-2">
                    <span className="text-blue-400">●</span> Add Side to Queue
                  </h3>
                  <div className="flex flex-wrap gap-3 mb-6">
                    {getAvailableSides().map((side, index) => (
                      <button
                        key={side}
                        onClick={() => handleAddToQueue(side)}
                        disabled={submittingRequest}
                        className={`px-6 py-3 rounded-lg font-bold text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
                          ${index % 4 === 0 ? 'bg-blue-600 hover:bg-blue-500' : 
                            index % 4 === 1 ? 'bg-emerald-600 hover:bg-emerald-500' : 
                            index % 4 === 2 ? 'bg-amber-600 hover:bg-amber-500' : 'bg-red-600 hover:bg-red-500'}`}
                      >
                        Side {side}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {queueTypesArray.includes('album') && (
                <>
                  <h3 className="text-white mb-4 text-lg font-bold flex items-center gap-2">
                    <span className="text-purple-400">●</span> Add Album to Queue
                  </h3>
                  <button
                    onClick={handleAddAlbumToQueue}
                    disabled={submittingRequest}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl px-8 py-4 font-bold text-lg shadow-xl shadow-purple-900/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mb-6 flex items-center gap-3"
                  >
                    💿 Request Full Album
                  </button>
                </>
              )}
              
              {requestStatus && (
                <div className={`inline-block px-4 py-2 rounded-lg font-bold text-sm ${
                  requestStatus.includes('Error') || requestStatus.includes('Failed') 
                    ? 'bg-red-500/20 text-red-200 border border-red-500/30' 
                    : 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                }`}>
                  {requestStatus}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Track Listings */}
      {album?.tracklists && (
        <div className="relative z-10 container mx-auto px-4 pb-24 max-w-4xl">
          <h3 className="text-2xl font-bold mb-6 text-white flex items-center gap-3">
            Track Listing
            {queueTypesArray.includes('track') && eventId && eventData?.has_queue && (
              <span className="text-sm font-normal text-gray-400 bg-white/5 px-2 py-1 rounded">
                Click + to add individual tracks
              </span>
            )}
          </h3>
          
          <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-4 px-4 py-3 border-b border-white/20 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            <div className="text-center w-8">#</div>
            <div>Title</div>
            <div className="hidden md:block">Artist</div>
            <div className="text-right">Time</div>
            {queueTypesArray.includes('track') && eventId && eventData?.has_queue && (
              <div className="text-center w-16">Add</div>
            )}
          </div>
          
          <div className="space-y-1">
            {(() => {
              const tracks = getTracksList();
              const blockedTracks = album.blocked_tracks || [];
              
              return tracks.map((track, index) => {
                const blockedInfo = blockedTracks.find(bt => bt.position === track.position);
                const isBlocked = !!blockedInfo;
                
                return (
                  <div 
                    key={index} 
                    className={`grid grid-cols-[auto_1fr_1fr_auto_auto] gap-4 px-4 py-3 rounded-lg items-center group transition-colors ${
                      isBlocked ? 'opacity-50 grayscale' : 'hover:bg-white/5 bg-white/[0.02]'
                    }`}
                  >
                    <div className="text-center w-8 text-gray-500 font-mono text-sm flex justify-center items-center gap-1">
                      {track.position || index + 1}
                      {isBlocked && (
                        <span 
                          title={blockedInfo.reason || 'Track blocked'}
                          className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center cursor-help"
                        >
                          !
                        </span>
                      )}
                    </div>
                    <div className="font-medium text-white group-hover:text-blue-400 transition-colors">
                      {track.title || track.name || 'Unknown Track'}
                      {isBlocked && (
                        <span className="ml-2 text-xs text-red-300 italic">
                          ({blockedInfo.reason || 'Blocked'})
                        </span>
                      )}
                    </div>
                    <div className="hidden md:block text-gray-400 text-sm">
                      {track.artist || album.artist}
                    </div>
                    <div className="text-right text-gray-500 text-sm font-mono">
                      {track.duration || '--:--'}
                    </div>
                    {queueTypesArray.includes('track') && eventId && eventData?.has_queue && (
                      <div className="text-center w-16 flex justify-center">
                        <button
                          onClick={() => handleAddTrackToQueue(track)}
                          disabled={submittingRequest || isBlocked}
                          className={`w-8 h-8 rounded flex items-center justify-center transition-all ${
                            isBlocked 
                              ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md active:scale-95'
                          }`}
                          title={isBlocked ? blockedInfo.reason || 'Track blocked' : 'Add to queue'}
                        >
                          {isBlocked ? '✕' : '+'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {!album?.tracklists && album?.sides && (
        <div className="relative z-10 container mx-auto px-4 pb-24 max-w-4xl">
          <h3 className="text-2xl font-bold mb-8 text-white">Album Sides</h3>
          
          {Object.entries(album.sides).map(([sideName, tracks]) => {
            const blockedTracks = album.blocked_tracks || [];
            
            return (
              <div key={sideName} className="mb-8">
                <div className="flex items-center gap-4 mb-4">
                  <h4 className="text-xl font-bold text-gray-200">Side {sideName}</h4>
                  <div className="h-px flex-1 bg-white/10"></div>
                </div>
                
                <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-4 px-4 py-2 text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                  <div className="w-8 text-center">#</div>
                  <div>Title</div>
                  <div>Artist</div>
                  <div className="text-right">Time</div>
                </div>
                
                <div className="space-y-1">
                  {Array.isArray(tracks) ? tracks.map((track, index) => {
                    const trackPosition = `${sideName}${index + 1}`;
                    const blockedInfo = blockedTracks.find(bt => bt.position === trackPosition);
                    const isBlocked = !!blockedInfo;
                    
                    return (
                      <div 
                        key={index} 
                        className={`grid grid-cols-[auto_1fr_1fr_auto] gap-4 px-4 py-3 rounded-lg items-center ${
                          isBlocked ? 'opacity-50' : 'bg-white/[0.02]'
                        }`}
                      >
                        <div className="w-8 text-center text-gray-500 font-mono text-sm flex justify-center gap-1">
                          {index + 1}
                          {isBlocked && <span className="text-red-500 text-xs">!</span>}
                        </div>
                        <div className="font-medium text-white">
                          {typeof track === 'string' ? track : (track as Track).title || (track as Track).name || 'Unknown Track'}
                        </div>
                        <div className="text-gray-400 text-sm">
                          {typeof track === 'object' && (track as Track).artist ? (track as Track).artist : album.artist}
                        </div>
                        <div className="text-right text-gray-500 text-sm font-mono">
                          {typeof track === 'object' && (track as Track).duration ? (track as Track).duration : '--:--'}
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-4 px-4 py-3 rounded-lg items-center bg-white/[0.02]">
                      <div className="w-8 text-center text-gray-500">1</div>
                      <div className="font-medium text-white italic">
                        {typeof tracks === 'string' ? tracks : 'No track information'}
                      </div>
                      <div className="text-gray-400">{album.artist}</div>
                      <div className="text-right text-gray-500">--:--</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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