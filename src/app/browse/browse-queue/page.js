//browse-queue/page.js

"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { formatEventText } from 'src/utils/textFormatter';
import AlbumSuggestionBox from "components/AlbumSuggestionBox";
import { supabase } from "src/lib/supabaseClient";

function BrowseQueueContent() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId");

  const [queueItems, setQueueItems] = useState([]);
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSuggestionBox, setShowSuggestionBox] = useState(false);

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

      const { data: requests } = await supabase
        .from("requests")
        .select("*")
        .eq("event_id", eventId)
        .order("id", { ascending: true });

      if (!requests?.length) {
        setQueueItems([]);
        return;
      }

      const albumIds = requests.map(r => r.album_id).filter(Boolean);
      let albums = [];

      if (albumIds.length) {
        const res = await supabase
          .from("collection")
          .select("id, artist, title, image_url, year, format")
          .in("id", albumIds);
        albums = res.data || [];
      }

      // Handle both old queue_type (singular) and new queue_types (array)
      const queueTypes = event?.queue_types || (event?.queue_type ? [event.queue_type] : ['side']);
      const primaryQueueType = Array.isArray(queueTypes) ? queueTypes[0] : queueTypes;

      const mapped = requests.map(req => {
        const album = albums.find(a => a.id === req.album_id) || {
          id: req.album_id,
          artist: req.artist || "",
          title: req.title || "",
          image_url: "",
        };

        return {
          id: req.id,
          artist: req.artist || album.artist || "",
          title: req.title || album.title || "",
          side: req.side || null,
          track_number: req.track_number || null,
          track_name: req.track_name || null,
          track_duration: req.track_duration || null,
          votes: req.votes ?? 1,
          created_at: req.created_at,
          queue_type: primaryQueueType,
          collection: {
            id: album.id,
            image_url: album.image_url,
            year: album.year,
            format: album.format,
          },
        };
      });

      mapped.sort((a, b) => (b.votes !== a.votes ? b.votes - a.votes : new Date(a.created_at) - new Date(b.created_at)));
      setQueueItems(mapped);
    } catch (e) {
      console.error("Error loading event and queue:", e);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { loadEventAndQueue(); }, [loadEventAndQueue]);

  const voteForItem = async (itemId) => {
    try {
      const currentItem = queueItems.find(item => item.id === itemId);
      const newVotes = (currentItem?.votes ?? 1) + 1;
      await supabase.from("requests").update({ votes: newVotes }).eq("id", itemId);
      setQueueItems(prev =>
        prev
          .map(item => (item.id === itemId ? { ...item, votes: newVotes } : item))
          .sort((a, b) => (b.votes !== a.votes ? b.votes - a.votes : new Date(a.created_at) - new Date(b.created_at)))
      );
    } catch (e) {
      console.error("Error voting:", e);
    }
  };

  const formatDate = (dateString) =>
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
                          src={item.collection?.image_url || "/images/placeholder.png"}
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
                          {item.collection?.id ? (
                            <Link
                              href={`/browse/album-detail/${item.collection.id}${eventId ? `?eventId=${eventId}` : ""}`}
                              className="font-bold text-base text-emerald-400 hover:text-emerald-300 hover:underline line-clamp-1"
                              aria-label={`View ${queueType === 'track' ? 'track' : 'album'}: ${item.title} by ${item.artist}`}
                            >
                              {queueType === 'track' ? (item.track_name || item.title) : item.title}
                            </Link>
                          ) : (
                            <span className="font-bold text-base text-white line-clamp-1">{queueType === 'track' ? (item.track_name || item.title) : item.title}</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400 font-medium uppercase tracking-wide line-clamp-1">{item.artist}</div>
                      </td>
                      {queueType === 'side' && (
                        <td className="p-4 text-center">
                          <span className="inline-block px-2 py-1 rounded bg-blue-500/20 text-blue-300 text-sm font-bold">
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