// components/QueueSection.tsx

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from 'src/lib/supabaseClient';

interface InventoryRecord {
  id: number;
  release: {
    id: number;
    master: {
      title: string;
      cover_image_url: string | null;
      artist: {
        name: string;
      } | null;
    } | null;
  } | null;
}

interface RequestEntry {
  id: string;
  inventory_id: number | null;
  recording_id: number | null;
  artist_name: string | null;
  track_title: string | null;
  votes: number;
  event_id: string;
  created_at: string;
  inventory: InventoryRecord | null;
  recording: {
    id: number;
    title: string | null;
    duration_seconds: number | null;
  } | null;
}

interface QueueItem {
  id: string | number;
  index: number;
  side: string | null;
  track_number: string | null;
  track_name: string | null;
  track_duration: string | null;
  votes: number;
  inventory: InventoryRecord;
  artistName: string;
  queue_type: string;
}

interface QueueSectionProps {
  eventId: string;
}

function getVoteKey(eventId: string, reqId: string | number) {
  return `queue-vote-${eventId}-${reqId}`;
}

export default function QueueSection({ eventId }: QueueSectionProps) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueType, setQueueType] = useState<string>('side');
  const [voting, setVoting] = useState<{ [key: string]: boolean }>({});
  const router = useRouter();

  useEffect(() => {
    const fetchQueue = async () => {
      // Fetch event to get queue type
      const { data: eventData } = await supabase
        .from("events")
        .select("queue_type, queue_types")
        .eq("id", eventId)
        .single();

      const queueTypes = eventData?.queue_types || (eventData?.queue_type ? [eventData.queue_type] : ['side']);
      const currentQueueType = Array.isArray(queueTypes) ? queueTypes[0] : queueTypes;
      setQueueType(currentQueueType || 'side');

      const { data: requests, error } = await supabase
        .from("requests_v3")
        .select(`
          id,
          event_id,
          inventory_id,
          recording_id,
          artist_name,
          track_title,
          votes,
          created_at,
          inventory:inventory_id (
            id,
            release:release_id (
              id,
              master:master_id (
                title,
                cover_image_url,
                artist:main_artist_id (
                  name
                )
              )
            )
          ),
          recording:recording_id (
            id,
            title,
            duration_seconds
          )
        `)
        .eq("event_id", eventId)
        .order("id", { ascending: true });

      const typedRequests = (requests || []) as unknown as RequestEntry[];

      if (error || !typedRequests) {
        console.error("Error fetching requests:", error);
        setQueue([]);
        return;
      }

      const releaseIds = Array.from(new Set(
        typedRequests
          .map((req) => req.inventory?.release?.id)
          .filter(Boolean)
      )) as number[];

      const releaseTrackMap = new Map<string, string>();
      if (releaseIds.length) {
        const { data: releaseTracks } = await supabase
          .from("release_tracks")
          .select("release_id, recording_id, position")
          .in("release_id", releaseIds);
        (releaseTracks || []).forEach((track) => {
          if (track.release_id && track.recording_id) {
            releaseTrackMap.set(`${track.release_id}-${track.recording_id}`, track.position);
          }
        });
      }

      const mapped: QueueItem[] = typedRequests.map((req, i: number) => {
        const inventoryFallback: InventoryRecord = req.inventory || {
          id: req.inventory_id || 0,
          release: null,
        };
        const master = inventoryFallback.release?.master;
        const artistName = master?.artist?.name || req.artist_name || '';
        const trackTitle = req.track_title || req.recording?.title || null;
        const trackDuration = req.recording?.duration_seconds
          ? `${Math.floor(req.recording.duration_seconds / 60).toString().padStart(2, "0")}:${(req.recording.duration_seconds % 60).toString().padStart(2, "0")}`
          : null;
        const releaseId = inventoryFallback.release?.id;
        const trackNumber = req.recording_id && releaseId
          ? releaseTrackMap.get(`${releaseId}-${req.recording_id}`) || null
          : null;
        const side = trackTitle?.toLowerCase().startsWith("side ")
          ? trackTitle.slice(5).trim()
          : null;

        return {
          id: req.id,
          index: i + 1,
          side,
          track_number: trackNumber,
          track_name: trackTitle,
          track_duration: trackDuration,
          votes: req.votes || 1,
          queue_type: currentQueueType,
          inventory: inventoryFallback,
          artistName,
        };
      });

      setQueue(mapped);
    };

    fetchQueue();
  }, [eventId]);

  const handleUpvote = async (reqId: string | number) => {
    const key = getVoteKey(eventId, reqId);
    if (typeof window !== "undefined" && localStorage.getItem(key)) {
      alert("You have already voted for this entry.");
      return;
    }
    setVoting((v: { [key: string]: boolean }) => ({ ...v, [reqId]: true }));
    const item = queue.find((q: QueueItem) => q.id === reqId);
    const newVotes = (item?.votes || 1) + 1;
    const { error } = await supabase
      .from("requests_v3")
      .update({ votes: newVotes })
      .eq("id", reqId);
    setVoting((v: { [key: string]: boolean }) => ({ ...v, [reqId]: false }));

    if (!error) {
      if (typeof window !== "undefined") {
        localStorage.setItem(key, "voted");
      }
      setQueue((q: QueueItem[]) =>
        q.map((entry: QueueItem) =>
          entry.id === reqId ? { ...entry, votes: newVotes } : entry
        )
      );
    } else {
      alert("Error submitting vote!");
    }
  };

  const goToAlbum = (albumId: string | number) => {
    router.push(`/browse/album-detail/${albumId}${eventId ? `?eventId=${eventId}` : ""}`);
  };

  const getDisplayTitle = (item: QueueItem) => {
    if (queueType === 'track') {
      return item.track_name || item.inventory.release?.master?.title || '';
    }
    return item.inventory.release?.master?.title || '';
  };

  return (
    <div className="mt-8 bg-slate-950 text-white p-1 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
      <div className="p-4 bg-slate-900/50 border-b border-slate-800">
        <h3 className="text-lg font-bold text-white m-0">Current Queue</h3>
      </div>
      
      {queue.length === 0 ? (
        <div className="text-center py-12 px-4 bg-slate-900/30">
          <div className="inline-block p-4 rounded-full bg-slate-800 mb-4 text-3xl">💿</div>
          <p className="text-lg text-gray-300 font-medium mb-1">The queue is empty.</p>
          <p className="text-gray-500">Be the first to <span className="text-purple-400 font-bold">add {queueType === 'track' ? 'a track' : queueType === 'album' ? 'an album' : 'an album side'}</span> to get started!</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-slate-800">
                <th className="p-4 text-center w-12">#</th>
                <th className="p-4 w-16"></th>
                <th className="p-4">{queueType === 'track' ? 'Track / Artist' : 'Album / Artist'}</th>
                {queueType === 'side' && <th className="p-4 text-center w-20">Side</th>}
                {queueType === 'track' && (
                  <>
                    <th className="p-4 text-center w-24">Track #</th>
                    <th className="p-4 text-center w-24">Duration</th>
                  </>
                )}
                <th className="p-4 text-center w-16">Vote</th>
                <th className="p-4 text-right w-24">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {queue.map((item: QueueItem) => {
                const disabled =
                  voting[item.id] ||
                  (typeof window !== "undefined" &&
                    !!localStorage.getItem(getVoteKey(eventId, item.id)));
                const canNavigate = item.inventory.id > 0;
                return (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-4 text-center text-sm font-medium text-gray-600 group-hover:text-gray-400">{item.index}</td>
                    <td className="p-4 pl-0">
                      <Image
                        src={item.inventory.release?.master?.cover_image_url || "/images/placeholder.png"}
                        alt={item.inventory.release?.master?.title || ""}
                        className={`rounded bg-slate-800 object-cover ${canNavigate ? "cursor-pointer hover:opacity-80" : ""} transition-opacity`}
                        width={48}
                        height={48}
                        onClick={() => {
                          if (canNavigate) {
                            goToAlbum(item.inventory.id);
                          }
                        }}
                        unoptimized
                      />
                    </td>
                    <td
                      className={`p-4 ${canNavigate ? "cursor-pointer" : ""}`}
                      onClick={() => {
                        if (canNavigate) {
                          goToAlbum(item.inventory.id);
                        }
                      }}
                    >
                      <div className="font-bold text-blue-400 hover:text-blue-300 hover:underline mb-0.5 line-clamp-1">
                        {getDisplayTitle(item)}
                      </div>
                      <div className="text-sm text-gray-400 font-medium uppercase tracking-wide line-clamp-1">
                        {item.artistName}
                      </div>
                    </td>
                    {queueType === 'side' && (
                      <td className="p-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded bg-slate-800 text-gray-300 text-xs font-bold border border-slate-700">
                          {item.side}
                        </span>
                      </td>
                    )}
                    {queueType === 'track' && (
                      <>
                        <td className="p-4 text-center text-sm text-gray-500">
                          {item.track_number || '--'}
                        </td>
                        <td className="p-4 text-center text-sm text-gray-500 font-mono">
                          {item.track_duration || '--:--'}
                        </td>
                      </>
                    )}
                    <td className="p-4 text-center">
                      <button
                        className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold transition-all ${
                          disabled 
                            ? 'bg-slate-800 text-gray-600 cursor-not-allowed' 
                            : 'bg-blue-600 text-white hover:bg-blue-500 hover:scale-110 active:scale-95 shadow-lg shadow-blue-900/30'
                        }`}
                        disabled={disabled}
                        title={
                          typeof window !== "undefined" &&
                          localStorage.getItem(getVoteKey(eventId, item.id))
                            ? "Already voted"
                            : "Vote for this entry"
                        }
                        onClick={() => handleUpvote(item.id)}
                      >
                        ＋
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-red-500 text-lg">♥</span>
                        <span className="text-lg font-bold text-white tabular-nums">{item.votes}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
