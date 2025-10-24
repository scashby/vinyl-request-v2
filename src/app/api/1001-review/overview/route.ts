// src/app/api/1001-review/overview/route.ts
// Updated to work with ACTUAL schema: one_thousand_one_albums table
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type CollectionMatch = {
  collection_id: number;
  album_1001_id: number;
  artist: string;
  title: string;
  year: string | null;
  image_url: string | null;
  owned: boolean;
  listened: boolean;
};

export async function GET() {
  try {
    // Get all albums from your existing one_thousand_one_albums table
    const { data: albums1001, error: albums1001Error } = await supabase
      .from('one_thousand_one_albums')
      .select('id, artist, album, year')
      .order('year', { ascending: true, nullsFirst: false });

    if (albums1001Error) {
      console.error('Error fetching 1001 albums:', albums1001Error);
      return NextResponse.json({ error: albums1001Error.message }, { status: 500 });
    }

    const total1001 = albums1001?.length || 0;

    // Get all approved matches from your existing collection_1001_review table
    const { data: approvedMatches, error: matchesError } = await supabase
      .from('collection_1001_review')
      .select(`
        collection_id,
        album_1001_id,
        status,
        listened,
        collection:collection_id (
          artist,
          title,
          year,
          image_url
        )
      `)
      .eq('status', 'approved');

    if (matchesError) {
      console.error('Error fetching matches:', matchesError);
      return NextResponse.json({ error: matchesError.message }, { status: 500 });
    }

    // Build the complete list with ownership status
    const albums: CollectionMatch[] = (albums1001 || []).map(album1001 => {
      const match = (approvedMatches || []).find(
        (m: { album_1001_id: number; collection_id: number; listened?: boolean; collection?: { artist: string; title: string; year: string; image_url: string }[] }) => 
          m.album_1001_id === album1001.id
      );

      // Supabase returns collection as an array, get first item
      const collectionData = match?.collection?.[0];

      return {
        collection_id: match?.collection_id || 0,
        album_1001_id: album1001.id,
        artist: collectionData?.artist || album1001.artist,
        title: collectionData?.title || album1001.album, // Note: column is 'album' not 'title'
        year: collectionData?.year || album1001.year?.toString() || null,
        image_url: collectionData?.image_url || null,
        owned: !!match,
        listened: match?.listened || false
      };
    });

    const owned = albums.filter(a => a.owned).length;
    const listened = albums.filter(a => a.listened).length;
    const missing = total1001 - owned;
    const completionPercent = total1001 > 0 
      ? Math.round((owned / total1001) * 100)
      : 0;

    return NextResponse.json({
      stats: {
        total1001,
        owned,
        listened,
        missing,
        completionPercent
      },
      albums
    });

  } catch (error) {
    console.error('1001 Albums Overview Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}