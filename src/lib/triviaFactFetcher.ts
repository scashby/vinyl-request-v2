// @ts-nocheck — masters/artists tables are not in TriviaDatabase schema
/**
 * triviaFactFetcher.ts
 *
 * Three-tier fact extraction for the trivia fact library:
 *   Tier 1 — Local DB (masters table fields already enriched, zero API cost)
 *   Tier 2 — Discogs API (master notes / artist profile)
 *   Tier 3 — Wikipedia REST API (lead paragraph for artist or album)
 *
 * Produces TriviaRawFact[] arrays suitable for insertion into trivia_facts.
 */

import { createHash } from "crypto";
import { fetchDiscogsJson } from "src/lib/discogsAuth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TriviaFactKind =
  | "bio"
  | "recording_context"
  | "chart_fact"
  | "production_note"
  | "cultural_context"
  | "critical_reception";

export type TriviaFactEntityType = "artist" | "master" | "recording" | "label";

export type TriviaRawFact = {
  entity_type: TriviaFactEntityType;
  entity_id: number;
  entity_ref: string;
  fact_text: string;
  fact_kind: TriviaFactKind;
  confidence: "low" | "medium" | "high";
  source_url: string | null;
  source_domain: string | null;
  source_title: string | null;
  excerpt_text: string;
  content_hash: string;
};

// Shape of a master row we need for fact extraction
export type MasterForFacts = {
  id: number;
  title: string;
  notes: string | null;
  critical_reception: string | null;
  cultural_significance: string | null;
  producers: string[] | null;
  engineers: string[] | null;
  musicians: string[] | null;
  songwriters: string[] | null;
  chart_positions: string[] | null;
  awards: string[] | null;
  certifications: string[] | null;
  recording_location: string | null;
  recording_date: string | null;
  allmusic_review: string | null;
  pitchfork_review: string | null;
  discogs_master_id: string | null;
  wikipedia_url: string | null;
  genres: string[] | null;
  styles: string[] | null;
  main_artist_id: number | null;
};

// Shape of an artist row we need for fact extraction
export type ArtistForFacts = {
  id: number;
  name: string;
  discogs_id: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function contentHash(text: string): string {
  return createHash("sha256").update(text.trim()).digest("hex");
}

function domainFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Split a block of text into individual fact sentences.
 * Filters out very short sentences and limits the total returned.
 */
export function splitIntoFactSentences(text: string, max: number): string[] {
  if (!text?.trim()) return [];

  // Split on sentence-ending punctuation followed by whitespace or end
  const raw = text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40);

  return raw.slice(0, max);
}

function makeFact(
  overrides: Partial<TriviaRawFact> & {
    entity_type: TriviaFactEntityType;
    entity_id: number;
    entity_ref: string;
    fact_text: string;
    fact_kind: TriviaFactKind;
  }
): TriviaRawFact {
  const fact_text = overrides.fact_text.trim();
  return {
    confidence: "high",
    source_url: null,
    source_domain: null,
    source_title: null,
    excerpt_text: fact_text,
    content_hash: contentHash(fact_text),
    ...overrides,
    fact_text,
  };
}

// ---------------------------------------------------------------------------
// Tier 1 — Local DB extraction from masters row
// ---------------------------------------------------------------------------

