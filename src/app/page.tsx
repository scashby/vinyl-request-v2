// src/app/page.tsx
// Home page ("/") — Landing for Dead Wax Dialogues

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SiSpotify } from "react-icons/si";
import { supabase } from "src/lib/supabaseClient";
import { formatEventText } from "src/utils/textFormatter";
import { Container } from "components/ui/Container";
import { socials } from "src/components/Footer";

interface Event {
  id: number;
  title: string;
  date: string;
  created_at?: string;
  location?: string;
  image_url?: string;
  allowed_tags?: string[] | string | null;
}

interface BlogPost {
  title: string;
  link: string;
  guid?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  "content:encoded"?: string;
}

interface Playlist {
  id: number;
  platform: string;
  embed_html?: string;
  embed_url?: string;
  visible: boolean;
}

const EVENT_TYPE_TAG_PREFIX = "event_type:";
const RESIDENCY_VENUE = "Devil's Purse Brewery";
const RESIDENCY_NIGHT = "Sunday";
const RESIDENCY_MAP_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(RESIDENCY_VENUE)}`;

// Rotation/shadow "pinned flyer" treatment, cycled across each grid of cards.
const CARD_TILTS = ["-rotate-[1.2deg]", "rotate-1", "-rotate-[0.6deg]", "rotate-[1.4deg]"];

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

const compactDate = (dateString?: string) => {
  if (!dateString || dateString === "" || dateString === "9999-12-31") {
    return "TBA";
  }
  const d = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "TBA";
  return d
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
};

const extractFirstImg = (post: BlogPost): string | null => {
  const html = post["content:encoded"] || post.content || "";
  const match = html.match(/<img[^>]+src=["']([^"'>]+)["']/i);
  return match ? match[1] : null;
};

export default function Page() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const fetchEvents = async () =>
          supabase.from("events").select("*").order("date", { ascending: true });

        let { data: ev, error } = await fetchEvents();

        // Retry once on transient server-side failures so brief Supabase pressure
        // does not surface as a hard empty/failed landing load.
        if (error) {
          const status =
            typeof (error as unknown as { status?: number }).status === "number"
              ? (error as unknown as { status?: number }).status
              : 0;
          if (status >= 500 || status === 0) {
            await new Promise((resolve) => setTimeout(resolve, 1200));
            const retry = await fetchEvents();
            ev = retry.data;
            error = retry.error;
          }
        }

        if (error) {
          console.error("Error loading events", {
            message: error.message,
            details: (error as unknown as { details?: string }).details,
            hint: (error as unknown as { hint?: string }).hint,
            code: (error as unknown as { code?: string }).code,
          });
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

  useEffect(() => {
    fetch("/api/wordpress")
      .then((res) => res.json())
      .then((data) => {
        if (!data.items || !Array.isArray(data.items)) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: BlogPost[] = data.items.map((p: any) => ({
          ...p,
          link: p.guid || p.link,
        }));
        setPosts(items.slice(0, 3));
      })
      .catch((err) => console.error("Error loading Dialogues posts:", err));
  }, []);

  useEffect(() => {
    fetch("/api/playlists")
      .then((res) => res.json())
      .then((data: Playlist[]) => setPlaylists(data ?? []))
      .catch((err) => console.error("Error loading playlists:", err));
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

    return sorted.slice(0, 4);
  }, [events]);

  const spotifyPlaylist = useMemo(
    () => playlists.find((p) => p.platform?.toLowerCase() === "spotify" && p.visible),
    [playlists]
  );

  return (
    <div className="min-h-screen font-[family-name:var(--font-work-sans)] bg-[#FAF1E1] text-[#2A2118]">

      {/* HERO */}
      <Container size="xl">
        <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16 py-16 md:py-24">
          <div className="flex-1 min-w-0">
            <div className="inline-block border-2 border-dashed border-[#C1502E] rounded-md px-4 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[#C1502E] mb-6 -rotate-1">
              Spinning 70s&ndash;90s &middot; {RESIDENCY_VENUE}
            </div>
            <h1 className="font-[family-name:var(--font-alfa-slab)] text-4xl sm:text-5xl md:text-6xl leading-[1.08] mb-6 text-[#2A2118]">
              The needle drops every {RESIDENCY_NIGHT}.
            </h1>
            <p className="text-lg md:text-xl leading-relaxed text-[#4A3D2C] max-w-xl mb-9">
              Pop, rock, and dance cuts from the 70s through the 90s &mdash; played warm, played loud enough, never shouted at you once.
            </p>
            <div className="flex gap-4 flex-wrap">
              <Link
                href="/events/events-page"
                className="px-7 py-3.5 bg-[#C1502E] text-[#FAF1E1] rounded-full font-bold text-sm hover:bg-[#9C3F22] transition-colors"
              >
                See Upcoming Nights
              </Link>
              <Link
                href="/about"
                className="px-7 py-3.5 bg-transparent text-[#2A2118] rounded-full font-bold text-sm border-2 border-[#2A2118] hover:opacity-65 transition-opacity"
              >
                Book a Private Event
              </Link>
            </div>
          </div>
          <div className="flex-1 min-w-0 w-full max-w-md md:max-w-none relative pt-3">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[18px] h-[18px] rounded-full bg-[#2F7A78] border-2 border-[#2A2118] z-10" />
            <div
              className="w-full aspect-[4/5] rounded-2xl border-[3px] border-[#2A2118] flex items-center justify-center overflow-hidden rotate-[1.2deg]"
              style={{
                background:
                  "repeating-linear-gradient(135deg, #EFC98A, #EFC98A 18px, #E8A93C 18px, #E8A93C 36px)",
                boxShadow: "10px 10px 0 rgba(42,33,24,0.12)",
              }}
            >
              <div className="absolute inset-[18px] rounded-xl bg-[#FAF1E1]/90 flex items-center justify-center text-center p-6">
                <span className="text-sm font-bold uppercase tracking-wider text-[#8F3A1F]">
                  Photo coming soon &mdash; Steve at the decks, {RESIDENCY_VENUE}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Container>

      {/* RESIDENCY CALLOUT */}
      <Container size="xl">
        <div
          className="relative bg-[#4FB8E8] rounded-xl px-8 py-10 md:px-16 md:py-14 flex items-center justify-between gap-8 flex-wrap -rotate-[0.6deg] mb-16 md:mb-20"
          style={{ boxShadow: "10px 10px 0 rgba(42,33,24,0.14)" }}
        >
          <div className="absolute -top-3.5 left-14 w-6 h-6 rounded-full bg-[#E8A93C] border-2 border-[#2A2118]" />
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#2A2118]/60 mb-3">
              The Residency
            </div>
            <div className="font-[family-name:var(--font-alfa-slab)] text-2xl md:text-4xl text-[#2A2118] leading-tight">
              Every {RESIDENCY_NIGHT} &mdash; {RESIDENCY_VENUE}
            </div>
            <div className="text-sm text-[#2A2118]/70 mt-3 max-w-md">
              Same bar, same crate of records, same good time. Pull up a stool and put in a request.
            </div>
          </div>
          <a
            href={RESIDENCY_MAP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-7 py-3.5 bg-[#2A2118] text-[#FAF1E1] rounded-full font-bold text-sm whitespace-nowrap hover:opacity-90 transition-opacity"
          >
            Get Directions
          </a>
        </div>
      </Container>

      {/* COMING UP */}
      <Container size="xl">
        <div className="mb-16 md:mb-20">
          <div className="flex items-baseline justify-between mb-7">
            <div className="font-[family-name:var(--font-alfa-slab)] text-2xl md:text-3xl text-[#2A2118]">
              Coming Up
            </div>
            <Link href="/events/events-page" className="text-sm font-bold text-[#C1502E] hover:text-[#8F3A1F]">
              Full calendar &rarr;
            </Link>
          </div>

          {loadingEvents ? (
            <div className="text-[#6B5B45]">Loading upcoming nights&hellip;</div>
          ) : upcomingEvents.length === 0 ? (
            <div className="text-[#6B5B45]">
              Nothing on the calendar yet &mdash; check back soon, or catch the standing {RESIDENCY_NIGHT} residency at {RESIDENCY_VENUE}.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {upcomingEvents.map((event, i) => (
                <Link
                  key={event.id}
                  href={`/events/event-detail/${event.id}`}
                  className={`group bg-white border-2 border-[#2A2118] rounded-[10px] p-6 transition-transform duration-150 hover:!rotate-0 hover:-translate-y-1 ${CARD_TILTS[i % CARD_TILTS.length]}`}
                  style={{ boxShadow: "6px 6px 0 rgba(42,33,24,0.10)" }}
                >
                  <div className="text-xs font-bold uppercase tracking-wider text-[#C1502E] mb-2.5">
                    {compactDate(event.date)}
                  </div>
                  <div
                    className="text-[17px] font-bold mb-1.5 leading-snug"
                    dangerouslySetInnerHTML={{ __html: formatEventText(getDisplayTitle(event)) }}
                  />
                  <div className="text-sm text-[#6B5B45]">{event.location || RESIDENCY_VENUE}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Container>

      {/* BIO */}
      <Container size="xl">
        <div className="flex flex-col sm:flex-row gap-8 items-start mb-16 md:mb-20">
          <div className="w-full sm:w-[220px] flex-shrink-0 text-xs font-bold uppercase tracking-[0.14em] text-[#2F7A78]">
            The Short Version
          </div>
          <p className="flex-1 text-xl md:text-[22px] leading-relaxed max-w-3xl">
            Steve&rsquo;s been building crossfades since he was taping songs off the radio as a kid. These days you&rsquo;ll find him behind the decks at {RESIDENCY_VENUE}, spinning the deep cuts and just-as-good B-sides from the 70s through the 90s &mdash; pop, rock, a little disco, always danceable.
          </p>
        </div>
      </Container>

      {/* VINYL GAME DECK TEASER */}
      <Container size="xl">
        <div
          className="relative bg-[#6E7F5C] rounded-2xl px-8 py-10 md:px-16 md:py-14 flex items-center gap-10 flex-wrap rotate-[0.5deg] mb-16 md:mb-20"
          style={{ boxShadow: "10px 10px 0 rgba(42,33,24,0.10)" }}
        >
          <div className="absolute -top-3.5 right-16 w-6 h-6 rounded-full bg-[#C1502E] border-2 border-[#2A2118]" />
          <div className="flex-1 min-w-[280px]">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#FAF1E1]/85 mb-3.5">
              Things To Do At A Dead Wax Night
            </div>
            <div className="font-[family-name:var(--font-alfa-slab)] text-2xl md:text-[30px] text-[#FAF1E1] mb-3.5">
              Bring a team. We brought the games.
            </div>
            <p className="text-base leading-relaxed text-[#FAF1E1]/90 max-w-md mb-5">
              Vinyl Game Deck turns the night into a party &mdash; right alongside the set, no extra cover charge.
            </p>
            <div className="flex gap-2.5 flex-wrap mb-6">
              {["Vinyl Bingo", "Cover Art Clue Chase", "Decade Dash"].map((name) => (
                <span key={name} className="bg-[#FAF1E1] text-[#2A2118] px-4 py-2 rounded-full text-[13px] font-bold">
                  {name}
                </span>
              ))}
            </div>
            <Link
              href="/games"
              className="inline-block px-6 py-3.5 bg-[#C1502E] text-[#FAF1E1] rounded-full font-bold text-sm hover:bg-[#9C3F22] transition-colors"
            >
              Explore Vinyl Game Deck &rarr;
            </Link>
          </div>
          <div className="w-full sm:w-[280px] h-[180px] sm:h-[200px] flex-shrink-0 rounded-xl bg-[#FAF1E1] border-[3px] border-[#2A2118] flex items-center justify-center text-center p-4 -rotate-[1.8deg]">
            <span className="text-[13px] font-bold uppercase tracking-wider text-[#8F3A1F]">
              Photo coming soon &mdash; Vinyl Bingo on a brewery table
            </span>
          </div>
        </div>
      </Container>

      {/* DIALOGUES TEASER */}
      {posts.length > 0 && (
        <Container size="xl">
          <div className="mb-16 md:mb-20">
            <div className="flex items-baseline justify-between mb-7">
              <div className="font-[family-name:var(--font-alfa-slab)] text-2xl md:text-3xl text-[#2A2118]">
                From The Dialogues
              </div>
              <Link href="/dialogues" className="text-sm font-bold text-[#C1502E] hover:text-[#8F3A1F]">
                Read more &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {posts.map((post, i) => (
                <a
                  key={post.guid || post.link}
                  href={post.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group block bg-white border-2 border-[#2A2118] rounded-xl overflow-hidden transition-transform duration-150 hover:!rotate-0 hover:-translate-y-1 ${CARD_TILTS[i % CARD_TILTS.length]}`}
                  style={{ boxShadow: "6px 6px 0 rgba(42,33,24,0.08)" }}
                >
                  <div
                    className="h-[150px] bg-[#D8C9AE] bg-cover bg-center"
                    style={
                      extractFirstImg(post)
                        ? { backgroundImage: `url(${extractFirstImg(post)})` }
                        : undefined
                    }
                  />
                  <div className="p-5">
                    <div className="text-base font-bold mb-2 leading-snug line-clamp-2">{post.title}</div>
                    <div className="text-sm text-[#6B5B45] leading-relaxed line-clamp-3">
                      {post.contentSnippet || ""}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </Container>
      )}

      {/* CONNECT */}
      <Container size="xl">
        <div className="text-center pb-16 md:pb-20">
          <div className="font-[family-name:var(--font-alfa-slab)] text-2xl md:text-[30px] text-[#2A2118] mb-2.5">
            Say Hi
          </div>
          <div className="text-base text-[#6B5B45] mb-9">
            Playlists, photos, and the occasional bad pun.
          </div>
          <div className="flex justify-center gap-4 flex-wrap mb-11">
            {socials
              .filter((s) => s.name !== "Email")
              .map(({ name, url, Icon }) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={name}
                  className="w-12 h-12 rounded-full bg-[#2A2118] text-[#FAF1E1] flex items-center justify-center hover:-translate-y-0.5 hover:-rotate-[4deg] transition-transform"
                >
                  <Icon size={20} />
                </a>
              ))}
          </div>

          <div
            className="max-w-xl mx-auto bg-[#2A2118] rounded-xl px-7 py-6 flex items-center gap-4 text-left -rotate-[0.5deg]"
            style={{ boxShadow: "8px 8px 0 rgba(42,33,24,0.10)" }}
          >
            <div className="w-11 h-11 rounded-full bg-[#2F7A78] flex items-center justify-center flex-shrink-0">
              <SiSpotify size={18} color="#FAF1E1" />
            </div>
            <div className="min-w-0">
              {spotifyPlaylist ? (
                <div
                  className="text-sm text-[#FAF1E1] [&_iframe]:rounded-lg [&_iframe]:w-full"
                  dangerouslySetInnerHTML={{
                    __html: (spotifyPlaylist.embed_html || spotifyPlaylist.embed_url || "").replace(
                      /allowfullscreen="?"?/g,
                      ""
                    ),
                  }}
                />
              ) : (
                <>
                  <div className="text-sm font-bold text-[#FAF1E1]">Follow the playlist on Spotify</div>
                  <div className="text-xs text-[#D8C9AE]">The Dead Wax Dialogues rotation, updated weekly</div>
                </>
              )}
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
