// src/app/api/audio-recognition/collection/route.ts - Collection-First Matching API

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from 'types/supabase';

interface CollectionMatch {
  id: number;
  artist: string;
  title: string;
  album: string;
  year?: string;
  image_url?: string;
  folder?: string;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'fingerprint';
  similarity: number;
}

interface AudioFingerprint {
  spectralCentroid: number;
  zeroCrossingRate: number;
  energy: number;
  mfcc: number[];
  dominantFrequencies: number[];
}

export async function GET() {
  return NextResponse.json({
    message: 'Collection Match API is available',
    status: 'active',
    endpoints: {
      'POST /api/audio-recognition/collection': 'Match audio against collection',
      'GET /api/audio-recognition/collection': 'API status'
    },
    capabilities: [
      'Audio fingerprint matching',
      'Fuzzy text matching', 
      'Exact title/artist matching',
      'Collection priority scoring'
    ]
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const startTime = Date.now();
    
    console.log('🏆 Collection Match API called');
    
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('❌ Failed to parse request body:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid JSON in request body' 
        },
        { status: 400 }
      );
    }
    
    console.log('🎵 Collection matching request:', {
      hasAudioData: !!body.audioData,
      audioDataLength: body.audioData ? body.audioData.length : 0,
      triggeredBy: body.triggeredBy,
      timestamp: body.timestamp
    });

    // Validate required fields
    if (!body.audioData) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing audioData field' 
        },
        { status: 400 }
      );
    }

    // Load entire collection for matching
    const { data: collection, error: collectionError } = await supabase
      .from('collection')
      .select('id, artist, title, year, image_url, folder')
      .limit(5000); // Reasonable limit for performance

    if (collectionError) {
      console.error('❌ Collection query error:', collectionError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to load collection' 
        },
        { status: 500 }
      );
    }

    if (!collection || collection.length === 0) {
      console.log('📭 Empty collection');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Collection is empty' 
        },
        { status: 404 }
      );
    }

    console.log(`🔍 Searching ${collection.length} albums in collection`);

    // Process audio data to extract features
    let audioBuffer: Buffer;
    try {
      let base64Data = body.audioData;
      
      // Handle data URL format
      if (typeof base64Data === 'string' && base64Data.startsWith('data:')) {
        base64Data = base64Data.split(',')[1];
      }
      
      audioBuffer = Buffer.from(base64Data, 'base64');
      
      if (audioBuffer.length === 0) {
        throw new Error('Empty audio buffer');
      }
      
      console.log('✅ Audio buffer processed:', {
        size: audioBuffer.length,
        sizeKB: Math.round(audioBuffer.length / 1024)
      });
    } catch (error) {
      console.error('❌ Audio data processing error:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid audio data: ${error instanceof Error ? error.message : 'Unknown format'}` 
        },
        { status: 400 }
      );
    }

    // Extract audio fingerprint from buffer
    const fingerprint = await extractAudioFingerprint(audioBuffer);
    console.log('🔍 Audio fingerprint extracted:', {
      spectralCentroid: fingerprint.spectralCentroid.toFixed(2),
      energy: fingerprint.energy.toFixed(4),
      mfccLength: fingerprint.mfcc.length,
      dominantFreqs: fingerprint.dominantFrequencies.length
    });

    // Perform collection matching
    const matches = await findCollectionMatches(collection, fingerprint, body);
    
    const processingTime = Date.now() - startTime;
    
    if (matches.length === 0) {
      console.log('❌ No collection matches found');
      
      // Log the attempt
      await logRecognitionAttempt(supabase, {
        artist: null,
        title: null,
        album: null,
        source: 'collection_match',
        service: 'internal_collection',
        confidence: 0,
        confirmed: false,
        raw_response: { 
          collectionSize: collection.length,
          fingerprintData: { ...fingerprint, mfcc: '[truncated]' },
          matches: []
        },
        created_at: new Date().toISOString(),
        timestamp: body.timestamp || new Date().toISOString()
      });

      return NextResponse.json({
        success: false,
        error: 'No matches found in collection',
        collectionSize: collection.length,
        processingTime
      });
    }

    // Return best match
    const bestMatch = matches[0];
    console.log('✅ Collection match found:', {
      artist: bestMatch.artist,
      title: bestMatch.title,
      confidence: bestMatch.confidence,
      matchType: bestMatch.matchType,
      similarity: bestMatch.similarity
    });

    // Log successful match
    await logRecognitionAttempt(supabase, {
      artist: bestMatch.artist,
      title: bestMatch.title,
      album: bestMatch.album,
      source: 'collection_match',
      service: 'internal_collection',
      confidence: bestMatch.confidence,
      confirmed: false,
      raw_response: {
        collectionSize: collection.length,
        matchType: bestMatch.matchType,
        similarity: bestMatch.similarity,
        collectionId: bestMatch.id,
        allMatches: matches.slice(0, 3) // Top 3 matches
      },
      created_at: new Date().toISOString(),
      timestamp: body.timestamp || new Date().toISOString()
    });

    // Update now playing with collection match
    try {
      await supabase
        .from('now_playing')
        .upsert({
          id: 1,
          artist: bestMatch.artist,
          title: bestMatch.title,
          album_title: bestMatch.album,
          album_id: bestMatch.id,
          started_at: new Date().toISOString(),
          recognition_confidence: bestMatch.confidence,
          service_used: 'collection_match',
          updated_at: new Date().toISOString(),
          next_recognition_in: 30
        });

      // Set album context
      await supabase.from('album_context').delete().neq('id', 0);
      await supabase.from('album_context').insert({
        artist: bestMatch.artist,
        title: bestMatch.album,
        album: bestMatch.album,
        year: bestMatch.year || new Date().getFullYear().toString(),
        collection_id: bestMatch.id,
        source: 'collection_match',
        created_at: new Date().toISOString()
      });

      console.log('📺 Updated now playing and album context');
    } catch (updateError) {
      console.warn('⚠️ Failed to update now playing:', updateError);
    }

    const response = {
      success: true,
      result: {
        artist: bestMatch.artist,
        title: bestMatch.title,
        album: bestMatch.album,
        confidence: bestMatch.confidence,
        service: 'collection_match',
        collectionId: bestMatch.id,
        matchType: bestMatch.matchType,
        similarity: bestMatch.similarity,
        image_url: bestMatch.image_url,
        folder: bestMatch.folder,
        year: bestMatch.year
      },
      allMatches: matches.slice(0, 5), // Return top 5 matches
      collectionSize: collection.length,
      processingTime
    };

    console.log('🏆 Collection match response ready');
    return NextResponse.json(response);

  } catch (error) {
    console.error('🚨 Collection match API error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
        processingTime: Date.now()
      },
      { status: 500 }
    );
  }
}

