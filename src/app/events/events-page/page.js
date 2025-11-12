// src/app/events/events-page/page.js
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "src/lib/supabaseClient";
import { formatEventText } from "src/utils/textFormatter";
import "styles/internal.css";
import "styles/events.css";

/**
 * EVENTS PAGE — 9:30 Club style (STRICT 3‑SECTION STACK)
 * ORDER:
 *  - Header
 *  - Section 1: Up Next (events[0..1])
 *  - Section 2: 4‑column grid (PLACEHOLDERS ONLY)
 *  - Section 3: Upcoming Shows (LEFT: ALL events • RIGHT: 350px sidebar)
 *  - Footer
 *
 * Lint-safe: no JSX fragments; single export; no duplicate content.
 */

export default function Page() {
  const [events, setEvents] = useState([]);
  const [pastDJSets, setPastDJSets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // EVENTS
      const { data: ev, error: evErr } = await supabase
        .from("events")
        .select("*")
        .order("date", { ascending: true });
      if (evErr) console.error("Events error:", evErr);

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

      // DJ sets for sidebar card
      const { data: sets, error: setErr } = await supabase
        .from("dj_sets")
        .select(`*, events ( id, title, date, location )`)
        .order("recorded_at", { ascending: false })
        .limit(6);
      if (setErr) console.error("DJ sets error:", setErr);
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

  const upNext = events.slice(0, 2);

  // Section 2: placeholders only (until featured tagging exists)
  const placeholderGrid = Array.from({ length: 8 }).map((_, i) => ({
    id: `ph-${i}`,
    title: `Featured Event (TBA)`,
    date: "9999-12-31",
    time: "",
    image_url: "/images/placeholder.png",
  }));

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
        <div style={{ color: "#fff", fontSize: 26, fontWeight: 800, lineHeight: 1 }}>
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
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
    <div className="page-wrapper" style={{ background: "#000" }}>
      {/* PAGE HEADER */}
      <header className="event-hero" style={{ background: "#000" }}>
        <div className="overlay">
          <h1>Upcoming Vinyl Nights</h1>
        </div>
      </header>

      <main className="event-body" style={{ padding: 0, background: "#000" }}>
        {loading ? (
          <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#fff" }}>Loading…</div>
        ) : (
          <div data-secwrap="sections">
            {/* SECTION 1 — UP NEXT */}
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
                    gridTemplateColumns: upNext.length === 1 ? "1fr" : "repeat(2,1fr)",
                    gap: "1.75rem",
                  }}
                >
                  {(upNext.length ? upNext : [0, 1].slice(0, 1)).map((e, i) => {
                    const ev = e || {
                      id: `placeholder-upnext-${i}`,
                      title: "Featured Event (TBA)",
                      date: "9999-12-31",
                      image_url: "/images/placeholder.png",
                    };
                    const img = ev.image_url || "/images/placeholder.png";
                    const d = compactDate(ev.date);
                    const tba = !ev.date || ev.date === "9999-12-31";
                    return (
                      <Link
                        key={ev.id}
                        href={e ? `/events/event-detail/${ev.id}` : "#"}
                        style={{ textDecoration: "none" }}
                      >
                        <div
                          style={{
                            background: "#222",
                            borderRadius: 12,
                            overflow: "hidden",
                            border: "3px solid #00c4ff",
                            transition: "transform .25s ease, box-shadow .25s ease",
                          }}
                          onMouseOver={(x) => {
                            x.currentTarget.style.transform = "translateY(-6px)";
                            x.currentTarget.style.boxShadow =
                              "0 14px 36px rgba(0,196,255,.35)";
                          }}
                          onMouseOut={(x) => {
                            x.currentTarget.style.transform = "translateY(0)";
                            x.currentTarget.style.boxShadow = "none";
                          }}
                        >
                          <div style={{ position: "relative", width: "100%", paddingTop: "56.25%" }}>
                            <Image
                              src={img}
                              alt={ev.title}
                              fill
                              sizes="(max-width:900px) 100vw, 700px"
                              style={{ objectFit: "cover" }}
                              unoptimized
                            />
                          </div>
                          <div style={{ padding: "1.5rem 1.25rem 1.75rem" }}>
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
                              {tba ? "TBA" : `${d.wk} ${d.mon} ${d.day}`}
                            </div>
                            <h3
                              style={{
                                color: "#fff",
                                fontSize: "1.9rem",
                                fontWeight: 900,
                                lineHeight: 1.2,
                                margin: 0,
                              }}
                              dangerouslySetInnerHTML={{ __html: formatEventText(ev.title) }}
                            />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* SECTION 2 — 4‑COLUMN GRID (PLACEHOLDERS ONLY) */}
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
                  {placeholderGrid.map((e) => {
                    const img = e.image_url;
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
                          transition: "transform .2s ease, border-color .2s ease",
                        }}
                        onMouseOver={(x) => {
                          x.currentTarget.style.transform = "translateY(-4px)";
                          x.currentTarget.style.borderColor = "#00c4ff";
                        }}
                        onMouseOut={(x) => {
                          x.currentTarget.style.transform = "translateY(0)";
                          x.currentTarget.style.borderColor = "#262626";
                        }}
                      >
                        <div style={{ position: "relative", width: "100%", paddingTop: "100%" }}>
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
                            dangerouslySetInnerHTML={{ __html: formatEventText(e.title) }}
                          />
                          <div
                            style={{
                              color: "#00d9ff",
                              fontWeight: 800,
                              fontSize: ".92rem",
                            }}
                          >
                            {`${d.mon} ${d.day}`}
                          </div>
                        </div>
                        {/* Buttons intentionally removed per request */}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* SECTION 3 — UPCOMING SHOWS */}
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
                  {/* LEFT: ALL EVENTS as vertical rows */}
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
                              gridTemplateColumns: "100px 150px 1fr auto",
                              gap: "1rem",
                              alignItems: "center",
                              background: "#151515",
                              padding: "1rem",
                              borderBottom: "1px solid #262626",
                              transition: "background .2s ease, border-left-color .2s ease",
                            }}
                            onMouseOver={(x) => {
                              x.currentTarget.style.background = "#1f1f1f";
                              x.currentTarget.style.borderLeft = "4px solid #00c4ff";
                            }}
                            onMouseOut={(x) => {
                              x.currentTarget.style.background = "#151515";
                              x.currentTarget.style.borderLeft = "none";
                            }}
                          >
                            <DateBox date={e.date} />

                            <div style={{ position: "relative", width: 150, height: 150, borderRadius: 6, overflow: "hidden" }}>
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
                                dangerouslySetInnerHTML={{ __html: formatEventText(e.title) }}
                              />
                              {e.location ? (
                                <div style={{ color: "#9aa3ad", fontSize: ".9rem", marginTop: ".35rem" }}>
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

                  {/* RIGHT: 350px sidebar */}
                  <aside
                    style={{
                      background: "#121212",
                      border: "2px solid #262626",
                      borderRadius: 12,
                      padding: "1.25rem",
                      alignSelf: "start",
                    }}
                  >
                    {/* Just Announced */}
                    <div
                      style={{
                        background: "linear-gradient(90deg,#00c4ff,#34dfff)",
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

                    <div style={{ display: "flex", flexDirection: "column", gap: ".85rem", marginBottom: "1.25rem" }}>
                      {events.slice(0, 6).map((e, idx) => {
                        const d = compactDate(e.date);
                        const tba = !e.date || e.date === "9999-12-31";
                        const styles = [
                          { bg: "#1e293b", border: "#334155" },
                          { bg: "#1b1b1b", border: "#2b2b2b" },
                          { bg: "#1f2937", border: "#334155" },
                          { bg: "#1a1f2a", border: "#2e3a4a" },
                          { bg: "#222222", border: "#333333" },
                          { bg: "#202a36", border: "#314255" },
                        ];
                        const theme = styles[idx % styles.length];
                        return (
                          <Link key={e.id} href={`/events/event-detail/${e.id}`} style={{ textDecoration: "none" }}>
                            <div
                              style={{
                                background: theme.bg,
                                border: `1px solid ${theme.border}`,
                                borderRadius: 10,
                                padding: ".9rem",
                                transition: "transform .15s ease, box-shadow .15s ease",
                                boxShadow: "0 4px 16px rgba(0,0,0,.25)",
                              }}
                              onMouseOver={(x) => {
                                x.currentTarget.style.transform = "translateY(-2px)";
                                x.currentTarget.style.boxShadow = "0 10px 28px rgba(0,196,255,.18)";
                              }}
                              onMouseOut={(x) => {
                                x.currentTarget.style.transform = "translateY(0)";
                                x.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.25)";
                              }}
                            >
                              <h4
                                style={{
                                  color: "#fff",
                                  fontSize: "1rem",
                                  fontWeight: 800,
                                  lineHeight: 1.25,
                                  margin: "0 0 .35rem",
                                }}
                                dangerouslySetInnerHTML={{ __html: formatEventText(e.title) }}
                              />
                              <div style={{ color: "#00d9ff", fontSize: ".85rem", fontWeight: 800 }}>
                                {tba ? "TBA" : `${d.wk}, ${d.mon} ${d.day}`}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>

                    {/* Small box: Booking */}
                    <div style={{ background: "#151515", border: "1px solid #2b2b2b", borderRadius: 10, padding: "1rem", marginBottom: "1rem" }}>
                      <h4 style={{ color: "#fff", margin: "0 0 .5rem", fontWeight: 800 }}>Book Dead Wax Dialogues</h4>
                      <a
                        href="https://calendly.com/deadwaxdialogues"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-block",
                          background: "#00c4ff",
                          color: "#000",
                          padding: ".5rem .8rem",
                          borderRadius: 6,
                          fontWeight: 900,
                          textDecoration: "none",
                        }}
                      >
                        📅 Book Online
                      </a>
                    </div>

                    {/* Small box: Latest DJ Mix */}
                    {latestSet && (
                      <div style={{ background: "#0f172a", border: "1px solid #1f2a44", borderRadius: 10, padding: "1rem", marginBottom: "1rem" }}>
                        <h4 style={{ color: "#fff", margin: "0 0 .35rem", fontWeight: 800 }}>Latest DJ Mix</h4>
                        <div style={{ color: "#9ca3af", fontSize: ".9rem", marginBottom: ".6rem" }}>{latestSet.title}</div>
                        <div style={{ display: "flex", gap: ".5rem" }}>
                          <a
                            href={latestSet.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ background: "#fff", color: "#000", padding: ".45rem .75rem", borderRadius: 6, textDecoration: "none", fontWeight: 800 }}
                          >
                            ▶ Play
                          </a>
                          <a
                            href={latestSet.download_url || latestSet.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ background: "#059669", color: "#fff", padding: ".45rem .75rem", borderRadius: 6, textDecoration: "none", fontWeight: 800 }}
                          >
                            ⬇ Download
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Small box: Merch placeholder */}
                    <div style={{ background: "#1f1f1f", border: "1px solid #333", borderRadius: 10, padding: "1rem" }}>
                      <h4 style={{ color: "#fff", margin: "0 0 .5rem", fontWeight: 800 }}>Merch</h4>
                      <div style={{ color: "#9ca3af", fontSize: ".9rem", marginBottom: ".6rem" }}>
                        Shirts, stickers & more — coming soon.
                      </div>
                      <Link
                        href="/merch"
                        style={{ display: "inline-block", background: "#00c4ff", color: "#000", padding: ".45rem .75rem", borderRadius: 6, textDecoration: "none", fontWeight: 800 }}
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