// src/app/page.tsx
// Home page ("/") — Landing for Dead Wax Dialogues
//
// Content for each section below comes from the `homepage_sections` table
// (editable at /admin/edit-home), falling back to DEFAULT_SECTIONS if a row
// doesn't exist yet (e.g. before sql/create-homepage-sections.sql has been
// run). Events and Dialogues posts stay sourced from their own existing
// tables/feeds — only the static copy lives here. The Connect section's
// Spotify block always shows its static fallback (linking to the Spotify
// profile URL in the socials list) now that /admin/playlists is retired.

"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "src/lib/supabaseClient";
import { resolveSections, residencySeasonLabel, type HomepageSection, type ResidencyTokens } from "src/lib/homeContent";
import { useActiveTheme } from "src/lib/useActiveTheme";
import { HeroSection } from "src/components/home/HeroSection";
import { ResidencySection } from "src/components/home/ResidencySection";
import { EventsStripSection } from "src/components/home/EventsStripSection";
import { BioSection } from "src/components/home/BioSection";
import { GameDeckSection } from "src/components/home/GameDeckSection";
import { DialoguesTeaserSection } from "src/components/home/DialoguesTeaserSection";
import { ConnectSection } from "src/components/home/ConnectSection";

interface Event {
  id: number;
  title: string;
  date: string;
  created_at?: string;
  location?: string;
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

export default function Page() {
  const [sections, setSections] = useState<HomepageSection<Record<string, unknown>>[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const { cssVars } = useActiveTheme();

  useEffect(() => {
    fetch("/api/homepage-sections?page=home")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSections(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Error loading homepage sections:", err));
  }, []);

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

  const s = resolveSections(sections);
  const tokens: ResidencyTokens = {
    night: s.residency.data.night,
    venue: s.residency.data.venue,
    season: residencySeasonLabel(s.residency.data),
  };
  const isVisible = (row: HomepageSection<unknown> | null) => row?.visible ?? true;

  return (
    <div
      className="min-h-screen font-[family-name:var(--dwd-font-body)] bg-[var(--dwd-bg)] text-[var(--dwd-ink)]"
      style={cssVars}
    >
      {isVisible(s.hero.row) && <HeroSection data={s.hero.data} tokens={tokens} />}
      {isVisible(s.residency.row) && <ResidencySection data={s.residency.data} tokens={tokens} />}
      {isVisible(s.events_strip.row) && (
        <EventsStripSection
          data={s.events_strip.data}
          tokens={tokens}
          loading={loadingEvents}
          events={upcomingEvents}
        />
      )}
      {isVisible(s.bio.row) && <BioSection data={s.bio.data} tokens={tokens} />}
      {isVisible(s.game_deck.row) && <GameDeckSection data={s.game_deck.data} tokens={tokens} />}
      {isVisible(s.dialogues_teaser.row) && (
        <DialoguesTeaserSection data={s.dialogues_teaser.data} tokens={tokens} posts={posts} />
      )}
      {isVisible(s.connect.row) && <ConnectSection data={s.connect.data} tokens={tokens} />}
    </div>
  );
}
