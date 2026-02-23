import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { toSingle } from "src/lib/library/mappers";

export const runtime = "nodejs";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const artist = (url.searchParams.get("artist") ?? "").trim();
    const title = (url.searchParams.get("title") ?? "").trim();
    const location = (url.searchParams.get("location") ?? "").trim();
    const mediaType = (url.searchParams.get("mediaType") ?? "").trim();
    const includeTracks = (url.searchParams.get("includeTracks") ?? "false").toLowerCase() === "true";
    const page = clamp(Number(url.searchParams.get("page") ?? 0), 0, 5000);
    const pageSize = clamp(Number(url.searchParams.get("pageSize") ?? 100), 10, 250);

    const from = page * pageSize;
    const to = from + pageSize - 1;

    const selectWithoutTracks = `id,
      release_id,
      status,
      personal_notes,
      media_condition,
      sleeve_condition,
      location,
      date_added,
      created_at,
      purchase_price,
      current_value,
      purchase_date,
      owner,
      play_count,
      last_played_at,
      release:releases (
        id,
        master_id,
        media_type,
        label,
        catalog_number,
        barcode,
        country,
        release_date,
        release_year,
        discogs_release_id,
        spotify_album_id,
        notes,
        track_count,
        qty,
        format_details,
        master:masters (
          id,
          title,
          original_release_year,
          notes,
          discogs_master_id,
          cover_image_url,
          genres,
          styles,
          artist:artists (id, name),
          master_tag_links:master_tag_links (
            master_tags (name)
          )
        )
      )` as const;

    const selectWithTracks = `id,
      release_id,
      status,
      personal_notes,
      media_condition,
      sleeve_condition,
      location,
      date_added,
      created_at,
      purchase_price,
      current_value,
      purchase_date,
      owner,
      play_count,
      last_played_at,
      release:releases (
        id,
        master_id,
        media_type,
        label,
        catalog_number,
        barcode,
        country,
        release_date,
        release_year,
        discogs_release_id,
        spotify_album_id,
        notes,
        track_count,
        qty,
        format_details,
        release_tracks:release_tracks (
          id,
          release_id,
          recording_id,
          position,
          side,
          title_override,
          recording:recordings (
            id,
            title,
            duration_seconds,
            track_artist,
            lyrics,
            lyrics_url,
            credits,
            notes
          )
        ),
        master:masters (
          id,
          title,
          original_release_year,
          notes,
          discogs_master_id,
          cover_image_url,
          genres,
          styles,
          artist:artists (id, name),
          master_tag_links:master_tag_links (
            master_tags (name)
          )
        )
      )` as const;

    const db = supabaseAdmin;
    let query = db.from("inventory").select(includeTracks ? selectWithTracks : selectWithoutTracks);

    if (location) query = query.eq("location", location);
    // Note: filtering by nested release fields via PostgREST can be environment-dependent.
    // Keep as best-effort; callers should not assume it's always enforced.
    if (mediaType) query = query.eq("release.media_type", mediaType);

    // Text search filters are best-effort; these use PostgREST nested filters and can vary by schema.
    // If they fail in some environments, the UI can fall back to client-side filtering.
    if (q) query = query.or(`release.master.title.ilike.%${q}%,release.master.artist.name.ilike.%${q}%`);
    if (artist) query = query.ilike("release.master.artist.name", `%${artist}%`);
    if (title) query = query.ilike("release.master.title", `%${title}%`);

    const { data, error } = await query.order("id", { ascending: true }).range(from, to);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const albums = (data ?? []).map((row) => {
      const typedRow = row as unknown as { release?: unknown } & Record<string, unknown>;
      const release = toSingle(typedRow.release) as Record<string, unknown> | null;
      const master = toSingle(release?.master as unknown) as Record<string, unknown> | null;
      const releaseNotes = typeof release?.notes === "string" ? release.notes : null;
      const masterNotes = typeof master?.notes === "string" ? master.notes : null;
      return {
        ...typedRow,
        release,
        release_notes: releaseNotes,
        master_notes: masterNotes,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        page,
        pageSize,
        hasMore: (data ?? []).length === pageSize,
        data: albums,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load albums";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
