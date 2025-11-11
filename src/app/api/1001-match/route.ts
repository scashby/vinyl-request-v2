// src/app/api/enrich-sources/1001-match/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// Normalize strings for comparison
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate similarity between two strings (0-1)
function stringSimilarity(str1: string, str2: string): number {
  const s1 = normalize(str1);
  const s2 = normalize(str2);
  
  if (s1 === s2) return 1.0;
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  // Simple character-based similarity
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer[i] === shorter[i]) matches++;
  }
  
  return matches / longer.length;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { albumId } = body;

    console.log(`\n📚 === 1001 ALBUMS MATCHING for Album ID: ${albumId} ===`);

    if (!albumId) {
      console.log('❌ ERROR: No albumId provided');
      return NextResponse.json({
        success: false,
        error: 'albumId required'
      }, { status: 400 });
    }

    // Get album info
    const { data: album, error: dbError } = await supabase
      .from('collection')
      .select('id, artist, title, year, is_1001')
      .eq('id', albumId)
      .single();

    if (dbError || !album) {
      console.log('❌ ERROR: Album not found in database', dbError);
      return NextResponse.json({
        success: false,
        error: 'Album not found'
      }, { status: 404 });
    }

    console.log(`✓ Album found: "${album.artist}" - "${album.title}" (${album.year})`);

    // Check if already matched
    if (album.is_1001) {
      console.log(`⏭️ Album already marked as 1001 album`);
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Album already marked as 1001 album'
      });
    }

    // Search for potential matches in 1001 albums
    const { data: candidates, error: searchError } = await supabase
      .from('one_thousand_one_albums')
      .select('id, artist, album, year');

    if (searchError) {
      console.log('❌ ERROR: Failed to fetch 1001 albums', searchError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch 1001 albums'
      }, { status: 500 });
    }

    if (!candidates || candidates.length === 0) {
      console.log('⚠️ No 1001 albums in database');
      return NextResponse.json({
        success: false,
        error: 'No 1001 albums in database'
      });
    }

    console.log(`🔍 Searching ${candidates.length} 1001 albums for matches...`);

    // Find best match
    let bestMatch: typeof candidates[0] | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const artistSimilarity = stringSimilarity(album.artist, candidate.artist);
      const titleSimilarity = stringSimilarity(album.title, candidate.album);
      
      // Year match bonus
      let yearBonus = 0;
      if (album.year && candidate.year) {
        const albumYear = parseInt(album.year);
        const candidateYear = parseInt(candidate.year.toString());
        if (!isNaN(albumYear) && !isNaN(candidateYear)) {
          const yearDiff = Math.abs(albumYear - candidateYear);
          if (yearDiff === 0) yearBonus = 0.3;
          else if (yearDiff <= 1) yearBonus = 0.2;
          else if (yearDiff <= 2) yearBonus = 0.1;
        }
      }
      
      // Weighted score: artist 40%, title 40%, year 20%
      const score = (artistSimilarity * 0.4) + (titleSimilarity * 0.4) + yearBonus;
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    // Require minimum confidence of 70% for auto-match
    const CONFIDENCE_THRESHOLD = 0.7;

    if (bestMatch && bestScore >= CONFIDENCE_THRESHOLD) {
      console.log(`✅ Found match with ${(bestScore * 100).toFixed(1)}% confidence:`);
      console.log(`   1001: "${bestMatch.artist}" - "${bestMatch.album}" (${bestMatch.year})`);
      console.log(`   Collection: "${album.artist}" - "${album.title}" (${album.year})`);

      // Update collection album
      const { error: updateCollectionError } = await supabase
        .from('collection')
        .update({ is_1001: true })
        .eq('id', albumId);

      if (updateCollectionError) {
        console.log('❌ ERROR: Failed to update collection', updateCollectionError);
        return NextResponse.json({
          success: false,
          error: 'Failed to update collection'
        }, { status: 500 });
      }

      // Create or update review entry
      const { error: upsertError } = await supabase
        .from('collection_1001_review')
        .upsert({
          collection_id: albumId,
          album_1001_id: bestMatch.id,
          status: 'approved',
          confidence: Math.round(bestScore * 100),
          notes: 'Auto-matched during batch enrichment'
        }, { onConflict: 'collection_id' });

      if (upsertError) {
        console.log('⚠️ Warning: Failed to create review entry', upsertError);
        // Don't fail the whole operation if review entry fails
      }

      console.log(`✅ Successfully matched album\n`);

      return NextResponse.json({
        success: true,
        matched: true,
        data: {
          albumId: album.id,
          album_1001_id: bestMatch.id,
          confidence: Math.round(bestScore * 100),
          match: {
            artist: bestMatch.artist,
            album: bestMatch.album,
            year: bestMatch.year
          }
        }
      });

    } else {
      console.log(`❌ No confident match found (best score: ${(bestScore * 100).toFixed(1)}%)`);
      if (bestMatch) {
        console.log(`   Best candidate: "${bestMatch.artist}" - "${bestMatch.album}"`);
      }

      return NextResponse.json({
        success: false,
        error: 'No confident match found',
        data: {
          albumId: album.id,
          bestScore: bestScore ? Math.round(bestScore * 100) : 0,
          bestMatch: bestMatch ? {
            artist: bestMatch.artist,
            album: bestMatch.album,
            year: bestMatch.year
          } : null
        }
      });
    }

  } catch (error) {
    console.error('❌ FATAL ERROR in 1001 matching:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}