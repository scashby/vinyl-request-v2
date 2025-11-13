// src/app/events/events-page/page.js
// Events Page - 9:30 Club Layout
// Section 1: "Up Next" - next 1–2 upcoming events (automatic)
// Section 2: 4-column grid of promoted/boosted shows (manual featured grid)
// Section 3: "Upcoming Shows" - LEFT: vertical list | RIGHT: sidebar with "Just Announced"

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "src/lib/supabaseClient";
import { formatEventText } from "src/utils/textFormatter";
import "styles/internal.css";
import "styles/events.css";

export default function Page() {
  const [events, setEvents] = useState([]);
  const [pastDJSets, setPastDJSets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: ev } = await supabase
        .from("events")
        .select("*")
        .order("date", { ascending: true });

      const today = new Date().toISOString().slice(0, 10);

      const filtered = (ev || []).filter(
        (e) => !e.date || e.date === "9999-12-31" || e.date >= today
      );

      const sorted = filtered.sort((a, b) => {
        const aTBA = !a.date || a.date === "" || a.date === "9999-12-31";
        const bTBA = !b.date || b.date === "" || b.date === "9999-12-31";
        if (aTBA && !bTBA) return 1;
        if (!aTBA && bTBA) return -1;
        if (aTBA && bTBA) return 0;
        return a.date.localeCompare(b.date);
      });

      setEvents(sorted);

      const { data: sets } = await supabase
        .from("dj_sets")
        .select(`*, events ( id, title, date, location )`)
        .order("recorded_at", { ascending: false })
        .limit(6);

      setPastDJSets(sets || []);
      setLoading(false);
    };

    load();
  }, []);

  const compactDate = (dateString) => {
    if (!dateString || dateString === "9999-12-31") {
      return { mon: "TBA", day: "", wk: "" };
    }
    const d = new Date(dateString + "T00:00:00");
    return {
      mon: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
      day: d.getDate(),
      wk: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
    };
  };

  // Helper to sort by featured priority then date
  const byFeatured = (arr) =>
    [...arr].sort((a, b) => {
      const ap =
        typeof a.featured_priority === "number" ? a.featured_priority : 9999;
      const bp =
        typeof b.featured_priority === "number" ? b.featured_priority : 9999;
      if (ap !== bp) return ap - bp;
      const ad = a.date || "9999-12-31";
      const bd = b.date || "9999-12-31";
      return ad.localeCompare(bd);
    });

  // SECTION 1 — AUTOMATIC UP NEXT (next 2 events by date, then TBA)
  const upcomingDated = events.filter(
    (e) => e.date && e.date !== "9999-12-31"
  );

  const tbaEvents = events.filter(
    (e) => !e.date || e.date === "9999-12-31"
  );

  const upNext = [...upcomingDated, ...tbaEvents].slice(0, 2);

  // SECTION 2 — FEATURED GRID (manual selection via is_featured_grid)
  const featuredGrid = byFeatured(events.filter((e) => e.is_featured_grid));

  const latestSet = pastDJSets[0];

  const DateBox = ({ date }) => {
    const d = compactDate(date);
    const tba = !date || date === "9999-12-31";

    return (
      <div
        style={{
          background: "#000",
          border: "2px solid #00c4ff",
          borderRadius: 8,
          padding: "10px 8px",
          textAlign: "center",
          minWidth: 84,
        }}
      >
        <div
          style={{
            color: "#00c4ff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".8px",
            marginBottom: 2,
          }}
        >
          {tba ? "TBA" : d.wk}
        </div>
        <div
          style={{
            color: "#fff",
            fontSize: 26,
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          {tba ? "" : d.day}
        </div>
        <div
          style={{
            color: "#00c4ff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".8px",
            marginTop: 2,
          }}
        >
          {tba ? "" : d.mon}
        </div>
      </div>
    );
  };

  const SectionTitle = ({ text }) => (
    <div style={{ marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 2,
            background: "#00c4ff",
            transform: "rotate(45deg)",
          }}
        />
        <h2
          style={{
            color: "#fff",
            fontSize: "2.6rem",
            fontWeight: 900,
            letterSpacing: "1px",
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          {text}
        </h2>
      </div>
      <div
        style={{
          height: 6,
          width: 180,
          background: "#00c4ff",
          borderRadius: 999,
          marginTop: 10,
        }}
      />
    </div>
  );

  return (
    <div className="page-wrapper">
      {/* IMPORTANT: keep CSS-driven hero image */}
      <header className="event-hero">
        <div className="overlay">
          <h1>Upcoming Vinyl Nights</h1>
        </div>
      </header>

      <main className="event-body" style={{ padding: 0, background: "#000" }}>
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
            {/* SECTION 1 — UP NEXT (only if there is something actually up next) */}
            {upNext.length > 0 && (
              <section
                style={{
                  background: "linear-gradient(180deg,#141414,#000)",
                  padding: "2.75rem 1.25rem 3rem",
                  borderBottom: "3px solid #00c4ff",
                }}
              >
                <div style={{ maxWidth: 1400, margin: "0 auto" }}>
                  <SectionTitle text="Up Next" />
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        upNext.length === 1 ? "1fr" : "repeat(2,1fr)",
                      gap: "1.75rem",
                    }}
                  >
                    {upNext.map((ev) => {
                      const img = ev.image_url || "/images/placeholder.png";
                      const d = compactDate(ev.date);
                      const tba =
                        !ev.date ||
                        ev.date === "" ||
                        ev.date === "9999-12-31";

                      return (
                        <Link
                          key={ev.id}
                          href={`/events/event-detail/${ev.id}`}
                          style={{ textDecoration: "none" }}
                        >
                          <div
                            style={{
                              background: "#222",
                              borderRadius: 12,
                              overflow: "hidden",
                              border: "3px solid #00c4ff",
                              transition:
                                "transform .25s ease, box-shadow .25s ease",
                            }}
                            onMouseOver={(x) => {
                              x.currentTarget.style.transform =
                                "translateY(-6px)";
                              x.currentTarget.style.boxShadow =
                                "0 14px 36px rgba(0,196,255,.35)";
                            }}
                            onMouseOut={(x) => {
                              x.currentTarget.style.transform =
                                "translateY(0)";
                              x.currentTarget.style.boxShadow = "none";
                            }}
                          >
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
                                  background: tba ? "#6b7280" : "#00c4ff",
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

            {/* SECTION 2 — 4-COLUMN FEATURED GRID (only if there are featured events) */}
            {featuredGrid.length > 0 && (
              <section
                style={{
                  background: "#000",
                  padding: "2.75rem 1.25rem 3rem",
                  borderBottom: "2px solid #1f1f1f",
                }}
              >
                <div style={{ maxWidth: 1400, margin: "0 auto" }}>
                  <SectionTitle text="Featured" />
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                      gap: "1.25rem",
                    }}
                  >
                    {featuredGrid.map((e) => {
                      const img = e.image_url || "/images/placeholder.png";
                      const d = compactDate(e.date);
                      return (
                        <div
                          key={e.id}
                          style={{
                            background: "#1b1b1b",
                            borderRadius: 8,
                            overflow: "hidden",
                            border: "2px solid #262626",
                            display: "flex",
                            flexDirection: "column",
                            transition:
                              "transform .2s ease, border-color .2s ease",
                          }}
                          onMouseOver={(x) => {
                            x.currentTarget.style.transform =
                              "translateY(-4px)";
                            x.currentTarget.style.borderColor = "#00c4ff";
                          }}
                          onMouseOut={(x) => {
                            x.currentTarget.style.transform =
                              "translateY(0)";
                            x.currentTarget.style.borderColor = "#262626";
                          }}
                        >
                          <div
                            style={{
                              position: "relative",
                              width: "100%",
                              paddingTop: "100%",
                            }}
                          >
                            <Image
                              src={img}
                              alt={e.title}
                              fill
                              sizes="280px"
                              style={{ objectFit: "cover" }}
                              unoptimized
                            />
                          </div>
                          <div style={{ padding: "1rem 1rem 1.25rem" }}>
                            <h4
                              style={{
                                color: "#fff",
                                fontSize: "1.1rem",
                                fontWeight: 800,
                                lineHeight: 1.3,
                                minHeight: "2.5rem",
                                margin: "0 0 .5rem",
                              }}
                              dangerouslySetInnerHTML={{
                                __html: formatEventText(e.title),
                              }}
                            />
                            <div
                              style={{
                                color: "#00d9ff",
                                fontWeight: 800,
                                fontSize: ".92rem",
                              }}
                            >{`${d.mon} ${d.day}`}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* SECTION 3 — UPCOMING SHOWS + SIDEBAR */}
            <section
              style={{
                background: "#0d0d0d",
                padding: "3rem 1.25rem 4rem",
              }}
            >
              <div style={{ maxWidth: 1400, margin: "0 auto" }}>
                <SectionTitle text="Upcoming Shows" />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 350px",
                    gap: "2rem",
                  }}
                >
                  {/* LEFT COLUMN: full-width rows */}
                  <div>
                    {events.map((e) => {
                      const img = e.image_url || "/images/placeholder.png";
                      return (
                        <Link
                          key={e.id}
                          href={`/events/event-detail/${e.id}`}
                          style={{ textDecoration: "none", display: "block" }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "100px 150px 1fr auto",
                              gap: "1rem",
                              alignItems: "center",
                              background: "#151515",
                              padding: "1rem",
                              borderBottom: "1px solid #262626",
                              transition:
                                "background .2s ease, border-left-color .2s ease",
                            }}
                            onMouseOver={(x) => {
                              x.currentTarget.style.background = "#1f1f1f";
                              x.currentTarget.style.borderLeft =
                                "4px solid #00c4ff";
                            }}
                            onMouseOut={(x) => {
                              x.currentTarget.style.background = "#151515";
                              x.currentTarget.style.borderLeft = "none";
                            }}
                          >
                            <DateBox date={e.date} />
                            <div
                              style={{
                                position: "relative",
                                width: 150,
                                height: 150,
                                borderRadius: 6,
                                overflow: "hidden",
                              }}
                            >
                              <Image
                                src={img}
                                alt={e.title}
                                fill
                                sizes="150px"
                                style={{ objectFit: "cover" }}
                                unoptimized
                              />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <h3
                                style={{
                                  color: "#fff",
                                  fontSize: "1.25rem",
                                  fontWeight: 800,
                                  margin: 0,
                                  lineHeight: 1.25,
                                }}
                                dangerouslySetInnerHTML={{
                                  __html: formatEventText(e.title),
                                }}
                              />
                              {e.location ? (
                                <div
                                  style={{
                                    color: "#9aa3ad",
                                    fontSize: ".9rem",
                                    marginTop: ".35rem",
                                  }}
                                >
                                  📍 {e.location}
                                </div>
                              ) : null}
                            </div>
                            <div
                              style={{
                                background: "#00c4ff",
                                color: "#000",
                                padding: ".55rem 1.1rem",
                                borderRadius: 6,
                                fontWeight: 900,
                                fontSize: ".85rem",
                                whiteSpace: "nowrap",
                                textTransform: "uppercase",
                              }}
                            >
                              More Info
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>

                  {/* RIGHT COLUMN: Just Announced + 3 ad blocks */}
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
                        boxShadow: "0 6px 20px rgba(0,196,255,.2)",
                      }}
                    >
                      Just Announced
                    </div>

                    {/* Just Announced list */}
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
                              onMouseOver={(x) => {
                                x.currentTarget.style.transform =
                                  "translateY(-2px)";
                                x.currentTarget.style.boxShadow =
                                  "0 16px 36px rgba(0,196,255,.22)";
                              }}
                              onMouseOut={(x) => {
                                x.currentTarget.style.transform =
                                  "translateY(0)";
                                x.currentTarget.style.boxShadow =
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
                              {idx < 2 ? (
                                <div
                                  style={{
                                    position: "absolute",
                                    top: 8,
                                    right: 8,
                                    background: p.bar,
                                    color: "#000",
                                    fontWeight: 900,
                                    fontSize: 10,
                                    padding: "4px 6px",
                                    borderRadius: 999,
                                    letterSpacing: ".6px",
                                  }}
                                >
                                  NEW
                                </div>
                              ) : null}
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
                                    padding: ".25rem .55rem",
                                  }}
                                >
                                  {tba
                                    ? "TBA"
                                    : `${d.wk} ${d.mon} ${d.day}`}
                                </div>
                                <div
                                  style={{
                                    color: "rgba(255,255,255,.7)",
                                    fontSize: ".8rem",
                                  }}
                                >
                                  {e.location || "New date added"}
                                </div>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>

                    {/* AD: Book DJ Gigs — Retro Poster */}
                    <div
                      style={{
                        position: "relative",
                        background:
                          "radial-gradient(circle at 30% 20%, #ffe8a3 0%, #ffd15e 40%, #ff9a3c 60%, #ff6b3d 100%)",
                        borderRadius: 16,
                        padding: "1.1rem",
                        marginBottom: "1rem",
                        boxShadow: "0 12px 28px rgba(0,0,0,.35)",
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

                    {/* AD: Latest DJ Sets — Neon Synthwave */}
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
                                padding: ".55rem .9rem",
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
                                padding: ".55rem .9rem",
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

            {/* BOOKING FOOTER SECTION (restored) */}
            {events.length > 0 && (
              <section
                style={{
                  background: "#1f2937",
                  padding: "4rem 2rem",
                  borderTop: "1px solid #374151",
                }}
              >
                <div
                  style={{
                    maxWidth: "700px",
                    margin: "0 auto",
                    textAlign: "center",
                  }}
                >
                  <h2
                    style={{
                      fontSize: "2rem",
                      marginBottom: "1rem",
                      color: "#fff",
                      fontWeight: "bold",
                    }}
                  >
                    Book Dead Wax Dialogues
                  </h2>
                  <p
                    style={{
                      fontSize: "1.1rem",
                      color: "#d1d5db",
                      marginBottom: "2.5rem",
                      lineHeight: "1.6",
                    }}
                  >
                    Looking to bring vinyl culture to your venue or event?
                    <br />
                    Get in touch to discuss hosting a Dead Wax Dialogues
                    experience.
                  </p>

                  <div
                    style={{
                      backgroundColor: "#374151",
                      border: "2px solid #4b5563",
                      borderRadius: "12px",
                      padding: "2.5rem",
                      display: "inline-block",
                      textAlign: "center",
                      minWidth: "350px",
                    }}
                  >
                    <a
                      href="https://calendly.com/deadwaxdialogues"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-block",
                        backgroundColor: "#0284c7",
                        color: "#ffffff",
                        padding: "1rem 2.5rem",
                        borderRadius: "8px",
                        textDecoration: "none",
                        fontSize: "1.1rem",
                        fontWeight: "600",
                        marginBottom: "2rem",
                        transition: "all 0.2s ease",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = "#0369a1";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = "#0284c7";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      📅 Book Online
                    </a>

                    <div
                      style={{
                        color: "#9ca3af",
                        marginBottom: "1.5rem",
                        fontSize: "0.95rem",
                      }}
                    >
                      or contact directly:
                    </div>

                    <p
                      style={{
                        margin: "0.85rem 0",
                        fontSize: "1.05rem",
                        color: "#e5e7eb",
                      }}
                    >
                      <strong>Steve Ashby</strong>
                      <br />
                      <span
                        style={{
                          color: "#9ca3af",
                          fontSize: "0.95rem",
                        }}
                      >
                        Dead Wax Dialogues
                      </span>
                    </p>
                    <p style={{ margin: "0.85rem 0" }}>
                      <a
                        href="mailto:steve@deadwaxdialogues.com"
                        style={{
                          color: "#60a5fa",
                          textDecoration: "none",
                          fontSize: "1.05rem",
                        }}
                      >
                        steve@deadwaxdialogues.com
                      </a>
                    </p>
                    <p style={{ margin: "0.85rem 0" }}>
                      <a
                        href="tel:443-235-6608"
                        style={{
                          color: "#60a5fa",
                          textDecoration: "none",
                          fontSize: "1.05rem",
                        }}
                      >
                        443-235-6608
                      </a>
                    </p>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
