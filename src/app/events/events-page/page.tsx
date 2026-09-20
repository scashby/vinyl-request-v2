"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "src/lib/supabaseClient";
import { formatEventText } from "src/utils/textFormatter";
import { Container } from "components/ui/Container";
import { useActiveTheme } from "src/lib/useActiveTheme";
import {
  cropRectImageStyle,
  getImageCropFromTags,
  IMAGE_FOCUS_COVER_TAG_PREFIX,
  IMAGE_FOCUS_SQUARE_TAG_PREFIX,
} from "src/lib/imageCrop";

interface Event {
  id: number;
  title: string;
  date: string;
  location?: string;
  image_url?: string;
  image_url_square?: string;
  is_featured_grid?: boolean;
  featured_priority?: number | string | null;
  allowed_tags?: string[] | string | null;
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

const EVENT_TYPE_TAG_PREFIX = 'event_type:';
const CARD_TILT_VARS = ["--dwd-tilt-1", "--dwd-tilt-2", "--dwd-tilt-3", "--dwd-tilt-4"];

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value.replace(/[{}]/g, '').split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const getTagValue = (tags: string[], prefix: string): string => {
  const match = tags.find((tag) => tag.startsWith(prefix));
  return match ? match.replace(prefix, '') : '';
};

const getDisplayTitle = (event: Event): string => {
  const tags = normalizeStringArray(event.allowed_tags);
  const eventType = getTagValue(tags, EVENT_TYPE_TAG_PREFIX);
  if (eventType === 'private-dj') return 'Private Event';
  return event.title;
};


export default function Page() {
  const [events, setEvents] = useState<Event[]>([]);
  const [pastDJSets, setPastDJSets] = useState<DJSet[]>([]);
  const [loading, setLoading] = useState(true);
  const { cssVars } = useActiveTheme();

  useEffect(() => {
    const load = async () => {
      try {
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
        const filtered = all.filter((e: Event) => {
          const d = e.date;
          if (!d || d === "" || d === "9999-12-31") return true; // TBA
          return d >= today;
        });

        // Sort: dated first, by date; then TBA
        const sorted = [...filtered].sort((a: Event, b: Event) => {
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
          .limit(10000);

        if (setsError) {
          console.error("Error loading dj_sets", setsError);
        }

        setPastDJSets(sets || []);
      } catch (err) {
        console.error("Unexpected error loading events:", err);
      } finally {
        setLoading(false);
      }
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
      <div
        className="text-center min-w-[84px] p-2 bg-[var(--dwd-bg-card)] [border:var(--dwd-card-border)] rounded-lg"
      >
        <div className="text-[var(--dwd-accent-1)] text-[11px] font-extrabold tracking-widest mb-0.5">
          {tba ? "TBA" : d.wk}
        </div>
        <div className="text-3xl font-extrabold leading-none">
          {tba ? "" : d.day}
        </div>
        <div className="text-[var(--dwd-accent-1)] text-[11px] font-extrabold tracking-widest mt-0.5">
          {tba ? "" : d.mon}
        </div>
      </div>
    );
  };

  const SectionTitle = ({ text }: { text: string }) => (
    <div className="mb-6">
      <div className="flex items-center gap-3">
        <div className="w-3.5 h-3.5 rounded-sm rotate-45 bg-[var(--dwd-accent-1)]" />
        <h2 className="font-[family-name:var(--dwd-font-display)] [text-transform:var(--dwd-headline-transform)] text-3xl md:text-4xl m-0">
          {text}
        </h2>
      </div>
      <div className="h-1.5 w-44 rounded-full mt-3 bg-[var(--dwd-accent-1)]" />
    </div>
  );

  return (
    <div
      className="min-h-screen font-[family-name:var(--dwd-font-body)] bg-[var(--dwd-bg)] text-[var(--dwd-ink)]"
      style={cssVars}
    >
      <Container size="xl">
        <div className="pt-16 pb-10 md:pt-20">
          <div className="font-[family-name:var(--dwd-font-display)] [text-transform:var(--dwd-headline-transform)] text-4xl md:text-5xl mb-3">
            Upcoming Vinyl Nights
          </div>
          <p className="text-lg text-[var(--dwd-ink-soft)] max-w-xl">
            Every standing residency night, guest set, and private gig on the calendar.
          </p>
        </div>
      </Container>

      <main className="pb-20">
        {loading ? (
          <div className="py-12 text-center text-lg text-[var(--dwd-ink-faint)]">
            Loading&hellip;
          </div>
        ) : (
          <div data-secwrap="sections">
            {/* SECTION 1 — UP NEXT */}
            {upNext.length > 0 && (
              <section className="pb-4">
                <Container size="xl">
                  <SectionTitle text="Up Next" />

                  <div className={`grid gap-7 mb-4 ${upNext.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                    {upNext.map((ev, i) => {
                      const img =
                        ev.image_url || "/images/coverplaceholder.png";
                      const d = compactDate(ev.date);
                      const tba =
                        !ev.date ||
                        ev.date === "" ||
                        ev.date === "9999-12-31";
                      const displayTitle = getDisplayTitle(ev);
                      const coverCrop = getImageCropFromTags(
                        ev.allowed_tags,
                        IMAGE_FOCUS_COVER_TAG_PREFIX
                      );

                      return (
                        <Link
                          key={ev.id}
                          href={`/events/event-detail/${ev.id}`}
                          className="block group"
                        >
                          <div
                            className="overflow-hidden transition-transform duration-300 group-hover:!rotate-0 group-hover:-translate-y-1.5 bg-[var(--dwd-bg-card)] [border:var(--dwd-card-border)] [border-radius:var(--dwd-card-radius)] [box-shadow:var(--dwd-card-shadow)]"
                            style={{ transform: `rotate(var(${CARD_TILT_VARS[i % CARD_TILT_VARS.length]}))` }}
                          >
                            <div className="relative w-full aspect-video overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary crop rectangle needs raw left/top/width/height, which next/image's fill+object-fit can't express */}
                              <img src={img} alt={displayTitle} style={cropRectImageStyle(coverCrop)} />
                            </div>
                            <div className="p-6 pb-7">
                              <div
                                className="inline-block px-4 py-2.5 rounded-lg font-black mb-4"
                                style={
                                  tba
                                    ? { background: 'var(--dwd-ink-faint)', color: 'var(--dwd-bg)' }
                                    : { background: 'var(--dwd-accent-1)', color: 'var(--dwd-bg)' }
                                }
                              >
                                {tba ? "TBA" : `${d.wk} ${d.mon} ${d.day}`}
                              </div>
                              <h3
                                className="text-3xl font-black leading-tight m-0"
                                dangerouslySetInnerHTML={{
                                  __html: formatEventText(displayTitle),
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
              <section className="py-8">
                <Container size="xl">
                  <SectionTitle text="Featured" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    {featuredGrid.map((e) => {
                      const img = e.image_url_square || e.image_url || "/images/coverplaceholder.png";
                      const d = compactDate(e.date);
                      const tba = !e.date || e.date === "" || e.date === "9999-12-31";
                      const displayTitle = getDisplayTitle(e);
                      const squareCrop = getImageCropFromTags(
                        e.allowed_tags,
                        IMAGE_FOCUS_SQUARE_TAG_PREFIX
                      );

                      return (
                        <Link
                          key={e.id}
                          href={`/events/event-detail/${e.id}`}
                          className="block group"
                        >
                          <div className="overflow-hidden flex flex-col transition-all duration-200 group-hover:-translate-y-1 bg-[var(--dwd-bg-card)] [border:var(--dwd-card-border)] rounded-lg">
                            <div className="relative w-full pt-[100%] overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary crop rectangle needs raw left/top/width/height, which next/image's fill+object-fit can't express */}
                              <img src={img} alt={displayTitle} style={cropRectImageStyle(squareCrop)} />
                            </div>
                            <div className="p-4">
                              <h4
                                className="text-lg font-extrabold leading-tight min-h-[2.5rem] mb-2"
                                dangerouslySetInnerHTML={{ __html: formatEventText(displayTitle) }}
                              />
                              <div className="font-extrabold text-sm text-[var(--dwd-accent-1)]">
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
            <section className="py-8">
              <Container size="xl">
                <SectionTitle text="Upcoming Shows" />

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
                  {/* LEFT COLUMN: list of upcoming events */}
                  <div className="space-y-4">
                    {events.map((e) => {
                      const img =
                        e.image_url_square || e.image_url || "/images/coverplaceholder.png";
                      const displayTitle = getDisplayTitle(e);
                      const squareCrop = getImageCropFromTags(
                        e.allowed_tags,
                        IMAGE_FOCUS_SQUARE_TAG_PREFIX
                      );

                      return (
                        <Link
                          key={e.id}
                          href={`/events/event-detail/${e.id}`}
                          className="block group"
                        >
                          <div className="grid grid-cols-[100px_1fr] md:grid-cols-[100px_150px_1fr_auto] gap-4 items-center p-4 border-b border-l-4 border-l-transparent transition-colors duration-200 bg-[var(--dwd-bg-card)] border-[var(--dwd-ink)]/10 hover:border-l-[var(--dwd-accent-1)]">
                            <DateBox date={e.date} />

                            <div className="relative w-full h-[150px] rounded-md overflow-hidden hidden md:block">
                              {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary crop rectangle needs raw left/top/width/height, which next/image's fill+object-fit can't express */}
                              <img src={img} alt={displayTitle} style={cropRectImageStyle(squareCrop)} />
                            </div>

                            <div className="min-w-0 col-span-1 md:col-span-1">
                              <h3
                                className="text-xl font-extrabold leading-tight mb-1"
                                dangerouslySetInnerHTML={{ __html: formatEventText(displayTitle) }}
                              />
                              {e.location && (
                                <div className="text-sm mt-1 text-[var(--dwd-ink-faint)]">
                                  {e.location}
                                </div>
                              )}
                            </div>

                            <div className="hidden md:block">
                              <span className="px-4 py-2 rounded-full font-black text-sm uppercase whitespace-nowrap bg-[var(--dwd-accent-1)] text-[var(--dwd-bg)]">
                                More Info
                              </span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>

                  {/* RIGHT COLUMN: Just Announced + ads */}
                  <aside className="p-5 self-start bg-[var(--dwd-bg-card)] [border:var(--dwd-card-border)] [border-radius:var(--dwd-card-radius)]">
                    {/* Just Announced header */}
                    <div className="p-2.5 rounded-lg text-center font-black tracking-wide uppercase mb-4 bg-[var(--dwd-accent-1)] text-[var(--dwd-bg)]">
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
                        const displayTitle = getDisplayTitle(e);
                        const accentVar = ["--dwd-accent-1", "--dwd-accent-2", "--dwd-accent-3"][idx % 3];

                        return (
                          <Link
                            key={e.id}
                            href={`/events/event-detail/${e.id}`}
                            className="block group"
                          >
                            <div
                              className="relative p-4 overflow-hidden transition-transform duration-150 group-hover:-translate-y-0.5 bg-[var(--dwd-bg)] [border:var(--dwd-card-border)] rounded-lg"
                            >
                              <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: `var(${accentVar})` }} />
                              <h4
                                className="text-base font-black leading-tight mb-2 pl-2"
                                dangerouslySetInnerHTML={{
                                  __html: formatEventText(displayTitle),
                                }}
                              />
                              <div className="flex items-center gap-2 pl-2">
                                <div
                                  className="font-black text-xs rounded-full px-2.5 py-1 min-w-[72px] inline-flex items-center justify-center text-center"
                                  style={{ background: `var(${accentVar})`, color: 'var(--dwd-bg)' }}
                                >
                                  {tba
                                    ? "TBA"
                                    : `${d.wk} ${d.mon} ${d.day}`}
                                </div>
                                <div className="text-xs text-[var(--dwd-ink-faint)]">
                                  {e.location || "New date added"}
                                </div>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>

                    {/* AD: Book DJ Gigs */}
                    <div className="p-4 mb-4 bg-[var(--dwd-accent-3)] [border:var(--dwd-card-border)] rounded-2xl">
                      <div className="text-[1.4rem] font-black uppercase tracking-[1.5px] text-[var(--dwd-ink)]">
                        Book DJ Gigs
                      </div>
                      <div className="opacity-80 my-2 font-bold text-[var(--dwd-ink)]">
                        Parties &middot; Breweries &middot; Pop-ups
                      </div>
                      <a
                        href="https://calendly.com/deadwaxdialogues"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-4 py-3 rounded-full font-black transition-colors bg-[var(--dwd-ink)] text-[var(--dwd-bg)] hover:opacity-90"
                      >
                        Book Online
                      </a>
                    </div>

                    {/* AD: Latest DJ Sets */}
                    {latestSet && (
                      <div className="p-5 mb-4 bg-[var(--dwd-ink)] rounded-2xl">
                        <div className="font-black uppercase tracking-wider text-[var(--dwd-accent-2)]">
                          Latest DJ Sets
                        </div>
                        <div className="my-2 font-medium truncate text-[var(--dwd-bg)]">
                          {latestSet.title}
                        </div>
                        <div className="flex gap-2.5">
                          <a
                            href={latestSet.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-2 rounded-full font-black transition-opacity hover:opacity-90 bg-[var(--dwd-accent-1)] text-[var(--dwd-bg)]"
                          >
                            Play
                          </a>
                          <a
                            href={latestSet.download_url || latestSet.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-2 rounded-full font-black border transition-colors text-[var(--dwd-bg)] border-[var(--dwd-bg)]/25 hover:bg-[var(--dwd-bg)]/10"
                          >
                            Download
                          </a>
                        </div>
                      </div>
                    )}

                    {/* AD: Merch */}
                    <div className="p-5 bg-[var(--dwd-accent-2)] rounded-2xl">
                      <div className="text-[1.35rem] font-black tracking-widest uppercase mb-1.5 text-[var(--dwd-bg)]">
                        Merch
                      </div>
                      <div className="text-sm mb-3 opacity-90 text-[var(--dwd-bg)]">
                        New designs / styles — new deals. Check it out!
                      </div>
                      <Link
                        href="/merch"
                        className="inline-block px-3.5 py-2.5 rounded-lg font-black text-sm transition-opacity hover:opacity-90 bg-[var(--dwd-bg)] text-[var(--dwd-ink)]"
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
