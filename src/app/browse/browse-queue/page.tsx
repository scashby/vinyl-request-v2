//browse-queue/page.tsx

"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { formatEventText } from 'src/utils/textFormatter';
import AlbumSuggestionBox from "components/AlbumSuggestionBox";
import { supabase } from "src/lib/supabaseClient";
import type { Database } from 'src/types/supabase';

interface QueueItem {
  id: string;
  artist: string;
  title: string;
  side: string | null;
  track_number: string | null;
  track_title: string | null;
  track_duration: string | null;
  votes: number;
  created_at: string | null;
  queue_type: string;
  inventory: {
    id: number;
    image_url: string;
    year: number | null;
    format: string;
  } | null;
}

interface EventData {
  id: number;
  title: string;
  date: string;
  image_url: string;
  queue_types?: string[];
  queue_type?: string;
}

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

function BrowseQueueContent() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId");

  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSuggestionBox, setShowSuggestionBox] = useState(false);

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

  const loadEventAndQueue = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    try {
      const { data: event } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();
      setEventData(event || null);

      const { data: v3Requests, error: v3Error } = await supabase
        .from("requests_v3")
        .select("id, inventory_id, recording_id, votes, created_at")
        .eq("event_id", eventId)
        .order("id", { ascending: true });

      if (v3Error) throw v3Error;
      if (!v3Requests?.length) {
        setQueueItems([]);
        return;
      }

      const inventoryIds = v3Requests
        .map((request) => request.inventory_id)
        .filter(Boolean);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let inventoryRows: any[] = [];

      if (inventoryIds.length) {
        const { data: inventoryData, error: inventoryError } = await supabase
          .from("inventory")
          .select(
            "id, release:releases (id, title, release_year, format, image_url, master:masters (id, title, artist:artists (id, name)))"
          )
          .in("id", inventoryIds);

        if (inventoryError) throw inventoryError;
        inventoryRows = inventoryData || [];
      }

      const inventoryById = new Map(
        inventoryRows.map((row) => [row.id, row])
      );

      const queueItems = v3Requests.map((request) => {
        const inventory = request.inventory_id
          ? inventoryById.get(request.inventory_id)
          : null;
        const release = inventory?.release;
        const master = release?.master;
        const artist = master?.artist;
        const title = release?.title || master?.title || "";
        const artistName = artist?.name || "";
        const imageUrl =
          release?.image_url || master?.image_url || inventory?.image_url || "";

        return {
          id: request.id,
          artist: artistName,
          title,
          side: null,
          track_number: null,
          track_name: null,
          track_duration: null,
          votes: request.votes ?? 1,
          created_at: request.created_at,
          queue_type: request.recording_id ? "track" : "album",
          collection: inventory
            ? {
                id: inventory.id,
                image_url: imageUrl,
                year: release?.release_year ?? "",
                format: release?.format ?? "",
              }
            : null,
        };
      });

      const queueTypes = event?.queue_types || (event?.queue_type ? [event.queue_type] : ['side']);
      const primaryQueueType = Array.isArray(queueTypes) ? queueTypes[0] : queueTypes;
      const mapped = queueItems.map((item) => ({
        ...item,
        queue_type: item.queue_type || primaryQueueType,
      }));

      mapped.sort((a, b) => (b.votes !== a.votes ? b.votes - a.votes : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
      setQueueItems(mapped);
    } catch (e) {
      console.error("Error loading event and queue:", e);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { loadEventAndQueue(); }, [loadEventAndQueue]);

  const voteForItem = async (itemId: string) => {
    try {
      const currentItem = queueItems.find(item => item.id === itemId);
      const newVotes = (currentItem?.votes ?? 1) + 1;
      await supabase.from("requests_v3").update({ votes: newVotes }).eq("id", itemId);
      setQueueItems(prev =>
        prev
          .map(item => (item.id === itemId ? { ...item, votes: newVotes } : item))
          .sort((a, b) => {
            if (b.votes !== a.votes) return b.votes - a.votes;
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateA - dateB;
          })
      );
    } catch (e) {
      console.error("Error voting:", e);
    }
  };

  const formatDate = (dateString?: string) =>
    dateString ? new Date(dateString + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";

  // Get primary queue type for display
  const queueTypes = eventData?.queue_types || (eventData?.queue_type ? [eventData.queue_type] : ['side']);
  const queueType = Array.isArray(queueTypes) ? queueTypes[0] : queueTypes;

  if (loading) return (
    <div className="min-h-screen flex justify-center items-center bg-gray-50 text-gray-600">
      Loading event queue...
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="relative h-[300px] flex items-center justify-center bg-gray-900">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-50"
          style={{ backgroundImage: `url(${eventData?.image_url || "/images/event-header-still.jpg"})` }}
        />
        <div className="relative z-10 px-8 py-6 bg-black/40 rounded-xl backdrop-blur-sm text-center text-white">
          <h1 className="text-4xl md:text-5xl font-bold font-serif-display mb-2" dangerouslySetInnerHTML={{ __html: formatEventText(eventData?.title || "Event Queue") }} />
          {eventData?.date && <p className="text-lg opacity-90">{formatDate(eventData.date)}</p>}
          {queueType && (
            <p className="text-sm opacity-80 mt-2 bg-black/30 inline-block px-3 py-1 rounded-full">
              Queue Mode: {queueType === 'track' ? '🎵 By Track' : queueType === 'album' ? '💿 By Album' : '📀 By Side'}
            </p>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8 items-start">
        <aside className="lg:w-[280px] flex-shrink-0 lg:sticky lg:top-8 w-full">
          <article className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
            <div className="relative w-full aspect-square mb-4 rounded-lg overflow-hidden shadow-md">
              <Image
                src={eventData?.image_url || "/images/event-header-still.jpg"}
                alt={eventData?.title || "Event"}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 280px"
                priority
                unoptimized
              />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2" dangerouslySetInnerHTML={{ __html: formatEventText(eventData?.title || "Event Name") }} />
            <p className="text-gray-600">{eventData?.date ? formatDate(eventData.date) : "Date TBD"}</p>
          </article>
        </aside>

        <section className="flex-1 min-w-0">
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex gap-6 text-sm font-medium text-gray-600 flex-wrap justify-center md:justify-start">
                <div className="flex items-center gap-2">
                  <span>📀</span> {queueItems.length} requests
                </div>
                <div className="flex items-center gap-2">
                  <span>🗳️</span> {queueItems.reduce((sum, i) => sum + (i.votes ?? 0), 0)} total votes
                </div>
                {queueItems.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span>🏆</span> Top: {queueItems[0]?.votes ?? 0} votes
                  </div>
                )}
              </div>

              <div className="flex gap-3 flex-wrap justify-center">
                {!showSuggestionBox && (
                  <button
                    onClick={() => setShowSuggestionBox(true)}
                    className="flex items-center gap-2 bg-gradient-to-br from-blue-500 to-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:shadow-md transition-all active:scale-95"
                  >
                    💡 Suggest Album
                  </button>
                )}

                <Link 
                  href={`/browse/browse-albums?eventId=${eventId}`}
                  className="bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors"
                >
                  📚 Browse Collection
                </Link>

                <Link 
                  href={`/events/event-detail/${eventId}`}
                  className="bg-purple-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors"
                >
                  📅 Event Details
                </Link>
              </div>
            </div>
          </div>

          {showSuggestionBox && (
            <div className="mb-6">
              <AlbumSuggestionBox context="general" onClose={() => setShowSuggestionBox(false)} />
            </div>
          )}

          <div className="bg-slate-900 text-white p-1 rounded-xl shadow-xl overflow-hidden border border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-900/50">
                    <th className="p-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider w-12">#</th>
                    <th className="p-4 w-16"><span className="sr-only">Cover</span></th>
                    <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider min-w-[200px]">{queueType === 'track' ? 'Track / Artist' : 'Album / Artist'}</th>
                    {queueType === 'side' && <th className="p-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider w-20">Side</th>}
                    {queueType === 'track' && (
                      <>
                        <th className="p-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider w-24">Track #</th>
                        <th className="p-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider w-20">Duration</th>
                      </>
                    )}
                    <th className="p-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider w-16">Vote</th>
                    <th className="p-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider w-24">Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {queueItems.map((item, index) => (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                      <td className="p-4 text-center text-sm font-semibold text-gray-500 group-hover:text-gray-300">
                        {index + 1}
                      </td>
                      <td className="p-4 pl-0">
                        <Image
                          src={item.inventory?.image_url || "/images/placeholder.png"}
                          alt={item.title || ""}
                          className="rounded shadow-md object-cover bg-slate-800"
                          width={48}
                          height={48}
                          unoptimized
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          {index < 3 && <span className="text-lg">{index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}</span>}
                          {item.inventory?.id ? (
                            <Link
                              href={`/browse/album-detail/${item.inventory.id}${eventId ? `?eventId=${eventId}` : ""}`}
                              className="font-bold text-base text-emerald-400 hover:text-emerald-300 hover:underline line-clamp-1"
                              aria-label={`View ${queueType === 'track' ? 'track' : 'album'}: ${item.title} by ${item.artist}`}
                            >
                              {queueType === 'track' ? (item.track_title || item.title) : item.title}
                            </Link>
                          ) : (
                            <span className="font-bold text-base text-white line-clamp-1">{queueType === 'track' ? (item.track_title || item.title) : item.title}</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400 font-medium uppercase tracking-wide line-clamp-1">{item.artist}</div>
                      </td>
                      {queueType === 'side' && (
                        <td className="p-4 text-center">
                          <span className="inline-block px-2 py-1 rounded bg-blue-500/20 text-blue-300 text-sm font-bold">
                            {item.side || '--'}
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
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-white font-bold hover:scale-110 active:scale-95 transition-all shadow-lg shadow-blue-900/50"
                          onClick={() => voteForItem(item.id)}
                          aria-label="Vote up"
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function BrowseQueuePage() {
  return (
    <Suspense fallback={<div>Loading queue...</div>}>
      <BrowseQueueContent />
    </Suspense>
  );
}
