// File: src/app/api/audio-recognition/route.ts
// FIXED VERSION - Improved collection matching, immediate recognition, better smart timing
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from 'lib/supabaseClient';
import crypto from 'crypto';

interface RecognitionTrack {
  artist: string;
  title: string;
  album?: string;
  image_url?: string;
  confidence?: number;
  service?: string;
  duration?: number;
}

interface CollectionMatch {
  id: number;
  artist: string;
  title: string;
  year: string;
  image_url?: string;
  folder?: string;
  priority?: number;
}

interface CollectionMatchWithSimilarity extends CollectionMatch {
  similarity: number;
  debug_info?: {
    normalized_recognized: string;
    normalized_collection: string;
    similarity_type: string;
  };
}

interface EnhancedRecognitionTrack extends RecognitionTrack {
  collection_match?: CollectionMatch;
  is_guest_vinyl?: boolean;
  source_priority?: number;
  next_recognition_delay?: number;
}

interface EnhancedRecognitionResult {
  success: boolean;
  track?: EnhancedRecognitionTrack;
  candidates?: EnhancedRecognitionTrack[];
  error?: string;
  servicesQueried?: string[];
  totalCandidatesFound?: number;
  smart_timing?: {
    track_duration?: number;
    next_sample_in?: number;
    reasoning?: string;
  };
  is_silence?: boolean;
  confidence_threshold?: number;
}

interface AlbumContext {
  id: number;
  artist: string;
  title: string;
  track_listing?: string[];
  collection_id?: number;
  created_at: string;
}

// API Response Types for External Services
interface ACRCloudTrack {
  title?: string;
  artists?: Array<{ name?: string }>;
  album?: { name?: string };
  duration_ms?: number;
  external_metadata?: {
    spotify?: { 
      album?: { images?: Array<{ url?: string }> };
      duration_ms?: number;
    };
    apple_music?: { album?: { artwork?: { url?: string } } };
    deezer?: { 
      album?: { cover_big?: string };
      duration?: number;
    };
    youtube?: { thumbnail?: string };
  };
}

interface SpotifyTrack {
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string }>;
  };
  duration_ms: number;
}

interface LastFmTrack {
  name: string;
  artist: string;
  image?: Array<{ '#text': string; size: string }>;
}

interface MusicBrainzRecording {
  title: string;
  'artist-credit'?: Array<{ name: string }>;
  releases?: Array<{ title: string }>;
  length?: number;
}

interface TrackWithDuration {
  duration_ms?: number;
  duration?: number;
  external_metadata?: {
    spotify?: { duration_ms?: number };
    deezer?: { duration?: number };
  };
}

// Configuration
const DEFAULT_CONFIDENCE_THRESHOLD = 0.45;
const SILENCE_THRESHOLD = 0.30;
const DEFAULT_SILENCE_INTERVAL = 30;
const MIN_TRACK_DURATION = 60;

