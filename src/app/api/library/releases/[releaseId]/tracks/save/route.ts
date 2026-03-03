import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { buildCanonicalPosition, normalizePosition } from "src/lib/library/normalize";
import type { LibraryTrackSavePayload, LibraryTrackSaveResult } from "src/lib/library/types";
import { normalizeArtistDisplay } from "src/lib/artistName";

export const runtime = "nodejs";

const parseDurationToSeconds = (value: string | null | undefined): number | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parts = raw.split(":").map((p) => Number(p));
  if (parts.some((p) => Number.isNaN(p))) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
};

type IncomingTrack = LibraryTrackSavePayload["tracks"][number];

type ExistingReleaseTrack = {
  id: number;
  release_id: number | null;
  recording_id: number | null;
  position: string;
  side: string | null;
  title_override: string | null;
};

type ExistingRecording = {
  id: number;
  title: string | null;
  duration_seconds: number | null;
  track_artist: string | null;
  lyrics: string | null;
  lyrics_url: string | null;
  is_cover: boolean | null;
  original_artist: string | null;
  credits: unknown;
};

export async function POST(request: NextRequest, context: { params: Promise<{ releaseId: string }> }) {
  try {
    const { releaseId } = await context.params;
    const releaseIdNum = Number(releaseId);
    if (!Number.isFinite(releaseIdNum) || releaseIdNum <= 0) {
      return NextResponse.json({ error: "Invalid releaseId" }, { status: 400 });
    }

    const body = (await request.json()) as Partial<LibraryTrackSavePayload>;
    const incoming = Array.isArray(body?.tracks) ? (body.tracks as IncomingTrack[]) : [];

    // Drop headers + empty titles
    const incomingTracks = incoming
      .filter((t) => t && t.type === "track")
      .map((t) => ({
        ...t,
        title: String(t.title ?? "").trim(),
        artist: normalizeArtistDisplay(typeof t.artist === "string" ? t.artist.trim() : null),
        duration: typeof t.duration === "string" ? t.duration.trim() : null,
        side: typeof t.side === "string" ? t.side.trim() : undefined,
      }))
      .filter((t) => t.title.length > 0);

    const normalizedIncoming = incomingTracks
      .map((t) => {
        const pos = buildCanonicalPosition({
          position: t.position,
          side: t.side ?? null,
          discNumber: t.disc_number ?? null,
        });
        return {
          ...t,
          canonicalPosition: normalizePosition(pos),
        };
      })
      .filter((t) => t.canonicalPosition.length > 0);

    // Ensure unique positions in payload
    const seenPositions = new Set<string>();
    for (const t of normalizedIncoming) {
      if (seenPositions.has(t.canonicalPosition)) {
        return NextResponse.json(
          { error: `Duplicate track position in payload: ${t.canonicalPosition}` },
          { status: 400 }
        );
      }
      seenPositions.add(t.canonicalPosition);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;

    const { data: existingReleaseTracks, error: releaseTracksError } = await db
      .from("release_tracks")
      .select("id, release_id, recording_id, position, side, title_override")
      .eq("release_id", releaseIdNum);
    if (releaseTracksError) throw new Error(releaseTracksError.message);

    const existingByPosition = new Map<string, ExistingReleaseTrack>();
    const existingRecordingIds: number[] = [];
    for (const row of (existingReleaseTracks ?? []) as ExistingReleaseTrack[]) {
      existingByPosition.set(normalizePosition(row.position), row);
      if (typeof row.recording_id === "number") existingRecordingIds.push(row.recording_id);
    }

    const { data: existingRecordings, error: recordingsError } = existingRecordingIds.length
      ? await db
          .from("recordings")
          .select("id, title, duration_seconds, track_artist, lyrics, lyrics_url, is_cover, original_artist, credits")
          .in("id", existingRecordingIds)
      : { data: [] as ExistingRecording[], error: null };
    if (recordingsError) throw new Error(recordingsError.message);
    const recordingById = new Map<number, ExistingRecording>(
      ((existingRecordings ?? []) as ExistingRecording[]).map((r) => [r.id, r])
    );

    let updatedReleaseTrackCount = 0;
    let insertedReleaseTrackCount = 0;
    let deletedReleaseTrackCount = 0;
    let updatedRecordingCount = 0;
    let insertedRecordingCount = 0;

    // Upsert tracks by position
    for (const t of normalizedIncoming) {
      const existing = existingByPosition.get(t.canonicalPosition);
      const durationSeconds = parseDurationToSeconds(t.duration);
      const sideValue = t.side ? normalizePosition(t.side).slice(0, 1) : null;

      if (existing) {
        // Update recording in-place (preserve lyrics fields)
        if (existing.recording_id && recordingById.has(existing.recording_id)) {
          const old = recordingById.get(existing.recording_id)!;
          const nextTitle = t.title;
          const nextArtist = normalizeArtistDisplay(t.artist) ?? null;
          const nextLyricsUrl =
            typeof t.lyrics_url === "string" ? t.lyrics_url.trim() || null : (
              Object.prototype.hasOwnProperty.call(t, "lyrics_url") ? null : (old.lyrics_url ?? null)
            );
          const nextIsCover =
            typeof t.is_cover === "boolean" ? t.is_cover : (
              Object.prototype.hasOwnProperty.call(t, "is_cover") ? null : (old.is_cover ?? null)
            );
          const nextOriginalArtist =
            typeof t.original_artist === "string" ? t.original_artist.trim() || null : (
              Object.prototype.hasOwnProperty.call(t, "original_artist") ? null : (old.original_artist ?? null)
            );
          const overrideMode = existing.title_override !== null && existing.title_override !== undefined;
          const nextRecordingTitle = overrideMode ? old.title : nextTitle;

          const currentCredits =
            old.credits && typeof old.credits === "object" && !Array.isArray(old.credits)
              ? (old.credits as Record<string, unknown>)
              : {};
          const incomingCredits =
            t.credits && typeof t.credits === "object" && !Array.isArray(t.credits)
              ? (t.credits as Record<string, unknown>)
              : {};
          const nextCredits: Record<string, unknown> = {
            ...currentCredits,
            ...incomingCredits,
          };
          if (nextArtist) {
            nextCredits.track_artist = nextArtist;
          } else {
            delete nextCredits.track_artist;
          }

          if (Object.prototype.hasOwnProperty.call(t, "time_signature")) {
            if (typeof t.time_signature === "number" && Number.isFinite(t.time_signature)) {
              nextCredits.time_signature = t.time_signature;
            } else {
              delete nextCredits.time_signature;
            }
          }
          if (Object.prototype.hasOwnProperty.call(t, "original_year")) {
            if (typeof t.original_year === "number" && Number.isFinite(t.original_year)) {
              nextCredits.original_year = t.original_year;
            } else {
              delete nextCredits.original_year;
            }
          }
          if (Object.prototype.hasOwnProperty.call(t, "lyrics_url")) {
            if (typeof nextLyricsUrl === "string" && nextLyricsUrl.length > 0) {
              nextCredits.lyrics_url = nextLyricsUrl;
            } else {
              delete nextCredits.lyrics_url;
            }
          }
          if (Object.prototype.hasOwnProperty.call(t, "is_cover")) {
            if (typeof nextIsCover === "boolean") {
              nextCredits.is_cover = nextIsCover;
            } else {
              delete nextCredits.is_cover;
            }
          }
          if (Object.prototype.hasOwnProperty.call(t, "original_artist")) {
            if (typeof nextOriginalArtist === "string" && nextOriginalArtist.length > 0) {
              nextCredits.original_artist = nextOriginalArtist;
            } else {
              delete nextCredits.original_artist;
            }
          }

          const oldCreditsComparable = JSON.stringify(currentCredits);
          const nextCreditsComparable = JSON.stringify(nextCredits);
          const shouldUpdate =
            (old.title ?? "") !== (nextRecordingTitle ?? "") ||
            (old.track_artist ?? "") !== (nextArtist ?? "") ||
            (old.duration_seconds ?? null) !== (durationSeconds ?? null) ||
            (old.lyrics_url ?? null) !== (nextLyricsUrl ?? null) ||
            (old.is_cover ?? null) !== (nextIsCover ?? null) ||
            (old.original_artist ?? null) !== (nextOriginalArtist ?? null) ||
            (t.note ?? null) !== null ||
            t.bpm !== undefined ||
            t.musical_key !== undefined ||
            t.energy !== undefined ||
            t.danceability !== undefined ||
            t.valence !== undefined ||
            oldCreditsComparable !== nextCreditsComparable;

          if (shouldUpdate) {
            const titleUpdate = overrideMode ? undefined : nextTitle;
            const { error: updateRecError } = await db
              .from("recordings")
              .update({
                title: titleUpdate,
                track_artist: nextArtist,
                duration_seconds: durationSeconds,
                bpm: typeof t.bpm === "number" ? t.bpm : null,
                musical_key: typeof t.musical_key === "string" ? t.musical_key : null,
                energy: typeof t.energy === "number" ? t.energy : null,
                danceability: typeof t.danceability === "number" ? t.danceability : null,
                valence: typeof t.valence === "number" ? t.valence : null,
                lyrics_url: nextLyricsUrl,
                is_cover: nextIsCover,
                original_artist: nextOriginalArtist,
                notes: t.note ?? null,
                credits: nextCredits,
              })
              .eq("id", existing.recording_id);
            if (updateRecError) throw new Error(updateRecError.message);
            updatedRecordingCount += 1;
          }
        }

        // Update release_tracks row
        const nextTitleOverride =
          existing.title_override !== null && existing.title_override !== undefined ? t.title : null;
        const { error: updateRtError } = await db
          .from("release_tracks")
          .update({
            position: t.canonicalPosition,
            side: sideValue,
            title_override: nextTitleOverride,
          })
          .eq("id", existing.id);
        if (updateRtError) throw new Error(updateRtError.message);
        updatedReleaseTrackCount += 1;
      } else {
        // Create a new recording + link row
        const incomingCredits =
          t.credits && typeof t.credits === "object" && !Array.isArray(t.credits)
            ? ({ ...(t.credits as Record<string, unknown>) })
            : {};
        if (typeof t.time_signature === "number" && Number.isFinite(t.time_signature)) {
          incomingCredits.time_signature = t.time_signature;
        }
        if (typeof t.original_year === "number" && Number.isFinite(t.original_year)) {
          incomingCredits.original_year = t.original_year;
        }
        if (typeof t.lyrics_url === "string" && t.lyrics_url.trim()) {
          incomingCredits.lyrics_url = t.lyrics_url.trim();
        }
        if (typeof t.is_cover === "boolean") {
          incomingCredits.is_cover = t.is_cover;
        }
        if (typeof t.original_artist === "string" && t.original_artist.trim()) {
          incomingCredits.original_artist = t.original_artist.trim();
        }
        const nextArtist = normalizeArtistDisplay(t.artist) ?? null;
        if (nextArtist) incomingCredits.track_artist = nextArtist;

        const { data: insertedRec, error: insertRecError } = await db
          .from("recordings")
          .insert({
            title: t.title,
            track_artist: nextArtist,
            duration_seconds: durationSeconds,
            notes: t.note ?? null,
            bpm: typeof t.bpm === "number" ? t.bpm : null,
            musical_key: typeof t.musical_key === "string" ? t.musical_key : null,
            energy: typeof t.energy === "number" ? t.energy : null,
            danceability: typeof t.danceability === "number" ? t.danceability : null,
            valence: typeof t.valence === "number" ? t.valence : null,
            lyrics_url: typeof t.lyrics_url === "string" ? t.lyrics_url.trim() || null : null,
            is_cover: typeof t.is_cover === "boolean" ? t.is_cover : null,
            original_artist: typeof t.original_artist === "string" ? t.original_artist : null,
            credits: Object.keys(incomingCredits).length > 0 ? incomingCredits : undefined,
          })
          .select("id")
          .single();
        if (insertRecError || !insertedRec) throw new Error(insertRecError?.message || "Failed creating recording");
        insertedRecordingCount += 1;

        const { error: insertRtError } = await db
          .from("release_tracks")
          .insert({
            release_id: releaseIdNum,
            recording_id: insertedRec.id,
            position: t.canonicalPosition,
            side: sideValue,
            title_override: null,
          });
        if (insertRtError) {
          const message = String(insertRtError.message ?? "");
          const isPositionConflict = message.includes("release_tracks_release_id_position_key");
          if (!isPositionConflict) throw new Error(message || "Failed creating release track");

          // Concurrent save can race on (release_id, position). Reuse winner row and drop this duplicate recording.
          const { data: winnerRow, error: winnerError } = await db
            .from("release_tracks")
            .select("id, recording_id")
            .eq("release_id", releaseIdNum)
            .eq("position", t.canonicalPosition)
            .maybeSingle();
          if (winnerError || !winnerRow?.id) {
            throw new Error(message || winnerError?.message || "Failed creating release track");
          }

          const { error: winnerUpdateError } = await db
            .from("release_tracks")
            .update({ side: sideValue })
            .eq("id", winnerRow.id);
          if (winnerUpdateError) throw new Error(winnerUpdateError.message);

          await db.from("recordings").delete().eq("id", insertedRec.id);
          updatedReleaseTrackCount += 1;
          continue;
        }
        insertedReleaseTrackCount += 1;
      }
    }

    // Delete removed positions
    const incomingPositions = new Set(normalizedIncoming.map((t) => t.canonicalPosition));
    const toDeleteIds: number[] = [];
    for (const [pos, row] of existingByPosition) {
      if (!incomingPositions.has(pos)) toDeleteIds.push(row.id);
    }
    if (toDeleteIds.length > 0) {
      const { error: deleteError } = await db.from("release_tracks").delete().in("id", toDeleteIds);
      if (deleteError) throw new Error(deleteError.message);
      deletedReleaseTrackCount = toDeleteIds.length;
    }

    // Update releases.track_count to match current number of tracks
    const { count: trackCount, error: countError } = await db
      .from("release_tracks")
      .select("id", { count: "exact", head: true })
      .eq("release_id", releaseIdNum);
    if (countError) throw new Error(countError.message);

    const { error: releaseUpdateError } = await db
      .from("releases")
      .update({ track_count: trackCount ?? normalizedIncoming.length })
      .eq("id", releaseIdNum);
    if (releaseUpdateError) throw new Error(releaseUpdateError.message);

    const payload: LibraryTrackSaveResult = {
      ok: true,
      releaseId: releaseIdNum,
      updatedReleaseTrackCount,
      insertedReleaseTrackCount,
      deletedReleaseTrackCount,
      updatedRecordingCount,
      insertedRecordingCount,
    };
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed saving tracks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
