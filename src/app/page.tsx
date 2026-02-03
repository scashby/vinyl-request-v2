// src/app/page.tsx
// Home page ("/") — Landing for Dead Wax Dialogues

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "src/components/AuthProvider";
import { supabase } from "src/lib/supabaseClient";
import { formatEventText } from "src/utils/textFormatter";
import { Container } from "components/ui/Container";

interface Event {
  id: number;
  title: string;
  date: string;
  created_at?: string;
  location?: string;
  image_url?: string;
  is_featured_grid?: boolean;
  featured_priority?: number | string | null;
  allowed_tags?: string[] | string | null;
}

interface EventTheme {
  accent: string;
  accentSoft: string;
  border: string;
  glow: string;
  cardBg: string;
  badgeText: string;
}

const DEFAULT_THEME: EventTheme = {
  accent: "rgb(0, 196, 255)",
  accentSoft: "rgba(0, 196, 255, 0.25)",
  border: "rgba(0, 196, 255, 0.45)",
  glow: "rgba(0, 196, 255, 0.35)",
  cardBg: "linear-gradient(135deg, rgba(0,196,255,0.18), rgba(6,6,10,0.95))",
  badgeText: "#051014",
};

const EVENT_TYPE_TAG_PREFIX = "event_type:";

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .replace(/[{}]/g, "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const getTagValue = (tags: string[], prefix: string): string => {
  const match = tags.find((tag) => tag.startsWith(prefix));
  return match ? match.replace(prefix, "") : "";
};

const getDisplayTitle = (event: Event): string => {
  const tags = normalizeStringArray(event.allowed_tags);
  const eventType = getTagValue(tags, EVENT_TYPE_TAG_PREFIX);
  if (eventType === "private-dj") return "Private Event";
  return event.title;
};

const getLuminance = (r: number, g: number, b: number) => {
  const srgb = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
};

const buildTheme = (r: number, g: number, b: number): EventTheme => {
  const accent = `rgb(${r}, ${g}, ${b})`;
  const accentSoft = `rgba(${r}, ${g}, ${b}, 0.25)`;
  const border = `rgba(${r}, ${g}, ${b}, 0.45)`;
  const glow = `rgba(${r}, ${g}, ${b}, 0.35)`;
  const cardBg = `linear-gradient(135deg, rgba(${r}, ${g}, ${b}, 0.22), rgba(6,6,10,0.95))`;
  const badgeText = getLuminance(r, g, b) > 0.6 ? "#0b0b0f" : "#f8fafc";
  return { accent, accentSoft, border, glow, cardBg, badgeText };
};

const sampleImageColor = (url: string): Promise<EventTheme | null> =>
  new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = url;

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 24;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha < 64) continue;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count += 1;
        }
        if (count === 0) {
          resolve(null);
          return;
        }
        resolve(buildTheme(Math.round(r / count), Math.round(g / count), Math.round(b / count)));
      } catch (error) {
        console.warn("Unable to sample event image color.", error);
        resolve(null);
      }
    };

    img.onerror = () => resolve(null);
  });

