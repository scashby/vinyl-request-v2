"use client";

// Events Page - 9:30 Club Layout
// Section 1: "Up Next" - next 1–2 upcoming events (automatic)
// Section 2: 4-column grid of promoted/boosted shows (manual featured grid)
// Section 3: "Upcoming Shows" - LEFT: vertical list | RIGHT: sidebar with "Just Announced"

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "src/lib/supabaseClient";
import { formatEventText } from "src/utils/textFormatter";
import { Container } from "components/ui/Container";
import { Card } from "components/ui/Card";

export default function Page() {
  const [events, setEvents] = useState([]);
  const [pastDJSets, setPastDJSets] = useState([]);
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
  const compactDate = (dateString) => {
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
  const byFeatured = (arr) =>
    [...arr].sort((a, b) => {
      const ap =
        typeof a.featured_priority === "number"
          ? a.featured_priority
          : parseInt(a.featured_priority, 10) || 9999;
      const bp =
        typeof b.featured_priority === "number"
          ? b.featured_priority
          : parseInt(b.featured_priority, 10) || 9999;

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

  const DateBox = ({ date }) => {
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

  const SectionTitle = ({ text }) => (
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
          <div
            style={{
              padding: "3rem 1rem",
              textAlign: "center",
              color: "#fff",
            }}
          >
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
                      const img =
                        ev.image_url || "/images/placeholder.png";
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
                            <div
                              style={{
                                position: "relative",
                                width: "100%",
                                paddingTop: "56.25%",
                              }}
                            >
                              <Image
                                src={img}
                                alt={ev.title}
                                fill
                                sizes="(max-width:900px) 100vw, 700px"
                                style={{ objectFit: "cover" }}
                                unoptimized
                              />
                            </div>
                            <div
                              style={{
                                padding: "1.5rem 1.25rem 1.75rem",
                              }}
                            >
                              <div
                                style={{
                                  background: tba
                                    ? "#6b7280"
                                    : "#00c4ff",
                                  color: tba ? "#fff" : "#000",
                                  padding: ".6rem .9rem",
                                  borderRadius: 8,
                                  display: "inline-block",
                                  fontWeight: 900,
                                  marginBottom: ".9rem",
                                }}
                              >
                                {tba
                                  ? "TBA"
                                  : `${d.wk} ${d.mon} ${d.day}`}
                              </div>
                              <h3
                                style={{
                                  color: "#fff",
                                  fontSize: "1.9rem",
                                  fontWeight: 900,
                                  lineHeight: 1.2,
                                  margin: 0,
                                }}
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
                </div>
              </section>
            )}

            {/* SECTION 2 — FEATURED GRID */}
            {featuredGrid.length > 0 && (
              <section className="bg-black py-12 border-b-2 border-[#1f1f1f]">
                <Container size="xl">
                  <SectionTitle text="Featured" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    {featuredGrid.map((e) => {
                      const img = e.image_url || "/images/placeholder.png";
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
                      const img =
                        e.image_url || "/images/placeholder.png";

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
                  <aside
                    style={{
                      background: "#121212",
                      border: "2px solid #262626",
                      borderRadius: 12,
                      padding: "1.25rem",
                      alignSelf: "start",
                    }}
                  >
                    {/* Just Announced header */}
                    <div
                      style={{
                        background:
                          "linear-gradient(90deg,#00c4ff,#34dfff)",
                        color: "#000",
                        padding: ".65rem .75rem",
                        borderRadius: 8,
                        textAlign: "center",
                        fontWeight: 900,
                        letterSpacing: ".5px",
                        textTransform: "uppercase",
                        marginBottom: "1rem",
                        boxShadow:
                          "0 6px 20px rgba(0,196,255,.2)",
                      }}
                    >
                      Just Announced
                    </div>

                    {/* Just Announced list (up to 6) */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: ".9rem",
                        marginBottom: "1.25rem",
                      }}
                    >
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
                            style={{ textDecoration: "none" }}
                          >
                            <div
                              style={{
                                position: "relative",
                                background: p.bg,
                                border: `1px solid ${p.border}`,
                                borderRadius: 12,
                                padding:
                                  ".95rem .95rem .95rem 1rem",
                                boxShadow:
                                  "0 8px 28px rgba(0,0,0,.35)",
                                overflow: "hidden",
                                transition:
                                  "transform .15s ease, box-shadow .15s ease",
                              }}
                              onMouseOver={(evt) => {
                                const card = evt.currentTarget;
                                card.style.transform =
                                  "translateY(-2px)";
                                card.style.boxShadow =
                                  "0 16px 36px rgba(0,196,255,.22)";
                              }}
                              onMouseOut={(evt) => {
                                const card = evt.currentTarget;
                                card.style.transform =
                                  "translateY(0)";
                                card.style.boxShadow =
                                  "0 8px 28px rgba(0,0,0,.35)";
                              }}
                            >
                              <div
                                style={{
                                  position: "absolute",
                                  left: 0,
                                  top: 0,
                                  bottom: 0,
                                  width: 6,
                                  background: p.bar,
                                }}
                              />
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
                    <div
                      style={{
                        position: "relative",
                        background:
                          "radial-gradient(circle at 30% 20%, #ffe8a3 0%, #ffd15e 40%, #ff9a3c 60%, #ff6b3d 100%)",
                        borderRadius: 16,
                        padding: "1.1rem",
                        marginBottom: "1rem",
                        boxShadow:
                          "0 12px 28px rgba(0,0,0,.35)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background:
                            "radial-gradient(circle at 70% 30%, rgba(255,255,255,.4), rgba(255,255,255,0) 35%)",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          backgroundImage:
                            "radial-gradient(#000 1px, transparent 1px)",
                          backgroundSize: "6px 6px",
                          opacity: 0.06,
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          top: -18,
                          right: -32,
                          transform: "rotate(15deg)",
                          background: "#000",
                          color: "#fff",
                          padding: ".35rem .9rem",
                          fontWeight: 900,
                          letterSpacing: "1px",
                          textTransform: "uppercase",
                          boxShadow:
                            "0 8px 20px rgba(0,0,0,.4)",
                        }}
                      >
                        Limited Dates
                      </div>
                      <div style={{ position: "relative" }}>
                        <div
                          style={{
                            fontSize: "1.4rem",
                            fontWeight: 1000,
                            textTransform: "uppercase",
                            color: "#111",
                            letterSpacing: "1.5px",
                            textShadow:
                              "0 1px 0 rgba(255,255,255,.6)",
                          }}
                        >
                          Book DJ Gigs
                        </div>
                        <div
                          style={{
                            color: "#111",
                            opacity: 0.85,
                            margin: ".4rem 0 .9rem",
                            fontWeight: 700,
                          }}
                        >
                          Parties • Breweries • Pop-ups
                        </div>
                        <a
                          href="https://calendly.com/deadwaxdialogues"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-block",
                            background: "#111",
                            color: "#ffd15e",
                            padding: ".75rem 1rem",
                            borderRadius: 6,
                            fontWeight: 1000,
                            textDecoration: "none",
                            transform: "skewX(-12deg)",
                            boxShadow:
                              "0 8px 20px rgba(0,0,0,.35)",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              transform: "skewX(12deg)",
                            }}
                          >
                            Book Online
                          </span>
                        </a>
                      </div>
                    </div>

                    {/* AD: Latest DJ Sets */}
                    {latestSet && (
                      <div
                        style={{
                          position: "relative",
                          background:
                            "radial-gradient(circle at 50% 0%, rgba(255,0,204,.35), rgba(0,0,0,0) 60%), radial-gradient(circle at 50% 120%, rgba(0,255,255,.25), rgba(0,0,0,0) 55%), #050510",
                          borderRadius: 16,
                          padding: "1.1rem",
                          marginBottom: "1rem",
                          boxShadow:
                            "0 14px 34px rgba(0,0,0,.45)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            left: -20,
                            right: -20,
                            bottom: 0,
                            height: 110,
                            backgroundImage:
                              "linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)",
                            backgroundSize: "22px 22px",
                            transform:
                              "perspective(300px) rotateX(60deg)",
                            transformOrigin: "bottom",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            top: 10,
                            right: 12,
                            fontSize: 26,
                            filter:
                              "drop-shadow(0 0 6px rgba(0,255,255,.6))",
                          }}
                        >
                          📼
                        </div>
                        <div style={{ position: "relative" }}>
                          <div
                            style={{
                              color: "#00ffff",
                              fontWeight: 900,
                              textTransform: "uppercase",
                              letterSpacing: "1.2px",
                              textShadow:
                                "0 0 8px rgba(0,255,255,.8)",
                            }}
                          >
                            Latest DJ Sets
                          </div>
                          <div
                            style={{
                              color: "#e5e7eb",
                              margin: ".35rem 0 .8rem",
                            }}
                          >
                            {latestSet.title}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: ".65rem",
                            }}
                          >
                            <a
                              href={latestSet.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                background:
                                  "linear-gradient(90deg,#00ffff,#ff00ff)",
                                color: "#000",
                                padding:
                                  ".55rem .9rem",
                                borderRadius: 999,
                                fontWeight: 1000,
                                textDecoration: "none",
                                boxShadow:
                                  "0 0 20px rgba(0,255,255,.35)",
                              }}
                            >
                              ▶ Play
                            </a>
                            <a
                              href={
                                latestSet.download_url ||
                                latestSet.file_url
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                background: "#111",
                                color: "#fff",
                                padding:
                                  ".55rem .9rem",
                                borderRadius: 999,
                                fontWeight: 900,
                                textDecoration: "none",
                                border:
                                  "1px solid rgba(255,255,255,.25)",
                              }}
                            >
                              ⬇ Download
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* AD: Merch */}
                    <div
                      style={{
                        background:
                          "repeating-linear-gradient(-45deg,#022c35,#022c35 10px,#053a44 10px,#053a44 20px)",
                        border: "2px solid #0a4a57",
                        borderRadius: 14,
                        padding: "1.1rem",
                        boxShadow:
                          "0 8px 26px rgba(0,196,255,.12)",
                      }}
                    >
                      <div
                        style={{
                          color: "#00e6ff",
                          fontSize: "1.35rem",
                          fontWeight: 900,
                          letterSpacing: "1px",
                          textTransform: "uppercase",
                          marginBottom: ".35rem",
                          textShadow:
                            "0 1px 0 rgba(0,0,0,.35)",
                        }}
                      >
                        Merch
                      </div>
                      <div
                        style={{
                          color: "#b9e6ee",
                          fontSize: ".95rem",
                          marginBottom: ".8rem",
                        }}
                      >
                        New designs / styles — new deals. Check it
                        out!
                      </div>
                      <Link
                        href="/merch"
                        style={{
                          display: "inline-block",
                          background: "#00e6ff",
                          color: "#000",
                          padding: ".6rem .9rem",
                          borderRadius: 10,
                          textDecoration: "none",
                          fontWeight: 900,
                        }}
                      >
                        View Merch
                      </Link>
                    </div>
                  </aside>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
