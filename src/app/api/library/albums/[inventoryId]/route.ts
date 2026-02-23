import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { toSingle } from "src/lib/library/mappers";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, context: { params: Promise<{ inventoryId: string }> }) {
  try {
    const { inventoryId } = await context.params;
    const id = Number(inventoryId);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid inventoryId" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;

    const select = `id,
      release_id,
      status,
      personal_notes,
      media_condition,
      sleeve_condition,
      location,
      date_added,
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
        packaging,
        vinyl_color,
        vinyl_weight,
        rpm,
        spars_code,
        box_set,
        sound,
        studio,
        disc_metadata,
        matrix_numbers,
        track_count,
        notes,
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
            credits,
            notes,
            lyrics,
            lyrics_url,
            is_cover,
            original_artist,
            track_artist
          )
        ),
        master:masters (
          id,
          title,
          original_release_year,
          discogs_master_id,
          musicbrainz_release_group_id,
          cover_image_url,
          genres,
          styles,
          notes,
          sort_title,
          subtitle,
          musicians,
          producers,
          engineers,
          songwriters,
          composer,
          conductor,
          chorus,
          composition,
          orchestra,
          chart_positions,
          awards,
          certifications,
          cultural_significance,
          critical_reception,
          allmusic_rating,
          allmusic_review,
          pitchfork_score,
          pitchfork_review,
          recording_location,
          master_release_date,
          recording_date,
          recording_year,
          wikipedia_url,
          allmusic_url,
          apple_music_url,
          lastfm_url,
          spotify_url,
          genius_url,
          custom_links,
          artist:artists (id, name),
          master_tag_links:master_tag_links (
            master_tags (name)
          )
        )
      )`;

    const { data, error } = await db.from("inventory").select(select).eq("id", id).single();
    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Album not found" }, { status: 404 });
    }

    const release = toSingle(data.release);
    const master = toSingle(release?.master);
    const album = {
      ...data,
      release,
      release_notes: release?.notes ?? null,
      master_notes: master?.notes ?? null,
    };

    return NextResponse.json({ ok: true, data: album }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load album";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