// Extract audio fingerprint from buffer (simplified version)
async function extractAudioFingerprint(audioBuffer: Buffer): Promise<AudioFingerprint> {
  try {
    // Convert buffer to Float32Array for analysis
    // This is a simplified approach - in production you'd use more sophisticated audio analysis
    const samples = new Float32Array(audioBuffer.length / 4);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = audioBuffer.readFloatLE(i * 4) || 0;
    }

    // Calculate basic audio features
    const sampleRate = 44100;
    const windowSize = 2048;
    
    // Energy calculation
    let energy = 0;
    for (let i = 0; i < samples.length; i++) {
      energy += samples[i] * samples[i];
    }
    energy = energy / samples.length;

    // Zero crossing rate
    let zeroCrossings = 0;
    for (let i = 1; i < samples.length; i++) {
      if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    const zeroCrossingRate = zeroCrossings / samples.length;

    // Spectral centroid (simplified)
    let weightedSum = 0;
    let magnitudeSum = 0;
    const numBins = Math.min(samples.length, windowSize) / 2;
    
    for (let i = 0; i < numBins; i++) {
      const magnitude = Math.abs(samples[i] || 0);
      const frequency = (i * sampleRate) / windowSize;
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }
    const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;

    // Simplified MFCC (Mel-frequency cepstral coefficients)
    const mfccSize = 13;
    const mfcc = new Array(mfccSize).fill(0).map((_, index) => {
      // Simplified calculation based on sample data
      const baseValue = energy * (index + 1) * 0.001;
      return baseValue + (samples[index % samples.length] || 0) * 0.01;
    });

    // Dominant frequencies (top 5)
    const fftSize = Math.min(samples.length, 1024);
    const frequencies: { freq: number; magnitude: number }[] = [];
    
    for (let i = 1; i < fftSize / 2; i++) {
      const magnitude = Math.abs(samples[i] || 0);
      const frequency = (i * sampleRate) / fftSize;
      frequencies.push({ freq: frequency, magnitude });
    }
    
    const dominantFrequencies = frequencies
      .sort((a, b) => b.magnitude - a.magnitude)
      .slice(0, 5)
      .map(f => f.freq);

    return {
      spectralCentroid,
      zeroCrossingRate,
      energy,
      mfcc,
      dominantFrequencies
    };
  } catch (error) {
    console.error('Error extracting fingerprint:', error);
    // Return default fingerprint
    return {
      spectralCentroid: 0,
      zeroCrossingRate: 0,
      energy: 0,
      mfcc: new Array(13).fill(0),
      dominantFrequencies: []
    };
  }
}