export function extractMasterFacts(master: MasterForFacts): TriviaRawFact[] {
  const facts: TriviaRawFact[] = [];
  const base = { entity_type: "master" as const, entity_id: master.id, entity_ref: master.title };

  // Notes — split into per-sentence facts
  if (master.notes?.trim()) {
    for (const sentence of splitIntoFactSentences(master.notes, 4)) {
      facts.push(makeFact({ ...base, fact_text: sentence, fact_kind: "recording_context", source_title: "Release Notes" }));
    }
  }

  // Critical reception text
  if (master.critical_reception?.trim()) {
    for (const sentence of splitIntoFactSentences(master.critical_reception, 2)) {
      facts.push(makeFact({ ...base, fact_text: sentence, fact_kind: "critical_reception", source_title: "Critical Reception" }));
    }
  }

  // Cultural significance text
  if (master.cultural_significance?.trim()) {
    for (const sentence of splitIntoFactSentences(master.cultural_significance, 2)) {
      facts.push(makeFact({ ...base, fact_text: sentence, fact_kind: "cultural_context", source_title: "Cultural Significance" }));
    }
  }

  // Producers array → synthesized sentences
  if (master.producers?.length) {
    const names = master.producers.filter(Boolean).join(", ");
    facts.push(makeFact({
      ...base,
      fact_text: `${master.title} was produced by ${names}.`,
      fact_kind: "production_note",
      source_title: "Production Credits",
    }));
  }

  // Songwriters
  if (master.songwriters?.length) {
    const names = master.songwriters.filter(Boolean).join(", ");
    facts.push(makeFact({
      ...base,
      fact_text: `The songs on ${master.title} were written by ${names}.`,
      fact_kind: "recording_context",
      source_title: "Songwriting Credits",
    }));
  }

  // Engineers
  if (master.engineers?.length) {
    const names = master.engineers.filter(Boolean).join(", ");
    facts.push(makeFact({
      ...base,
      fact_text: `${master.title} was engineered by ${names}.`,
      fact_kind: "production_note",
      source_title: "Engineering Credits",
    }));
  }

  // Chart positions
  if (master.chart_positions?.length) {
    for (const pos of master.chart_positions.slice(0, 3)) {
      if (pos?.trim()) {
        facts.push(makeFact({ ...base, fact_text: pos.trim(), fact_kind: "chart_fact", source_title: "Chart Positions" }));
      }
    }
  }

  // Awards
  if (master.awards?.length) {
    for (const award of master.awards.slice(0, 3)) {
      if (award?.trim()) {
        facts.push(makeFact({ ...base, fact_text: award.trim(), fact_kind: "cultural_context", source_title: "Awards" }));
      }
    }
  }

  // Certifications
  if (master.certifications?.length) {
    const certs = master.certifications.filter(Boolean).join("; ");
    facts.push(makeFact({ ...base, fact_text: `${master.title} has received the following certifications: ${certs}.`, fact_kind: "chart_fact", source_title: "Certifications" }));
  }

  // Recording location
  if (master.recording_location?.trim()) {
    facts.push(makeFact({
      ...base,
      fact_text: master.recording_date
        ? `${master.title} was recorded at ${master.recording_location} in ${master.recording_date}.`
        : `${master.title} was recorded at ${master.recording_location}.`,
      fact_kind: "recording_context",
      source_title: "Recording Info",
    }));
  }

  // AllMusic review (first 2 sentences)
  if (master.allmusic_review?.trim()) {
    for (const sentence of splitIntoFactSentences(master.allmusic_review, 2)) {
      facts.push(makeFact({
        ...base,
        fact_text: sentence,
        fact_kind: "critical_reception",
        confidence: "medium",
        source_title: "AllMusic Review",
        source_url: null,
        source_domain: "allmusic.com",
      }));
    }
  }

  // Pitchfork review (first 2 sentences)
  if (master.pitchfork_review?.trim()) {
    for (const sentence of splitIntoFactSentences(master.pitchfork_review, 2)) {
      facts.push(makeFact({
        ...base,
        fact_text: sentence,
        fact_kind: "critical_reception",
        confidence: "medium",
        source_title: "Pitchfork Review",
        source_url: null,
        source_domain: "pitchfork.com",
      }));
    }
  }

  // Dedupe by content hash
  const seen = new Set<string>();
  return facts.filter((f) => {
    if (seen.has(f.content_hash)) return false;
    seen.add(f.content_hash);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Tier 2 — Discogs API
// ---------------------------------------------------------------------------

export async function fetchDiscogsMasterNotes(
  discogsMasterId: string
): Promise<string | null> {
  try {
    const data = await fetchDiscogsJson<{ notes?: string }>(
      `https://api.discogs.com/masters/${discogsMasterId}`
    );
    return data?.notes?.trim() || null;
  } catch {
    return null;
  }
}

export async function fetchDiscogsArtistProfile(
  discogsId: string
): Promise<string | null> {
  try {
    const data = await fetchDiscogsJson<{ profile?: string }>(
      `https://api.discogs.com/artists/${discogsId}`
    );
    return data?.profile?.trim() || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tier 3 — Wikipedia REST API
// ---------------------------------------------------------------------------

export async function fetchWikipediaSummary(
  title: string,
  wikipediaUrl?: string | null
): Promise<{ extract: string; url: string } | null> {
  // Extract article title from URL if provided
  let articleTitle = title;
  if (wikipediaUrl) {
    try {
      const pathname = new URL(wikipediaUrl).pathname;
      const match = pathname.match(/\/wiki\/(.+)$/);
      if (match?.[1]) articleTitle = decodeURIComponent(match[1]);
    } catch {
      // fall through to use title directly
    }
  }

  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(articleTitle)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "vinyl-request-v2/1.0 (music-trivia-generator)" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.extract?.trim()) return null;
    return { extract: json.extract as string, url: json.content_urls?.desktop?.page ?? url };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// High-level fact fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch facts for an album/master.
 * Tier 1 → Tier 2 → Tier 3
 */
export async function fetchAlbumFacts(master: MasterForFacts): Promise<TriviaRawFact[]> {
  const facts: TriviaRawFact[] = [];

  // Tier 1: local DB
  facts.push(...extractMasterFacts(master));

  // Tier 2: Discogs master notes (only if notes field was empty in DB)
  const hasLocalNotes = !!(master.notes?.trim());
  if (!hasLocalNotes && master.discogs_master_id) {
    await sleep(500);
    const discogsNotes = await fetchDiscogsMasterNotes(master.discogs_master_id);
    if (discogsNotes) {
      const discogsUrl = `https://www.discogs.com/master/${master.discogs_master_id}`;
      for (const sentence of splitIntoFactSentences(discogsNotes, 4)) {
        facts.push(makeFact({
          entity_type: "master",
          entity_id: master.id,
          entity_ref: master.title,
          fact_text: sentence,
          fact_kind: "recording_context",
          source_url: discogsUrl,
          source_domain: "discogs.com",
          source_title: `${master.title} — Discogs`,
        }));
      }
    }
  }

  // Tier 3: Wikipedia
  await sleep(200);
  const wiki = await fetchWikipediaSummary(master.title, master.wikipedia_url);
  if (wiki) {
    for (const sentence of splitIntoFactSentences(wiki.extract, 2)) {
      facts.push(makeFact({
        entity_type: "master",
        entity_id: master.id,
        entity_ref: master.title,
        fact_text: sentence,
        fact_kind: "cultural_context",
        confidence: "medium",
        source_url: wiki.url,
        source_domain: "en.wikipedia.org",
        source_title: `${master.title} — Wikipedia`,
      }));
    }
  }

  // Final dedupe
  const seen = new Set<string>();
  return facts.filter((f) => {
    if (seen.has(f.content_hash)) return false;
    seen.add(f.content_hash);
    return true;
  });
}

/**
 * Fetch facts for an artist.
 * Tier 2 (Discogs profile) → Tier 3 (Wikipedia)
 */
export async function fetchArtistFacts(artist: ArtistForFacts): Promise<TriviaRawFact[]> {
  const facts: TriviaRawFact[] = [];
  const base = { entity_type: "artist" as const, entity_id: artist.id, entity_ref: artist.name };

  // Tier 2: Discogs artist profile
  if (artist.discogs_id) {
    await sleep(500);
    const profile = await fetchDiscogsArtistProfile(artist.discogs_id);
    if (profile) {
      const discogsUrl = `https://www.discogs.com/artist/${artist.discogs_id}`;
      for (const sentence of splitIntoFactSentences(profile, 3)) {
        facts.push(makeFact({
          ...base,
          fact_text: sentence,
          fact_kind: "bio",
          source_url: discogsUrl,
          source_domain: "discogs.com",
          source_title: `${artist.name} — Discogs`,
        }));
      }
    }
  }

  // Tier 3: Wikipedia
  await sleep(200);
  const wiki = await fetchWikipediaSummary(artist.name);
  if (wiki) {
    for (const sentence of splitIntoFactSentences(wiki.extract, 2)) {
      facts.push(makeFact({
        ...base,
        fact_text: sentence,
        fact_kind: "bio",
        confidence: "medium",
        source_url: wiki.url,
        source_domain: "en.wikipedia.org",
        source_title: `${artist.name} — Wikipedia`,
      }));
    }
  }

  // Dedupe
  const seen = new Set<string>();
  return facts.filter((f) => {
    if (seen.has(f.content_hash)) return false;
    seen.add(f.content_hash);
    return true;
  });
}