export default function Page() {
  const { session } = useSession();
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventThemes, setEventThemes] = useState<Record<number, EventTheme>>({});

  // Consistent button style: Muted zinc with subtle hover and backdrop blur
  const buttonClass = "px-6 py-3 bg-zinc-900/80 text-zinc-100 rounded-full font-medium hover:bg-zinc-800 hover:text-white transition-all duration-300 backdrop-blur-sm border border-white/5 hover:border-white/20 shadow-lg";

  useEffect(() => {
    const loadEvents = async () => {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 5000)
      );

      try {
        const fetchEvents = supabase
          .from("events")
          .select("*")
          .order("date", { ascending: true });

        const { data: ev, error } = (await Promise.race([
          fetchEvents,
          timeoutPromise,
        ])) as { data: Event[] | null; error: { message?: string } | null };

        if (error) {
          console.error("Error loading events", error);
        }

        setEvents(ev || []);
      } catch (err) {
        console.error("Unexpected error loading landing events:", err);
      } finally {
        setLoadingEvents(false);
      }
    };

    loadEvents();
  }, []);

  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const filtered = events.filter((event) => {
      const date = event.date;
      if (!date || date === "" || date === "9999-12-31") return true;
      return date >= today;
    });

    const sorted = [...filtered].sort((a, b) => {
      const aTba = !a.date || a.date === "" || a.date === "9999-12-31";
      const bTba = !b.date || b.date === "" || b.date === "9999-12-31";
      if (aTba && !bTba) return 1;
      if (!aTba && bTba) return -1;
      if (aTba && bTba) return 0;
      return (a.date || "").localeCompare(b.date || "");
    });

    return sorted.slice(0, 10);
  }, [events]);

  const featuredEvents = useMemo(() => {
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

    return byFeatured(events.filter((event) => event.is_featured_grid)).slice(
      0,
      8
    );
  }, [events]);

  const justAddedEvents = useMemo(() => {
    const sorted = [...events].sort((a, b) => {
      const at = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bt - at;
    });
    return sorted.slice(0, 6);
  }, [events]);

  useEffect(() => {
    let isActive = true;
    const hydrateThemes = async () => {
      const targets = [...upcomingEvents, ...justAddedEvents, ...featuredEvents];
      const entries = await Promise.all(
        targets.map(async (event) => {
          if (!event.image_url) return [event.id, null] as const;
          const theme = await sampleImageColor(event.image_url);
          return [event.id, theme] as const;
        })
      );

      if (!isActive) return;
      setEventThemes((prev) => {
        const next = { ...prev };
        entries.forEach(([id, theme]) => {
          if (theme) {
            next[id] = theme;
          }
        });
        return next;
      });
    };

    if (upcomingEvents.length || featuredEvents.length) {
      hydrateThemes();
    }

    return () => {
      isActive = false;
    };
  }, [upcomingEvents, justAddedEvents, featuredEvents]);

  const compactDate = (dateString?: string) => {
    if (!dateString || dateString === "9999-12-31") {
      return { mon: "TBA", day: "", wk: "" };
    }
    const d = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(d.getTime())) {
      return { mon: "TBA", day: "", wk: "" };
    }
    return {
      mon: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
      day: d.getDate(),
      wk: d.toLocaleDateString("en-US", {
        weekday: "short",
      }).toUpperCase(),
    };
  };

  const tickerItems = useMemo(() => {
    const ids = new Set<number>();
    const items: Event[] = [];
    const addItems = (list: Event[]) => {
      list.forEach((event) => {
        if (ids.has(event.id)) return;
        ids.add(event.id);
        items.push(event);
      });
    };
    addItems(upcomingEvents.slice(0, 8));
    addItems(justAddedEvents.slice(0, 6));
    addItems(featuredEvents.slice(0, 6));
    return items;
  }, [upcomingEvents, justAddedEvents, featuredEvents]);

  return (
    <div className="min-h-screen font-sans bg-black flex flex-col justify-between">
      <header className="relative z-0 h-screen flex items-center justify-center text-center overflow-hidden">
        <video 
          autoPlay 
          muted 
          loop 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover -z-10 brightness-[0.4]"
        >
          <source src="/videos/header-video.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        <div className="relative z-10 p-8 max-w-4xl mx-auto">
          <h1 className="font-serif-display text-5xl md:text-7xl text-white mb-4 drop-shadow-lg tracking-tight">
            Dead Wax Dialogues
          </h1>
          <p className="text-xl md:text-2xl font-light text-zinc-300 mb-10 drop-shadow-md">
            A vinyl-focused listening lounge, jukebox, and community.
          </p>

          <nav className="flex gap-4 justify-center flex-wrap mt-8">
            <Link href="/about" className={buttonClass}>
              About
            </Link>
            <Link href="/events/events-page" className={buttonClass}>
              Events
            </Link>
            <Link href="/dj-sets" className={buttonClass}>
              DJ Sets
            </Link>
            <Link href="/dialogues" className={buttonClass}>
              Dialogues
            </Link>
            <Link href="/merch" className={buttonClass}>
              Merch
            </Link>

            {/* Original Admin button - only shows if Supabase session is active */}
            {session && (
              <Link
                href="/admin/admin-dashboard"
                className="px-6 py-3 bg-blue-900/40 text-blue-200 rounded-full font-medium hover:bg-blue-800/60 transition-colors backdrop-blur-sm border border-blue-400/20"
              >
                Admin
              </Link>
            )}
          </nav>
        </div>

      </header>

      {/* Invisible Admin Link: 
        Hidden in the bottom-left corner. 
        No visual footprint, but cursor changes to pointer on hover.
      */}
      <Link 
        href="/admin/" 
        className="fixed bottom-16 left-0 w-8 h-8 opacity-0 cursor-default hover:cursor-pointer z-50"
        aria-hidden="true"
        title="Admin Access"
      >
        .
      </Link>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/70 backdrop-blur-md">
        <Container size="xl">
          <div className="flex items-center gap-3 py-3 text-white">
            <Link
              href="/events/events-page"
              className="text-xs uppercase tracking-[0.3em] font-semibold text-white/60 hover:text-white transition-colors"
            >
              Events
            </Link>
            <div className="h-3 w-px bg-white/20" />
            {loadingEvents ? (
              <div className="text-sm text-white/60">Loading upcoming events…</div>
            ) : (
              <div className="relative flex-1 overflow-hidden">
                <div className="ticker-track">
                  {[...tickerItems, ...tickerItems].map((event, index) => {
                    const date = compactDate(event.date);
                    const tba =
                      !event.date ||
                      event.date === "" ||
                      event.date === "9999-12-31";
                    const theme = eventThemes[event.id] || DEFAULT_THEME;
                    const displayTitle = getDisplayTitle(event);

                    return (
                      <Link
                        key={`${event.id}-${index}`}
                        href={`/events/event-detail/${event.id}`}
                        className="ticker-item group"
                      >
                        <span className="ticker-text">
                          <span
                            className="inline-flex items-center justify-center w-2 h-2 rounded-full mr-2"
                            style={{ background: theme.accent }}
                          />
                          <span
                            className="text-white/70 text-sm font-semibold"
                            style={{ color: theme.accent }}
                          >
                            {tba ? "TBA" : `${date.mon} ${date.day}`}
                          </span>
                          <span
                            className="text-white font-semibold ml-3"
                            dangerouslySetInnerHTML={{
                              __html: formatEventText(displayTitle),
                            }}
                          />
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Container>
        <style jsx>{`
          .ticker-track {
            display: flex;
            align-items: center;
            gap: 1.75rem;
            width: max-content;
            animation: ticker-scroll 40s linear infinite;
          }
          .ticker-track:hover {
            animation-play-state: paused;
          }
          .ticker-item {
            display: inline-flex;
            align-items: center;
            gap: 0.75rem;
            white-space: nowrap;
            padding-right: 1rem;
            color: inherit;
          }
          .ticker-item:hover .ticker-text {
            color: #fff;
          }
          .ticker-text {
            display: inline-flex;
            align-items: baseline;
            transition: color 0.2s ease;
          }
          @keyframes ticker-scroll {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-50%);
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .ticker-track {
              animation: none;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
