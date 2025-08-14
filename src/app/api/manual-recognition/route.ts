// src/app/api/manual-recognition/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from 'lib/supabaseClient';
import { searchSpotifyTrack } from 'lib/spotify';
import { searchLastFMTrack } from 'lib/lastfm';

interface ManualRecognitionRequest {
  artist: string;
  album?: string;
  setAsContext?: boolean;
}

interface RecognitionTrack {
  artist: string;
  title: string;
  album: string;
  image_url?: string;
  confidence: number;
  source: string;
  service: string;
  collection_id?: number;
  format?: string;
  folder?: string;
  year?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ManualRecognitionRequest = await request.json();
    const { artist, album, setAsContext = true } = body;

    if (!artist?.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Artist name is required'
      }, { status: 400 });
    }

    console.log(`🔍 Manual search: ${artist}${album ? ` - ${album}` : ''}`);

    // Search multiple sources
    const searchPromises = [];
    
    // Search Spotify
    if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
      searchPromises.push(
        searchSpotifyTrack(artist, album || '').catch(e => {
          console.warn('Spotify search failed:', e);
          return null;
        })
      );
    }

    // Search Last.fm
    if (process.env.LASTFM_API_KEY) {
      searchPromises.push(
        searchLastFMTrack(artist, album || '').catch(e => {
          console.warn('Last.fm search failed:', e);
          return null;
        })
      );
    }

    // Search local collection
    const collectionSearchPromise = (async () => {
      try {
        const { data } = await supabase
          .from('collection')
          .select('*')
          .or(`artist.ilike.%${artist}%,title.ilike.%${album || artist}%`)
          .limit(10);
        
        if (data && data.length > 0) {
          return data.map(item => ({
            artist: item.artist,
            title: item.title,
            album: item.title, // Album name is in title field for collection
            image_url: item.image_url,
            confidence: 0.8,
            source: 'collection',
            service: 'Local Collection',
            collection_id: item.id,
            format: item.format,
            folder: item.folder,
            year: item.year
          }));
        }
        return null;
      } catch (e) {
        console.warn('Collection search failed:', e);
        return null;
      }
    })();

    searchPromises.push(collectionSearchPromise);

    const results = await Promise.all(searchPromises);
    const validResults = results.filter(Boolean);

    if (validResults.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No results found from any source'
      });
    }

    // Flatten and deduplicate results
    const allTracks: RecognitionTrack[] = [];
    validResults.forEach(result => {
      if (Array.isArray(result)) {
        allTracks.push(...result);
      } else if (result) {
        allTracks.push(result);
      }
    });

    // Sort by confidence and relevance
    const sortedTracks = allTracks.sort((a, b) => {
      // Prioritize collection matches
      if (a.source === 'collection' && b.source !== 'collection') return -1;
      if (b.source === 'collection' && a.source !== 'collection') return 1;
      
      // Then by confidence
      return (b.confidence || 0) - (a.confidence || 0);
    });

    const primaryTrack = sortedTracks[0];
    const candidates = sortedTracks.slice(1, 6); // Top 5 alternatives

    // Set as current context if requested
    if (setAsContext && primaryTrack) {
      // Clear existing now_playing
      await supabase.from('now_playing').delete().neq('id', 0);

      // Create new now_playing entry
      const { error: nowPlayingError } = await supabase
        .from('now_playing')
        .insert({
          artist: primaryTrack.artist,
          title: primaryTrack.title,
          album_title: primaryTrack.album,
          album_id: primaryTrack.collection_id || null,
          started_at: new Date().toISOString(),
          recognition_confidence: primaryTrack.confidence || 0.7,
          service_used: primaryTrack.service.toLowerCase(),
          recognition_image_url: primaryTrack.image_url,
          next_recognition_in: 180, // 3 minutes default
          created_at: new Date().toISOString()
        });

      if (nowPlayingError) {
        console.error('Error setting now_playing:', nowPlayingError);
      }

      // Log the manual recognition
      await supabase.from('audio_recognition_logs').insert({
        artist: primaryTrack.artist,
        title: primaryTrack.title,
        album: primaryTrack.album,
        source: 'manual',
        service: primaryTrack.service.toLowerCase(),
        confidence: primaryTrack.confidence || 0.7,
        confirmed: true,
        match_source: primaryTrack.source,
        matched_id: primaryTrack.collection_id || null,
        created_at: new Date().toISOString()
      });

      // Update album context
      try {
        const albumContextResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/album-context`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            artist: primaryTrack.artist,
            title: primaryTrack.title,
            album: primaryTrack.album,
            year: primaryTrack.year,
            collectionId: primaryTrack.collection_id,
            source: 'manual_recognition'
          })
        });
        
        if (albumContextResponse.ok) {
          console.log('📚 Album context updated from manual recognition');
        }
      } catch (error) {
        console.log('⚠️ Could not update album context:', error);
      }
    }

    console.log(`✅ Manual search complete: Found ${sortedTracks.length} results`);

    return NextResponse.json({
      success: true,
      track: primaryTrack,
      candidates,
      totalResults: sortedTracks.length,
      sources: [...new Set(allTracks.map(t => t.service))],
      contextSet: setAsContext
    });

  } catch (error) {
    console.error('Manual recognition error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}