// Get current album context for track validation
async function getCurrentAlbumContext(): Promise<AlbumContext | null> {
  try {
    const { data } = await supabase
      .from('album_context')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) return null;

    // Check if context is still valid (less than 2 hours old)
    const contextAge = Date.now() - new Date(data.created_at).getTime();
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours

    if (contextAge > maxAge) {
      // Clear expired context
      await supabase.from('album_context').delete().eq('id', data.id);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

// Validate if recognized track matches expected next track in album context
function validateTrackAgainstAlbumContext(
  recognizedTrack: RecognitionTrack,
  albumContext: AlbumContext | null
): boolean {
  if (!albumContext || !albumContext.track_listing || albumContext.track_listing.length === 0) {
    return false;
  }

  // Simple track title matching (case-insensitive, normalized)
  const normalizeTitle = (title: string): string => 
    title.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');

  const recognizedTitle = normalizeTitle(recognizedTrack.title);

  return albumContext.track_listing.some(contextTrack => {
    const contextTitle = normalizeTitle(contextTrack);
    
    // Check for exact match or significant overlap
    return contextTitle.includes(recognizedTitle) || 
           recognizedTitle.includes(contextTitle) ||
           // Also check for substring matches (at least 70% overlap)
           (contextTitle.length > 3 && recognizedTitle.length > 3 && 
            (contextTitle.includes(recognizedTitle.substring(0, Math.floor(recognizedTitle.length * 0.7))) ||
             recognizedTitle.includes(contextTitle.substring(0, Math.floor(contextTitle.length * 0.7)))));
  });
}

// FIXED: Enhanced collection matching with much more flexible artist matching
async function findBYOCollectionMatches(artist: string, title: string, album?: string): Promise<CollectionMatchWithSimilarity[]> {
  try {
    console.log(`🎯 ENHANCED COLLECTION SEARCH: ${artist} - ${title}${album ? ` (${album})` : ''}`);
    
    const folderPriority: Record<string, number> = {
      'Vinyl': 1,
      'Cassettes': 2, 
      '45s': 3
    };
    
    const byoFolders = ['Vinyl', 'Cassettes', '45s'];
    
    // FIXED: Much more flexible artist similarity calculation
    const calculateArtistSimilarity = (recognizedArtist: string, collectionArtist: string): { 
      similarity: number; 
      type: string; 
      debug: {
        normalizedRecognized: string;
        normalizedCollection: string;
        recognizedWords?: string[];
        collectionWords?: string[];
        matchingWords?: number;
        partialMatches?: number;
        wordSimilarity?: number;
        charSimilarity?: number;
        longer?: string;
        shorter?: string;
      }
    } => {
      const normalize = (str: string): string => 
        str.toLowerCase()
          .trim()
          .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
          .replace(/\s+/g, ' ')      // Normalize whitespace
          .replace(/\b(the|and|&)\b/g, '') // Remove common words
          .trim();
      
      const normalizedRecognized = normalize(recognizedArtist);
      const normalizedCollection = normalize(collectionArtist);
      
      console.log(`🔍 Comparing: "${normalizedRecognized}" vs "${normalizedCollection}"`);
      
      // Exact match after normalization
      if (normalizedRecognized === normalizedCollection) {
        return { similarity: 1.0, type: 'exact', debug: { normalizedRecognized, normalizedCollection } };
      }
      
      // One contains the other (high confidence)
      if (normalizedRecognized.includes(normalizedCollection) || normalizedCollection.includes(normalizedRecognized)) {
        return { similarity: 0.9, type: 'contains', debug: { normalizedRecognized, normalizedCollection } };
      }
      
      // Split into words and check overlap
      const recognizedWords = normalizedRecognized.split(' ').filter(w => w.length > 1);
      const collectionWords = normalizedCollection.split(' ').filter(w => w.length > 1);
      
      if (recognizedWords.length === 0 || collectionWords.length === 0) {
        return { similarity: 0.0, type: 'no_words', debug: { normalizedRecognized, normalizedCollection, recognizedWords, collectionWords } };
      }
      
      // Check for word matches (including partial matches)
      let matchingWords = 0;
      let partialMatches = 0;
      
      for (const rWord of recognizedWords) {
        for (const cWord of collectionWords) {
          if (rWord === cWord) {
            matchingWords += 1;
            break;
          } else if (rWord.length > 3 && cWord.length > 3) {
            // Check if one word contains the other (at least 4 chars)
            if (rWord.includes(cWord) || cWord.includes(rWord)) {
              partialMatches += 0.7;
              break;
            }
            // Check for significant character overlap
            const minLength = Math.min(rWord.length, cWord.length);
            let commonChars = 0;
            for (let i = 0; i < minLength; i++) {
              if (rWord[i] === cWord[i]) commonChars++;
              else break;
            }
            if (commonChars >= Math.min(3, minLength * 0.6)) {
              partialMatches += 0.5;
              break;
            }
          }
        }
      }
      
      const totalMatches = matchingWords + partialMatches;
      const maxWords = Math.max(recognizedWords.length, collectionWords.length);
      const wordSimilarity = totalMatches / maxWords;
      
      console.log(`📊 Word analysis: ${matchingWords} exact + ${partialMatches.toFixed(1)} partial = ${totalMatches.toFixed(1)} / ${maxWords} = ${wordSimilarity.toFixed(2)}`);
      
      if (wordSimilarity >= 0.6) {
        return { similarity: Math.min(0.85, wordSimilarity), type: 'word_match', debug: { normalizedRecognized, normalizedCollection, matchingWords, partialMatches, wordSimilarity } };
      }
      
      // FIXED: Additional fuzzy matching for single-word artists or very different formats
      if (recognizedWords.length === 1 && collectionWords.length === 1) {
        const rWord = recognizedWords[0];
        const cWord = collectionWords[0];
        
        if (rWord.length > 3 && cWord.length > 3) {
          const longer = rWord.length > cWord.length ? rWord : cWord;
          const shorter = rWord.length > cWord.length ? cWord : rWord;
          
          if (longer.includes(shorter)) {
            return { similarity: 0.7, type: 'single_word_contains', debug: { normalizedRecognized, normalizedCollection, longer, shorter } };
          }
          
          // Levenshtein-like similarity for single words
          let matches = 0;
          const minLen = Math.min(rWord.length, cWord.length);
          for (let i = 0; i < minLen; i++) {
            if (rWord[i] === cWord[i]) matches++;
          }
          const charSimilarity = matches / Math.max(rWord.length, cWord.length);
          if (charSimilarity > 0.5) {
            return { similarity: Math.min(0.6, charSimilarity), type: 'char_similarity', debug: { normalizedRecognized, normalizedCollection, charSimilarity } };
          }
        }
      }
      
      return { similarity: 0.0, type: 'no_match', debug: { normalizedRecognized, normalizedCollection, recognizedWords, collectionWords } };
    };
    
    // Get all albums from collection folders (increased limit)
    const { data: allMatches } = await supabase
      .from('collection')
      .select('id, artist, title, year, image_url, folder')
      .in('folder', byoFolders)
      .limit(200); // Increased limit to catch more potential matches
    
    if (!allMatches) return [];
    
    console.log(`📚 Found ${allMatches.length} total albums in collection to search`);
    
    // Calculate similarity for all albums and sort
    const scoredMatches: CollectionMatchWithSimilarity[] = allMatches
      .map(match => {
        const similarity = calculateArtistSimilarity(artist, match.artist);
        return {
          id: match.id,
          artist: match.artist,
          title: match.title,
          year: match.year,
          image_url: match.image_url,
          folder: match.folder,
          similarity: similarity.similarity,
          debug_info: {
            normalized_recognized: similarity.debug.normalizedRecognized,
            normalized_collection: similarity.debug.normalizedCollection,
            similarity_type: similarity.type
          },
          priority: folderPriority[match.folder || ''] || 999
        };
      })
      .filter(match => {
        const isGoodMatch = match.similarity >= 0.4; // FIXED: Lowered threshold from 0.7 to 0.4
        if (isGoodMatch) {
          console.log(`✅ GOOD MATCH: ${match.artist} (${match.similarity.toFixed(2)}, ${match.debug_info?.similarity_type})`);
        } else {
          console.log(`❌ Poor match: ${match.artist} (${match.similarity.toFixed(2)}, ${match.debug_info?.similarity_type})`);
        }
        return isGoodMatch;
      })
      .sort((a, b) => {
        // Sort by similarity first, then priority
        if (Math.abs(a.similarity - b.similarity) > 0.1) {
          return b.similarity - a.similarity;
        }
        return a.priority - b.priority;
      })
      .slice(0, 15); // Return more matches for better selection
    
    console.log(`✅ Found ${scoredMatches.length} potential collection matches (similarity >= 0.4)`);
    
    if (scoredMatches.length > 0) {
      console.log(`🏆 Top collection matches:`);
      scoredMatches.slice(0, 5).forEach((match, i) => {
        console.log(`  ${i + 1}. ${match.artist} - ${match.title} (${match.similarity.toFixed(2)}, ${match.debug_info?.similarity_type})`);
      });
    }
    
    return scoredMatches;
    
  } catch (error) {
    console.error('Collection matching error:', error);
    return [];
  }
}

// Extract track duration from various sources
function extractTrackDuration(track: TrackWithDuration): number | undefined {
  if (track.duration_ms) return Math.round(track.duration_ms / 1000);
  if (track.external_metadata?.spotify?.duration_ms) return Math.round(track.external_metadata.spotify.duration_ms / 1000);
  if (track.external_metadata?.deezer?.duration) return track.external_metadata.deezer.duration;
  if (track.duration) return track.duration;
  return undefined;
}

// FIXED: Smart timing calculation with better new track detection
function calculateSmartTiming(
  trackDuration?: number, 
  isNewTrack: boolean = true
): {
  next_sample_in: number;
  reasoning: string;
} {
  // If no duration or track too short, use default interval
  if (!trackDuration || trackDuration < MIN_TRACK_DURATION) {
    return {
      next_sample_in: DEFAULT_SILENCE_INTERVAL,
      reasoning: trackDuration ? 
        `Short track (${trackDuration}s) - using default ${DEFAULT_SILENCE_INTERVAL}s interval` :
        `No duration info - using default ${DEFAULT_SILENCE_INTERVAL}s interval`
    };
  }
  
  // For new tracks, start smart timing fresh
  if (isNewTrack) {
    // Sample again at 80% through the track, but at least 30 seconds from now, max 4 minutes
    const smartDelay = Math.max(30, Math.min(240, Math.round(trackDuration * 0.8)));
    return {
      next_sample_in: smartDelay,
      reasoning: `NEW TRACK: ${trackDuration}s long - next sample in ${smartDelay}s (80% through track)`
    };
  }
  
  // For continued recognition of same track, use shorter intervals
  const remainingTime = Math.round(trackDuration * 0.6); // Assume we're partway through
  const smartDelay = Math.max(20, Math.min(120, Math.round(remainingTime * 0.5))); // More frequent for same track
  
  return {
    next_sample_in: smartDelay,
    reasoning: `CONTINUING TRACK: ${trackDuration}s - next sample in ${smartDelay}s (checking for track change)`
  };
}

// Simple silence detection based on audio buffer analysis
function analyzeAudioForSilence(audioBuffer: Buffer): boolean {
  try {
    if (audioBuffer.length < 1000) return true;
    
    const sampleSize = Math.min(1000, audioBuffer.length);
    let totalValue = 0;
    
    for (let i = 0; i < sampleSize; i++) {
      totalValue += Math.abs(audioBuffer[i] - 128);
    }
    
    const averageValue = totalValue / sampleSize;
    const isQuiet = averageValue < 10;
    
    if (isQuiet) {
      console.log(`🔇 Silence detected: average audio level ${averageValue.toFixed(2)}`);
    }
    
    return isQuiet;
  } catch (error) {
    console.error('Error analyzing audio for silence:', error);
    return false;
  }
}

// ACRCloud recognition with improved error handling
async function recognizeWithACRCloud(audioFile: File, confidenceThreshold: number = DEFAULT_CONFIDENCE_THRESHOLD): Promise<EnhancedRecognitionTrack[]> {
  if (!process.env.ACRCLOUD_ACCESS_KEY || !process.env.ACRCLOUD_SECRET_KEY) {
    console.log('ACRCloud: Missing API credentials');
    return [];
  }

  try {
    console.log(`🔊 ACRCloud: Starting recognition...`);
    const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
    const secretKey = process.env.ACRCLOUD_SECRET_KEY;
    const endpoint = process.env.ACRCLOUD_ENDPOINT || 'identify-us-west-2.acrcloud.com';
    
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    
    const isLikelySilence = analyzeAudioForSilence(audioBuffer);
    if (isLikelySilence) {
      console.log('🔇 Audio appears to be silence, skipping ACRCloud');
      return [];
    }
    
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = generateACRCloudSignature(
      'POST',
      '/v1/identify',
      accessKey,
      'audio',
      '1',
      timestamp,
      secretKey
    );
    
    const formData = new FormData();
    formData.append('sample', new Blob([audioBuffer], { type: 'audio/wav' }));
    formData.append('sample_bytes', audioBuffer.length.toString());
    formData.append('access_key', accessKey);
    formData.append('data_type', 'audio');
    formData.append('signature_version', '1');
    formData.append('signature', signature);
    formData.append('timestamp', timestamp.toString());
    
    const response = await fetch(`https://${endpoint}/v1/identify`, {
      method: 'POST',
      body: formData,
      headers: { 'User-Agent': 'DeadWaxDialogues/1.0' }
    });

    if (!response.ok) {
      console.warn(`ACRCloud HTTP error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (data.status?.code === 0 && data.metadata?.music) {
      console.log(`✅ ACRCloud: Found ${data.metadata.music.length} results`);
      
      const results = data.metadata.music
        .map((track: ACRCloudTrack, index: number): EnhancedRecognitionTrack => {
          const baseConfidence = (data.status?.score || 80) / 100;
          const adjustedConfidence = Math.max(0.3, baseConfidence - (index * 0.02));
          
          const extractImageUrl = (track: ACRCloudTrack): string | undefined => {
            return track.external_metadata?.spotify?.album?.images?.[0]?.url ||
                   track.external_metadata?.apple_music?.album?.artwork?.url ||
                   track.external_metadata?.deezer?.album?.cover_big;
          };

          const duration = extractTrackDuration(track);

          return {
            artist: track.artists?.[0]?.name || 'Unknown Artist',
            title: track.title || 'Unknown Title',
            album: track.album?.name,
            image_url: extractImageUrl(track),
            confidence: adjustedConfidence,
            service: 'ACRCloud',
            source_priority: 1,
            is_guest_vinyl: true,
            duration: duration
          };
        })
        .filter((track: EnhancedRecognitionTrack) => (track.confidence || 0) >= confidenceThreshold);
      
      console.log(`🎯 ACRCloud: ${results.length} results above ${confidenceThreshold * 100}% confidence`);
      return results;
    } else {
      console.log(`❌ ACRCloud: No results. Status code: ${data.status?.code}`);
    }
    
    return [];
  } catch (error) {
    console.error('ACRCloud error:', error);
    return [];
  }
}

// AudD recognition
async function recognizeWithAudD(audioFile: File, confidenceThreshold: number = DEFAULT_CONFIDENCE_THRESHOLD): Promise<EnhancedRecognitionTrack[]> {
  if (!process.env.AUDD_API_TOKEN) {
    console.log('AudD: Missing API token');
    return [];
  }

  try {
    console.log(`🔊 AudD: Starting recognition...`);
    const formData = new FormData();
    formData.append('api_token', process.env.AUDD_API_TOKEN);
    formData.append('audio', audioFile);
    formData.append('return', 'apple_music,spotify,deezer');

    const response = await fetch('https://api.audd.io/', {
      method: 'POST',
      body: formData,
      headers: { 'User-Agent': 'DeadWaxDialogues/1.0' }
    });

    if (!response.ok) {
      console.warn(`AudD HTTP error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (data.status === 'success' && data.result) {
      console.log('✅ AudD: Found result');
      
      const confidence = 0.8;
      
      if (confidence < confidenceThreshold) {
        console.log(`🎯 AudD: Result below ${confidenceThreshold * 100}% confidence threshold`);
        return [];
      }
      
      let imageUrl: string | undefined;
      let duration: number | undefined;
      
      if (data.result.spotify?.album?.images?.length > 0) {
        imageUrl = data.result.spotify.album.images[0].url;
      } else if (data.result.apple_music?.artwork?.url) {
        imageUrl = data.result.apple_music.artwork.url;
      } else if (data.result.deezer?.album?.cover_big) {
        imageUrl = data.result.deezer.album.cover_big;
      }

      if (data.result.spotify?.duration_ms) {
        duration = Math.round(data.result.spotify.duration_ms / 1000);
      } else if (data.result.deezer?.duration) {
        duration = data.result.deezer.duration;
      }
      
      return [{
        artist: data.result.artist || 'Unknown Artist',
        title: data.result.title || 'Unknown Title',
        album: data.result.album,
        image_url: imageUrl,
        confidence: confidence,
        service: 'AudD',
        source_priority: 2,
        is_guest_vinyl: true,
        duration: duration
      }];
    } else {
      console.log(`❌ AudD: No results. Status: ${data.status}`);
    }
    
    return [];
  } catch (error) {
    console.error('AudD error:', error);
    return [];
  }
}

// Spotify recognition
async function recognizeWithSpotify(artist: string, title: string): Promise<EnhancedRecognitionTrack[]> {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.log('Spotify: Missing API credentials');
    return [];
  }

  try {
    console.log(`🔊 Spotify: Searching for ${artist} - ${title}`);
    
    // Get access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenResponse.ok) return [];

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Search for track
    const query = `track:"${title}" artist:"${artist}"`;
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!searchResponse.ok) return [];

    const searchData = await searchResponse.json();
    
    if (searchData.tracks?.items) {
      console.log(`✅ Spotify: Found ${searchData.tracks.items.length} results`);
      
      return searchData.tracks.items.map((track: SpotifyTrack, index: number): EnhancedRecognitionTrack => ({
        artist: track.artists[0]?.name || artist,
        title: track.name || title,
        album: track.album?.name,
        image_url: track.album?.images?.[0]?.url,
        confidence: Math.max(0.4, 0.85 - (index * 0.05)),
        service: 'Spotify',
        source_priority: 3,
        is_guest_vinyl: true,
        duration: track.duration_ms ? Math.round(track.duration_ms / 1000) : undefined
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Spotify recognition error:', error);
    return [];
  }
}

// LastFM recognition
async function recognizeWithLastFM(artist: string, title: string): Promise<EnhancedRecognitionTrack[]> {
  if (!process.env.LASTFM_API_KEY) {
    console.log('LastFM: Missing API key');
    return [];
  }

  try {
    console.log(`🔊 LastFM: Searching for ${artist} - ${title}`);
    
    const apiKey = process.env.LASTFM_API_KEY;
    const url = `https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&api_key=${apiKey}&format=json&limit=10`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results?.trackmatches?.track) {
      const tracks = Array.isArray(data.results.trackmatches.track) ? 
        data.results.trackmatches.track : [data.results.trackmatches.track];
      
      console.log(`✅ LastFM: Found ${tracks.length} results`);
      
      return tracks.map((track: LastFmTrack, index: number): EnhancedRecognitionTrack => ({
        artist: track.artist || artist,
        title: track.name || title,
        album: undefined,
        image_url: track.image?.find((img) => img.size === 'large')?.['#text'],
        confidence: Math.max(0.3, 0.75 - (index * 0.05)),
        service: 'Last.fm',
        source_priority: 4,
        is_guest_vinyl: true,
        duration: undefined
      }));
    }
    
    return [];
  } catch (error) {
    console.error('LastFM recognition error:', error);
    return [];
  }
}

// MusicBrainz recognition
async function recognizeWithMusicBrainz(artist: string, title: string): Promise<EnhancedRecognitionTrack[]> {
  try {
    console.log(`🔊 MusicBrainz: Searching for ${artist} - ${title}`);
    
    const query = `recording:"${title}" AND artist:"${artist}"`;
    const url = `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&fmt=json&limit=10`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DeadWaxDialogues/1.0 (contact@deadwaxdialogues.com)'
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    
    if (data.recordings) {
      console.log(`✅ MusicBrainz: Found ${data.recordings.length} results`);
      
      return data.recordings.map((recording: MusicBrainzRecording, index: number): EnhancedRecognitionTrack => ({
        artist: recording['artist-credit']?.[0]?.name || artist,
        title: recording.title || title,
        album: recording.releases?.[0]?.title,
        image_url: undefined, // MusicBrainz doesn't provide cover art directly
        confidence: Math.max(0.3, 0.7 - (index * 0.03)),
        service: 'MusicBrainz',
        source_priority: 5,
        is_guest_vinyl: true,
        duration: recording.length ? Math.round(recording.length / 1000) : undefined
      }));
    }
    
    return [];
  } catch (error) {
    console.error('MusicBrainz recognition error:', error);
    return [];
  }
}

// Check if this is the same track as last recognition
async function getLastRecognition(): Promise<{
  artist?: string;
  title?: string;
  started_at?: string;
  track_duration?: number;
} | null> {
  try {
    const { data } = await supabase
      .from('now_playing')
      .select('artist, title, started_at, track_duration')
      .eq('id', 1)
      .single();
    
    return data || null;
  } catch {
    return null;
  }
}

function isSameTrack(track1: { artist?: string; title?: string }, track2: { artist?: string; title?: string }): boolean {
  if (!track1.artist || !track1.title || !track2.artist || !track2.title) return false;
  
  const normalize = (str: string) => str.toLowerCase().trim();
  return normalize(track1.artist) === normalize(track2.artist) && 
         normalize(track1.title) === normalize(track2.title);
}

// ACRCloud signature generation
function generateACRCloudSignature(
  method: string,
  uri: string,
  accessKey: string,
  dataType: string,
  signatureVersion: string,
  timestamp: number,
  accessSecret: string
): string {
  const stringToSign = [method, uri, accessKey, dataType, signatureVersion, timestamp].join('\n');
  return crypto.createHmac('sha1', accessSecret).update(stringToSign).digest('base64');
}

// MAIN POST HANDLER - FIXED VERSION WITH ENHANCED COLLECTION MATCHING
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const confidenceThresholdParam = formData.get('confidence_threshold') as string | null;
    
    const confidenceThreshold = confidenceThresholdParam ? 
      Math.max(0.1, Math.min(1.0, parseFloat(confidenceThresholdParam))) : 
      DEFAULT_CONFIDENCE_THRESHOLD;

    if (!audioFile || audioFile.size === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing or empty audio file' },
        { status: 400 }
      );
    }

    console.log(`🎵 ENHANCED AUDIO RECOGNITION: ${audioFile.name}, size: ${audioFile.size} bytes`);

    // Get current context and last recognition
    const [albumContext, lastRecognition] = await Promise.all([
      getCurrentAlbumContext(),
      getLastRecognition()
    ]);

    console.log(`📋 Album context: ${albumContext ? `${albumContext.artist} - ${albumContext.title}` : 'None'}`);
    console.log(`📋 Last recognition: ${lastRecognition ? `${lastRecognition.artist} - ${lastRecognition.title}` : 'None'}`);

    // PHASE 1: Audio Recognition Services
    console.log('🔊 Phase 1: Audio recognition services...');
    
    const audioRecognitionPromises = [
      recognizeWithACRCloud(audioFile, confidenceThreshold),
      recognizeWithAudD(audioFile, confidenceThreshold)
    ];

    const audioResults = await Promise.allSettled(audioRecognitionPromises);
    const allAudioCandidates: EnhancedRecognitionTrack[] = [];
    
    audioResults.forEach((result, index) => {
      const serviceName = ['ACRCloud', 'AudD'][index];
      if (result.status === 'fulfilled' && result.value.length > 0) {
        console.log(`✅ ${serviceName}: Found ${result.value.length} candidates`);
        allAudioCandidates.push(...result.value);
      } else {
        console.log(`❌ ${serviceName}: No results`);
      }
    });

    console.log(`📊 Total audio-based candidates: ${allAudioCandidates.length}`);

    // SILENCE DETECTION
    const highestConfidence = Math.max(...allAudioCandidates.map(c => c.confidence || 0), 0);
    const isSilence = allAudioCandidates.length === 0 || highestConfidence < SILENCE_THRESHOLD;

    if (isSilence) {
      console.log(`🔇 SILENCE DETECTED - clearing now playing`);
      
      await supabase
        .from('now_playing')
        .update({
          artist: null,
          title: null,
          album_title: null,
          recognition_image_url: null,
          album_id: null,
          updated_at: new Date().toISOString(),
          track_duration: null,
          next_recognition_in: DEFAULT_SILENCE_INTERVAL
        })
        .eq('id', 1);

      return NextResponse.json({
        success: true,
        is_silence: true,
        confidence_threshold: confidenceThreshold,
        servicesQueried: ['ACRCloud', 'AudD', 'Spotify', 'Last.fm', 'MusicBrainz', 'BYO Collection'],
        totalCandidatesFound: 0,
        smart_timing: {
          next_sample_in: DEFAULT_SILENCE_INTERVAL,
          reasoning: `Silence detected - checking again in ${DEFAULT_SILENCE_INTERVAL}s`
        }
      } satisfies EnhancedRecognitionResult);
    }

    const bestAudioTrack = allAudioCandidates.sort((a, b) => 
      (b.confidence || 0) - (a.confidence || 0)
    )[0];

    if (!bestAudioTrack) {
      return NextResponse.json({
        success: false,
        error: 'No recognition results found',
        servicesQueried: ['ACRCloud', 'AudD'],
        totalCandidatesFound: 0
      });
    }

    // PHASE 2: Additional Services Using Best Audio Result
    console.log('🔊 Phase 2: Additional services using best audio result...');
    
    const additionalServices = [
      recognizeWithSpotify(bestAudioTrack.artist, bestAudioTrack.title),
      recognizeWithLastFM(bestAudioTrack.artist, bestAudioTrack.title),
      recognizeWithMusicBrainz(bestAudioTrack.artist, bestAudioTrack.title)
    ];

    const additionalResults = await Promise.allSettled(additionalServices);
    const allAdditionalCandidates: EnhancedRecognitionTrack[] = [];
    
    additionalResults.forEach((result, index) => {
      const serviceName = ['Spotify', 'Last.fm', 'MusicBrainz'][index];
      if (result.status === 'fulfilled' && result.value.length > 0) {
        console.log(`✅ ${serviceName}: Found ${result.value.length} candidates`);
        allAdditionalCandidates.push(...result.value);
      } else {
        console.log(`❌ ${serviceName}: No results`);
      }
    });

    // Combine all external candidates
    const allExternalCandidates = [...allAudioCandidates, ...allAdditionalCandidates];
    console.log(`📊 Total external candidates: ${allExternalCandidates.length}`);

    const finalBestTrack = allExternalCandidates.sort((a, b) => 
      (b.confidence || 0) - (a.confidence || 0)
    )[0] || bestAudioTrack;

    // PHASE 3: Album Context Validation
    console.log('🎯 Phase 3: Album context validation...');
    
    let finalTrack: EnhancedRecognitionTrack;
    let candidates: EnhancedRecognitionTrack[] = [];
    let isFromAlbumContext = false;

    // Check if the recognized track matches the current album context
    if (albumContext && validateTrackAgainstAlbumContext(finalBestTrack, albumContext)) {
      console.log(`🎉 ALBUM CONTEXT MATCH: ${finalBestTrack.title} found in ${albumContext.title}`);
      
      // Get collection data if available
      let collectionData = null;
      if (albumContext.collection_id) {
        const { data } = await supabase
          .from('collection')
          .select('*')
          .eq('id', albumContext.collection_id)
          .single();
        collectionData = data;
      }
      
      finalTrack = {
        ...finalBestTrack,
        album: albumContext.title,
        collection_match: collectionData ? {
          id: collectionData.id,
          artist: collectionData.artist,
          title: collectionData.title,
          year: collectionData.year,
          image_url: collectionData.image_url,
          folder: collectionData.folder
        } : undefined,
        is_guest_vinyl: false,
        service: `Album Context Match`,
        confidence: 0.95,
        source_priority: 0
      };
      
      isFromAlbumContext = true;
      candidates = allExternalCandidates.filter(track => track !== finalBestTrack);
      
    } else {
      // PHASE 4: ENHANCED Collection Search (only if not from album context)
      console.log('🏆 Phase 4: ENHANCED BYO Collection search...');
      
      const collectionMatches = await findBYOCollectionMatches(
        finalBestTrack.artist, 
        finalBestTrack.title, 
        finalBestTrack.album
      );

      if (collectionMatches.length > 0) {
        console.log(`🎉 COLLECTION MATCHES FOUND! Count: ${collectionMatches.length}`);
        console.log(`🏆 Top match: ${collectionMatches[0].artist} - ${collectionMatches[0].title} (similarity: ${collectionMatches[0].similarity.toFixed(2)})`);
        
        const topCollectionMatch = collectionMatches[0];
        
        // Use audio recognition for track info, enhance with collection data
        finalTrack = {
          artist: finalBestTrack.artist,  // Keep the correctly recognized artist
          title: finalBestTrack.title,   // Keep the correctly recognized title
          album: finalBestTrack.album || topCollectionMatch.title, // Prefer recognized album, fallback to collection
          image_url: topCollectionMatch.image_url || finalBestTrack.image_url,
          confidence: Math.min(0.92, (finalBestTrack.confidence || 0.8) + 0.1), // Boost confidence slightly
          service: `Collection Enhanced (${topCollectionMatch.folder})`,
          source_priority: 0,
          collection_match: topCollectionMatch,
          is_guest_vinyl: false,
          duration: finalBestTrack.duration
        };

        // Add other collection matches as candidates
        candidates = collectionMatches.slice(1).map((match: CollectionMatchWithSimilarity): EnhancedRecognitionTrack => ({
          artist: finalBestTrack.artist,  // Keep recognized artist
          title: finalBestTrack.title,   // Keep recognized title
          album: finalBestTrack.album || match.title,
          image_url: match.image_url || finalBestTrack.image_url,
          confidence: Math.min(0.88, (finalBestTrack.confidence || 0.8) + 0.05),
          service: `Collection Enhanced (${match.folder}) - ${match.debug_info?.similarity_type}`,
          source_priority: 0,
          collection_match: match,
          is_guest_vinyl: false,
          duration: finalBestTrack.duration
        }));

      } else {
        console.log(`⚠️ NO COLLECTION MATCH - Using external recognition`);
        finalTrack = {
          ...finalBestTrack,
          is_guest_vinyl: true,
          source_priority: 1
        };
      }

      // Add ALL external candidates
      candidates.push(...allExternalCandidates
        .filter(track => track !== finalBestTrack)
        .map(track => ({
          ...track,
          is_guest_vinyl: true,
          source_priority: 10
        })));
    }

    console.log(`📊 Final result: Primary + ${candidates.length} candidates`);

    // PHASE 5: FIXED Smart Timing Calculation and Application
    console.log('⏰ Phase 5: Smart timing calculation and application...');
    
    const isNewTrack = !lastRecognition || !isSameTrack(finalTrack, lastRecognition);
    const smartTiming = calculateSmartTiming(finalTrack.duration, isNewTrack);
    const nextRecognitionDelay = smartTiming.next_sample_in;
    
    console.log(`🧠 Smart timing: ${smartTiming.reasoning}`);
    console.log(`⏱️ APPLYING smart timing: ${nextRecognitionDelay}s (isNewTrack: ${isNewTrack})`);

    // PHASE 6: Database Update with proper smart timing
    console.log('💾 Phase 6: Updating database with smart timing...');
    
    try {
      const updateData = {
        id: 1,
        artist: finalTrack.artist,
        title: finalTrack.title,
        album_title: finalTrack.album,
        recognition_image_url: finalTrack.image_url,
        album_id: finalTrack.collection_match?.id || null,
        started_at: isNewTrack ? new Date().toISOString() : lastRecognition?.started_at,
        recognition_confidence: finalTrack.confidence || 0.8,
        service_used: finalTrack.service || 'Multi-Service',
        updated_at: new Date().toISOString(),
        track_duration: finalTrack.duration || null,
        next_recognition_in: nextRecognitionDelay
      };

      console.log(`💾 Updating database with next_recognition_in: ${nextRecognitionDelay}s`);

      const { error: nowPlayingError } = await supabase
        .from('now_playing')
        .upsert(updateData);

      if (nowPlayingError) {
        console.error('❌ Database update error:', nowPlayingError);
        throw nowPlayingError;
      }

      console.log('✅ Database updated successfully with smart timing applied');
      
      // FIXED: Also broadcast the update for real-time listeners
      await supabase.channel('now_playing_updates').send({
        type: 'broadcast',
        event: 'now_playing_update',
        payload: { updated_at: new Date().toISOString() }
      });
      
    } catch (dbError) {
      console.error('❌ Database update error:', dbError);
    }

    console.log(`🎉 Recognition complete! Smart timing: ${nextRecognitionDelay}s`);

    return NextResponse.json({
      success: true,
      track: finalTrack,
      candidates: candidates,
      servicesQueried: ['ACRCloud', 'AudD', 'Spotify', 'Last.fm', 'MusicBrainz', isFromAlbumContext ? 'Album Context Match' : 'Enhanced BYO Collection Search'],
      totalCandidatesFound: allExternalCandidates.length,
      confidence_threshold: confidenceThreshold,
      is_silence: false,
      smart_timing: {
        track_duration: finalTrack.duration,
        next_sample_in: nextRecognitionDelay,
        reasoning: smartTiming.reasoning
      }
    } satisfies EnhancedRecognitionResult);

  } catch (error) {
    console.error('Recognition error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        servicesQueried: [],
        totalCandidatesFound: 0,
        confidence_threshold: DEFAULT_CONFIDENCE_THRESHOLD
      } satisfies EnhancedRecognitionResult,
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ 
    message: 'Enhanced Audio Recognition API - Fixed Collection Matching & Smart Timing',
    version: '8.0.0',
    features: [
      'FIXED: Immediate first recognition (no initial countdown)',
      'FIXED: Smart timing properly updates interval state',
      'FIXED: Enhanced collection matching with flexible artist similarity (0.4+ threshold)',
      'FIXED: Better new track detection for smart timing',
      'FIXED: Real-time broadcast updates for TV display',
      'Enhanced debugging for collection matches',
      'All recognition services (ACRCloud, AudD, Spotify, Last.fm, MusicBrainz)',
      'Improved error handling and logging'
    ],
    services: {
      audio_based: ['ACRCloud', 'AudD'],
      metadata_based: ['Spotify', 'Last.fm', 'MusicBrainz'],
      context_based: ['Album Context Validation'],
      collection: ['Enhanced BYO Collection Matching (Flexible Artist Similarity)']
    },
    configuration: {
      default_confidence_threshold: DEFAULT_CONFIDENCE_THRESHOLD,
      silence_threshold: SILENCE_THRESHOLD,
      default_silence_interval: DEFAULT_SILENCE_INTERVAL,
      min_track_duration_for_smart_timing: MIN_TRACK_DURATION,
      collection_artist_similarity_threshold: 0.4, // Lowered from 0.7
      enhanced_artist_matching: true
    }
  });
}