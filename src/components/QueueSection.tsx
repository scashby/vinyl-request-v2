// components/QueueSection.tsx

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from 'src/lib/supabaseClient';
import type { Database } from 'src/types/supabase';

interface Album {
  id: string | number;
  artist: string;
  title: string;
  image_url?: string;
  format?: string;
  is_1001?: boolean | null;
}

interface RequestEntry {
  id: string | number;
  inventory_id: number | null;
  recording_id: number | null;
  track_title: string | null;
  votes: number;
  event_id: number | null;
  created_at?: string | null;
}

interface QueueItem {
  id: string | number;
  index: number;
  side: string | null;
  track_number: string | null;
  track_name: string | null;
  track_duration: string | null;
  votes: number;
  album: Album;
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

  const buildFormatLabel = (release?: ReleaseRow | null) => {
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

  type InventoryRow = Database['public']['Tables']['inventory']['Row'];
  type ReleaseRow = Database['public']['Tables']['releases']['Row'];
  type MasterRow = Database['public']['Tables']['masters']['Row'];
  type ArtistRow = Database['public']['Tables']['artists']['Row'];
  type RecordingRow = Database['public']['Tables']['recordings']['Row'];
  type RequestRow = Database['public']['Tables']['requests_v3']['Row'];

  type InventoryQueryRow = InventoryRow & {
    release?: (ReleaseRow & {
      master?: (MasterRow & {
        artist?: ArtistRow | null;
      }) | null;
    }) | null;
  };

  type RequestQueryRow = RequestRow & {
    inventory?: InventoryQueryRow | null;
    recording?: RecordingRow | null;
  };

  useEffect(() => {
    const fetchQueue = async () => {
      // Fetch event to get queue type
      const { data: eventData } = await supabase
        .from("events")
        .select("queue_type")
        .eq("id", eventId)
        .single();

      const currentQueueType = eventData?.queue_type || 'side';
      setQueueType(currentQueueType);

      const { data: requests, error } = await supabase
        .from("requests_v3")
        .select(`
          *,
          inventory:inventory (
            id,
            release:releases (
              media_type,
              format_details,
              qty,
              master:masters (
                title,
                cover_image_url,
                artist:artists (
                  name
                )
              )
            )
          ),
          recording:recordings (
            title,
            duration_seconds
          )
        `)
        .eq("event_id", eventId)
        .order("id", { ascending: true });

      if (error || !requests) {
        console.error("Error fetching requests:", error);
        setQueue([]);
        return;
      }

      const mapped: QueueItem[] = (requests as RequestQueryRow[]).map((req, i) => {
        const inventory = req.inventory ?? null;
        const release = inventory?.release ?? null;
        const master = release?.master ?? null;
        const album: Album = {
          id: inventory?.id ?? req.inventory_id ?? '',
          artist: master?.artist?.name ?? req.artist_name ?? '',
          title: master?.title ?? '',
          image_url: master?.cover_image_url ?? '',
          format: buildFormatLabel(release)
        };
        const sideLabel = req.track_title && req.track_title.toLowerCase().startsWith('side ')
          ? req.track_title.replace(/side\s+/i, '')
          : null;

        return {
          id: req.id,
          index: i + 1,
          side: sideLabel,
          track_number: null,
          track_name: req.recording?.title ?? req.track_title ?? null,
          track_duration: req.recording?.duration_seconds ? formatDuration(req.recording.duration_seconds) : null,
          votes: req.votes || 1,
          queue_type: currentQueueType,
          album,
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
      return item.track_name || item.album.title;
    }
    return item.album.title;
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
                return (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-4 text-center text-sm font-medium text-gray-600 group-hover:text-gray-400">{item.index}</td>
                    <td className="p-4 pl-0">
                      <Image
                        src={item.album.image_url || "/images/placeholder.png"}
                        alt={item.album.title || ""}
                        className="rounded bg-slate-800 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        width={48}
                        height={48}
                        onClick={() => goToAlbum(item.album.id)}
                        unoptimized
                      />
                    </td>
                    <td
                      className="p-4 cursor-pointer"
                      onClick={() => goToAlbum(item.album.id)}
                    >
                      <div className="font-bold text-blue-400 hover:text-blue-300 hover:underline mb-0.5 line-clamp-1">
                        {getDisplayTitle(item)}
                      </div>
                      <div className="text-sm text-gray-400 font-medium uppercase tracking-wide line-clamp-1">
                        {item.album.artist}
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