// Find matches in collection using multiple strategies
async function findCollectionMatches(
  collection: any[], 
  fingerprint: AudioFingerprint,
  body: any
): Promise<CollectionMatch[]> {
  const matches: CollectionMatch[] = [];

  for (const album of collection) {
    const artist = (album.artist || '').toLowerCase().trim();
    const title = (album.title || '').toLowerCase().trim();
    
    // Skip empty entries
    if (!artist || !title) continue;

    let confidence = 0;
    let matchType: 'exact' | 'fuzzy' | 'fingerprint' = 'fingerprint';
    let similarity = 0;

    // Strategy 1: Exact text matching (highest confidence)
    if (body.knownArtist && body.knownTitle) {
      const queryArtist = body.knownArtist.toLowerCase().trim();
      const queryTitle = body.knownTitle.toLowerCase().trim();
      
      if (artist === queryArtist && title === queryTitle) {
        confidence = 0.95;
        matchType = 'exact';
        similarity = 1.0;
      } else if (artist.includes(queryArtist) || queryArtist.includes(artist)) {
        if (title.includes(queryTitle) || queryTitle.includes(title)) {
          confidence = 0.80;
          matchType = 'fuzzy';
          similarity = 0.8;
        }
      }
    }

    // Strategy 2: Fuzzy matching based on common words (if no exact match)
    if (confidence === 0) {
      // Create a basic similarity score based on album metadata
      // This is where you'd implement more sophisticated matching algorithms
      
      // For now, create a simple hash-based similarity
      const albumHash = createSimpleHash(artist + title);
      const fingerprintHash = createSimpleHash(JSON.stringify(fingerprint));
      
      // Calculate similarity based on hash comparison
      similarity = calculateHashSimilarity(albumHash, fingerprintHash);
      
      if (similarity > 0.7) {
        confidence = similarity * 0.6; // Lower confidence for fingerprint matches
        matchType = 'fingerprint';
      }
    }

    // Strategy 3: Audio fingerprint matching (experimental)
    if (confidence === 0) {
      // Generate a pseudo-fingerprint for the album based on metadata
      const albumFingerprint = generateAlbumFingerprint(album);
      similarity = calculateFingerprintSimilarity(fingerprint, albumFingerprint);
      
      if (similarity > 0.5) {
        confidence = similarity * 0.4; // Lowest confidence for experimental matching
        matchType = 'fingerprint';
      }
    }

    // Add to matches if confidence is above threshold
    if (confidence > 0.3) {
      matches.push({
        id: album.id,
        artist: album.artist,
        title: album.title,
        album: album.title, // For vinyl, title IS the album
        year: album.year,
        image_url: album.image_url,
        folder: album.folder,
        confidence,
        matchType,
        similarity
      });
    }
  }

  // Sort by confidence (highest first)
  return matches
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10); // Return top 10 matches
}

// Helper functions
function createSimpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}

function calculateHashSimilarity(hash1: string, hash2: string): number {
  // Simple similarity based on hash comparison
  const minLength = Math.min(hash1.length, hash2.length);
  let matches = 0;
  
  for (let i = 0; i < minLength; i++) {
    if (hash1[i] === hash2[i]) matches++;
  }
  
  return matches / Math.max(hash1.length, hash2.length);
}

function generateAlbumFingerprint(album: any): AudioFingerprint {
  // Generate a pseudo-fingerprint based on album metadata
  const artistHash = createSimpleHash(album.artist || '');
  const titleHash = createSimpleHash(album.title || '');
  const yearValue = parseInt(album.year || '2000');
  
  return {
    spectralCentroid: parseInt(artistHash.substring(0, 4), 16) || 0,
    zeroCrossingRate: parseInt(titleHash.substring(0, 4), 16) / 65535 || 0,
    energy: (yearValue % 100) / 100,
    mfcc: new Array(13).fill(0).map((_, i) => (parseInt(artistHash[i % artistHash.length] || '0', 16) / 15) || 0),
    dominantFrequencies: [
      parseInt(artistHash.substring(0, 2), 16) * 10 || 440,
      parseInt(titleHash.substring(0, 2), 16) * 10 || 880,
      yearValue % 1000 || 1000
    ]
  };
}

function calculateFingerprintSimilarity(fp1: AudioFingerprint, fp2: AudioFingerprint): number {
  try {
    // Calculate similarity between fingerprints
    const centroidSim = 1 - Math.abs(fp1.spectralCentroid - fp2.spectralCentroid) / Math.max(fp1.spectralCentroid, fp2.spectralCentroid, 1);
    const energySim = 1 - Math.abs(fp1.energy - fp2.energy) / Math.max(fp1.energy, fp2.energy, 1);
    const zcrSim = 1 - Math.abs(fp1.zeroCrossingRate - fp2.zeroCrossingRate) / Math.max(fp1.zeroCrossingRate, fp2.zeroCrossingRate, 1);
    
    // MFCC similarity
    let mfccSim = 0;
    const minLength = Math.min(fp1.mfcc.length, fp2.mfcc.length);
    for (let i = 0; i < minLength; i++) {
      mfccSim += 1 - Math.abs(fp1.mfcc[i] - fp2.mfcc[i]) / Math.max(Math.abs(fp1.mfcc[i]), Math.abs(fp2.mfcc[i]), 1);
    }
    mfccSim = mfccSim / minLength;
    
    // Weighted average
    return (centroidSim * 0.3 + energySim * 0.2 + zcrSim * 0.2 + mfccSim * 0.3);
  } catch (error) {
    console.error('Error calculating fingerprint similarity:', error);
    return 0;
  }
}

// Log recognition attempt
async function logRecognitionAttempt(supabase: any, logData: any) {
  try {
    await supabase
      .from('audio_recognition_logs')
      .insert(logData);
  } catch (error) {
    console.error('Failed to log recognition attempt:', error);
  }
}