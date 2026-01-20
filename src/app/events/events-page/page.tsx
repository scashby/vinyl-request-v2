"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "src/lib/supabaseClient";
import { formatEventText } from "src/utils/textFormatter";
import { Container } from "components/ui/Container";

interface Event {
  id: number;
  title: string;
  date: string;
  location?: string;
  image_url?: string;
  is_featured_grid?: boolean;
  featured_priority?: number | string | null;
}

interface DJSet {
  id: number;
  title: string;
  recorded_at?: string;
  file_url: string;
  download_url?: string;
  events?: {
    id: number;
    title: string;
    date: string;
    location?: string;
  };
}

interface DateObj {
  mon: string;
  day: string | number;
  wk: string;
}

export default function Page() {
  const [events, setEvents] = useState<Event[]>([]);
  const [pastDJSets, setPastDJSets] = useState<DJSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Load events
      const { data: ev, error: evError } = await supabase
        .from("events")
        .select("*")
        .order("date", { ascending: true });

      if (evError) {
        console.error("Error loading events", evError);
      }

      const today = new Date().toISOString().slice(0, 10);
      const all = ev || [];

      // Keep upcoming + TBA
      const filtered = all.filter((e) => {
        const d = e.date;
        if (!d || d === "" || d === "9999-12-31") return true; // TBA
        return d >= today;
      });

      // Sort: dated first, by date; then TBA
      const sorted = [...filtered].sort((a, b) => {
        const aTBA =
          !a.date || a.date === "" || a.date === "9999-12-31";
        const bTBA =
          !b.date || b.date === "" || b.date === "9999-12-31";
        if (aTBA && !bTBA) return 1;
        if (!aTBA && bTBA) return -1;
        if (aTBA && bTBA) return 0;

        return (a.date || "").localeCompare(b.date || "");
      });

      setEvents(sorted);

      // Load DJ sets
      const { data: sets, error: setsError } = await supabase
        .from("dj_sets")
        .select(`*, events ( id, title, date, location )`)
        .order("recorded_at", { ascending: false })
        .limit(6);

      if (setsError) {
        console.error("Error loading dj_sets", setsError);
      }

      setPastDJSets(sets || []);
      setLoading(false);
    };

    load();
  }, []);

  // Compact date helper used across sections
  const compactDate = (dateString?: string): DateObj => {
    if (!dateString || dateString === "9999-12-31") {
      return { mon: "TBA", day: "", wk: "" };
    }
    const d = new Date(dateString + "T00:00:00");
    if (Number.isNaN(d.getTime())) {
      return { mon: "TBA", day: "", wk: "" };
    }
    return {
      mon: d.toLocaleDateString("en-US", {
        month: "short",
      }).toUpperCase(),
      day: d.getDate(),
      wk: d.toLocaleDateString("en-US", {
        weekday: "short",
      }).toUpperCase(),
    };
  };

  // Sort helper: featured priority then date
  const byFeatured = (arr: Event[]) =>
    [...arr].sort((a, b) => {
      const ap =
        typeof a.featured_priority === "number"
          ? a.featured_priority
          : parseInt(String(a.featured_priority), 10) || 9999;
      const bp =
        typeof b.featured_priority === "number"
          ? b.featured_priority
          : parseInt(String(b.featured_priority), 10) || 9999;

      if (ap !== bp) return ap - bp;

      const ad = a.date || "9999-12-31";
      const bd = b.date || "9999-12-31";
      return ad.localeCompare(bd);
    });

  // For Up Next: dated first, then TBA
  const upcomingDated = events.filter(
    (e) => e.date && e.date !== "9999-12-31"
  );
  const tbaEvents = events.filter(
    (e) => !e.date || e.date === "" || e.date === "9999-12-31"
  );
  const upNext = [...upcomingDated, ...tbaEvents].slice(0, 2);

  // Featured grid (manual selection via is_featured_grid), max 8 items (2 rows of 4)
  const featuredGrid = byFeatured(
    events.filter((e) => e.is_featured_grid)
  ).slice(0, 8);

  const latestSet = pastDJSets[0];

  const DateBox = ({ date }: { date?: string }) => {
    const d = compactDate(date);
    const tba = !date || date === "" || date === "9999-12-31";

    return (
      <div className="bg-black border-2 border-[#00c4ff] rounded-lg p-2 text-center min-w-[84px]">
        <div className="text-[#00c4ff] text-[11px] font-extrabold tracking-widest mb-0.5">
          {tba ? "TBA" : d.wk}
        </div>
        <div className="text-white text-3xl font-extrabold leading-none">
          {tba ? "" : d.day}
        </div>
        <div className="text-[#00c4ff] text-[11px] font-extrabold tracking-widest mt-0.5">
          {tba ? "" : d.mon}
        </div>
      </div>
    );
  };

  const SectionTitle = ({ text }: { text: string }) => (
    <div className="mb-6">
      <div className="flex items-center gap-3">
        <div className="w-3.5 h-3.5 rounded-sm bg-[#00c4ff] rotate-45" />
        <h2 className="text-white text-4xl md:text-5xl font-black tracking-widest uppercase m-0">
          {text}
        </h2>
      </div>
      <div className="h-1.5 w-44 bg-[#00c4ff] rounded-full mt-3" />
    </div>
  );

  return (
    <div className="bg-white min-h-screen">
      {/* Hero Header */}
      <header className="relative h-[300px] flex items-center justify-center bg-gray-900">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-50"
          style={{ backgroundImage: "url('/images/event-header-still.jpg')" }}
        />
        <div className="relative z-10 px-8 py-4 bg-black/40 rounded-xl">
          <h1 className="text-4xl md:text-5xl font-bold text-white font-serif-display text-center">
            Upcoming Vinyl Nights
          </h1>
        </div>
      </header>

      <main className="bg-black text-white pb-20">
        {loading ? (
          <div className="py-12 text-center text-white text-lg">
            Loading…
          </div>
        ) : (
          <div data-secwrap="sections">
            {/* SECTION 1 — UP NEXT */}
            {upNext.length > 0 && (
              <section className="bg-gradient-to-b from-[#141414] to-black py-12 border-b-4 border-[#00c4ff]">
                <Container size="xl">
                  <SectionTitle text="Up Next" />

                  <div className={`grid gap-7 ${upNext.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                    {upNext.map((ev) => {
                      // FIX: Updated placeholder path
                      const img =
                        ev.image_url || "/images/coverplaceholder.png";
                      const d = compactDate(ev.date);
                      const tba =
                        !ev.date ||
                        ev.date === "" ||
                        ev.date === "9999-12-31";

                      return (
                        <Link
                          key={ev.id}
                          href={`/events/event-detail/${ev.id}`}
                          className="block group"
                        >
                          <div className="bg-[#222] rounded-xl overflow-hidden border-[3px] border-[#00c4ff] transition-all duration-300 group-hover:-translate-y-2 group-hover:shadow-[0_14px_36px_rgba(0,196,255,0.35)]">
                            <div className="relative w-full aspect-video">
                              <Image
                                src={img}
                                alt={ev.title}
                                fill
                                sizes="(max-width:900px) 100vw, 700px"
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                            <div className="p-6 pb-7">
                              <div className={`inline-block px-4 py-2.5 rounded-lg font-black mb-4 ${
                                tba ? "bg-gray-500 text-white" : "bg-[#00c4ff] text-black"
                              }`}>
                                {tba ? "TBA" : `${d.wk} ${d.mon} ${d.day}`}
                              </div>
                              <h3
                                className="text-white text-3xl font-black leading-tight m-0"
                                dangerouslySetInnerHTML={{
                                  __html: formatEventText(ev.title),
                                }}
                              />
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </Container>
              </section>
            )}

            {/* SECTION 2 — FEATURED GRID */}
            {featuredGrid.length > 0 && (
              <section className="bg-black py-12 border-b-2 border-[#1f1f1f]">
                <Container size="xl">
                  <SectionTitle text="Featured" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    {featuredGrid.map((e) => {
                      // FIX: Updated placeholder path
                      const img = e.image_url || "/images/coverplaceholder.png";
                      const d = compactDate(e.date);
                      const tba = !e.date || e.date === "" || e.date === "9999-12-31";

                      return (
                        <Link
                          key={e.id}
                          href={`/events/event-detail/${e.id}`}
                          className="block group"
                        >
                          <div className="bg-[#1b1b1b] rounded-lg overflow-hidden border-2 border-[#262626] flex flex-col transition-all duration-200 group-hover:-translate-y-1 group-hover:border-[#00c4ff]">
                            <div className="relative w-full pt-[100%]">
                              <Image
                                src={img}
                                alt={e.title}
                                fill
                                sizes="280px"
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                            <div className="p-4">
                              <h4
                                className="text-white text-lg font-extrabold leading-tight min-h-[2.5rem] mb-2"
                                dangerouslySetInnerHTML={{ __html: formatEventText(e.title) }}
                              />
                              <div className="text-[#00d9ff] font-extrabold text-sm">
                                {tba ? "TBA" : `${d.mon} ${d.day}`}
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </Container>
              </section>
            )}

            {/* SECTION 3 — UPCOMING SHOWS + SIDEBAR */}
            <section className="bg-[#0d0d0d] py-16">
              <Container size="xl">
                <SectionTitle text="Upcoming Shows" />

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
                  {/* LEFT COLUMN: list of upcoming events */}
                  <div className="space-y-4">
                    {events.map((e) => {
                      // FIX: Updated placeholder path
                      const img =
                        e.image_url || "/images/coverplaceholder.png";

                      return (
                        <Link
                          key={e.id}
                          href={`/events/event-detail/${e.id}`}
                          className="block group"
                        >
                          <div className="grid grid-cols-[100px_1fr] md:grid-cols-[100px_150px_1fr_auto] gap-4 items-center bg-[#151515] p-4 border-b border-[#262626] border-l-4 border-l-transparent hover:bg-[#1f1f1f] hover:border-l-[#00c4ff] transition-colors duration-200">
                            <DateBox date={e.date} />
                            
                            <div className="relative w-full h-[150px] rounded-md overflow-hidden hidden md:block">
                              <Image
                                src={img}
                                alt={e.title}
                                fill
                                sizes="150px"
                                className="object-cover"
                                unoptimized
                              />
                            </div>

                            <div className="min-w-0 col-span-1 md:col-span-1">
                              <h3
                                className="text-white text-xl font-extrabold leading-tight mb-1"
                                dangerouslySetInnerHTML={{ __html: formatEventText(e.title) }}
                              />
                              {e.location && (
                                <div className="text-[#9aa3ad] text-sm mt-1">
                                  📍 {e.location}
                                </div>
                              )}
                            </div>

                            <div className="hidden md:block">
                              <span className="bg-[#00c4ff] text-black px-4 py-2 rounded-md font-black text-sm uppercase whitespace-nowrap">
                                More Info
                              </span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>

                  {/* RIGHT COLUMN: Just Announced + ads */}
                  <aside className="bg-[#121212] border-2 border-[#262626] rounded-xl p-5 self-start">
                    {/* Just Announced header */}
                    <div className="bg-gradient-to-r from-[#00c4ff] to-[#34dfff] text-black p-2.5 rounded-lg text-center font-black tracking-wide uppercase mb-4 shadow-[0_6px_20px_rgba(0,196,255,0.2)]">
                      Just Announced
                    </div>

                    {/* Just Announced list (up to 6) */}
                    <div className="flex flex-col gap-3.5 mb-5">
                      {events.slice(0, 6).map((e, idx) => {
                        const d = compactDate(e.date);
                        const tba =
                          !e.date ||
                          e.date === "" ||
                          e.date === "9999-12-31";

                        const palettes = [
                          {
                            bar: "#00c4ff",
                            bg: "linear-gradient(135deg,#0b1220,#0f1a2e)",
                            border: "#1c2a44",
                            pill: "#00c4ff",
                            pillText: "#000",
                          },
                          {
                            bar: "#f59e0b",
                            bg: "linear-gradient(135deg,#22160a,#2b1b0b)",
                            border: "#3b2612",
                            pill: "#f59e0b",
                            pillText: "#000",
                          },
                          {
                            bar: "#22c55e",
                            bg: "linear-gradient(135deg,#0c1f15,#0e2a1a)",
                            border: "#1b3b2a",
                            pill: "#22c55e",
                            pillText: "#000",
                          },
                          {
                            bar: "#a78bfa",
                            bg: "linear-gradient(135deg,#1a1430,#221b45)",
                            border: "#2d2361",
                            pill: "#a78bfa",
                            pillText: "#000",
                          },
                          {
                            bar: "#ef4444",
                            bg: "linear-gradient(135deg,#2b1212,#3a1717)",
                            border: "#512020",
                            pill: "#ef4444",
                            pillText: "#000",
                          },
                          {
                            bar: "#06b6d4",
                            bg: "linear-gradient(135deg,#062329,#082f36)",
                            border: "#10424b",
                            pill: "#06b6d4",
                            pillText: "#000",
                          },
                        ];

                        const p = palettes[idx % palettes.length];

                        return (
                          <Link
                            key={e.id}
                            href={`/events/event-detail/${e.id}`}
                            className="block group"
                          >
                            <div 
                              className={`relative border rounded-xl p-4 overflow-hidden transition-all duration-150 group-hover:-translate-y-0.5 group-hover:shadow-[0_16px_36px_rgba(0,196,255,0.22)] shadow-[0_8px_28px_rgba(0,0,0,0.35)]`}
                              style={{ background: p.bg, borderColor: p.border }}
                            >
                              <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: p.bar }} />
                              <h4
                                style={{
                                  color: "#fff",
                                  fontSize: "1rem",
                                  fontWeight: 900,
                                  lineHeight: 1.25,
                                  margin: "0 0 .45rem",
                                  textShadow:
                                    "0 1px 0 rgba(0,0,0,.25)",
                                }}
                                dangerouslySetInnerHTML={{
                                  __html: formatEventText(e.title),
                                }}
                              />
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: ".5rem",
                                }}
                              >
                                <div
                                  style={{
                                    background: p.pill,
                                    color: p.pillText,
                                    fontWeight: 900,
                                    fontSize: ".75rem",
                                    borderRadius: 999,
                                    padding:
                                      ".25rem .55rem",
                                    minWidth: 72,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    textAlign: "center",
                                  }}
                                >
                                  {tba
                                    ? "TBA"
                                    : `${d.wk} ${d.mon} ${d.day}`}
                                </div>
                                <div
                                  style={{
                                    color:
                                      "rgba(255,255,255,.7)",
                                    fontSize: ".8rem",
                                  }}
                                >
                                  {e.location ||
                                    "New date added"}
                                </div>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>

                    {/* AD: Book DJ Gigs */}
                    <div className="relative bg-[radial-gradient(circle_at_30%_20%,#ffe8a3_0%,#ffd15e_40%,#ff9a3c_60%,#ff6b3d_100%)] rounded-2xl p-4 mb-4 shadow-[0_12px_28px_rgba(0,0,0,0.35)] overflow-hidden group">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.4),rgba(255,255,255,0)_35%)]" />
                      <div className="absolute inset-0 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:6px_6px] opacity-[0.06]" />
                      <div className="absolute top-[-18px] right-[-32px] rotate-[15deg] bg-black text-white px-4 py-1.5 font-black tracking-widest uppercase shadow-[0_8px_20px_rgba(0,0,0,0.4)] text-sm">
                        Limited Dates
                      </div>
                      <div className="relative">
                        <div className="text-[1.4rem] font-black uppercase text-[#111] tracking-[1.5px] drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]">
                          Book DJ Gigs
                        </div>
                        <div className="text-[#111] opacity-85 my-2 font-bold">
                          Parties • Breweries • Pop-ups
                        </div>
                        <a
                          href="https://calendly.com/deadwaxdialogues"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block bg-[#111] text-[#ffd15e] px-4 py-3 rounded-md font-black -skew-x-12 shadow-[0_8px_20px_rgba(0,0,0,0.35)] hover:bg-black transition-colors"
                        >
                          <span className="inline-block skew-x-12">
                            Book Online
                          </span>
                        </a>
                      </div>
                    </div>

                    {/* AD: Latest DJ Sets */}
                    {latestSet && (
                      <div className="relative bg-[#050510] rounded-2xl p-5 mb-4 shadow-[0_14px_34px_rgba(0,0,0,0.45)] overflow-hidden">
                        {/* Background Gradients */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,0,204,0.35),transparent_60%)]" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(0,255,255,0.25),transparent_55%)]" />
                        
                        {/* Retro Grid Floor */}
                        <div className="absolute left-[-20px] right-[-20px] bottom-0 h-[110px] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:22px_22px] [transform:perspective(300px)_rotateX(60deg)] origin-bottom" />
                        
                        <div className="absolute top-2.5 right-3 text-2xl drop-shadow-[0_0_6px_rgba(0,255,255,0.6)]">
                          📼
                        </div>
                        <div className="relative">
                          <div className="text-cyan-400 font-black uppercase tracking-wider drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]">
                            Latest DJ Sets
                          </div>
                          <div className="text-gray-200 my-2 font-medium truncate">
                            {latestSet.title}
                          </div>
                          <div className="flex gap-2.5">
                            <a
                              href={latestSet.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-black px-3.5 py-2 rounded-full font-black shadow-[0_0_20px_rgba(0,255,255,0.35)] hover:brightness-110 transition-all"
                            >
                              ▶ Play
                            </a>
                            <a
                              href={latestSet.download_url || latestSet.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-[#111] text-white px-3.5 py-2 rounded-full font-black border border-white/25 hover:bg-[#222] transition-colors"
                            >
                              ⬇ Download
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* AD: Merch */}
                    <div className="bg-[repeating-linear-gradient(-45deg,#022c35,#022c35_10px,#053a44_10px,#053a44_20px)] border-2 border-[#0a4a57] rounded-[14px] p-5 shadow-[0_8px_26px_rgba(0,196,255,0.12)]">
                      <div className="text-[#00e6ff] text-[1.35rem] font-black tracking-widest uppercase mb-1.5 drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]">
                        Merch
                      </div>
                      <div className="text-[#b9e6ee] text-sm mb-3">
                        New designs / styles — new deals. Check it out!
                      </div>
                      <Link
                        href="/merch"
                        className="inline-block bg-[#00e6ff] text-black px-3.5 py-2.5 rounded-lg font-black text-sm hover:bg-[#34efff] transition-colors"
                      >
                        View Merch
                      </Link>
                    </div>
                  </aside>
                </div>
              </Container>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}