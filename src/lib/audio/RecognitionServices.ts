// src/lib/audio/RecognitionServices.ts
// Real audio recognition service integrations

import { RealAudioFingerprinting, AudioFingerprint } from './RealFingerprinting';

export interface RecognitionResult {
  artist: string;
  title: string;
  album: string;
  confidence: number;
  source: string;
  service: string;
  image_url?: string;
  duration?: number;
  isrc?: string;
  spotify_id?: string;
}

export interface ServiceConfig {
  acrcloud?: {
    accessKey: string;
    accessSecret: string;
    host: string;
  };
  audd?: {
    apiToken: string;
  };
  acoustid?: {
    clientKey: string;
  };
  shazam?: {
    rapidApiKey: string;
  };
}

export class RealRecognitionServices {
  private fingerprinter: RealAudioFingerprinting;
  private config: ServiceConfig;
  
  constructor(config: ServiceConfig) {
    this.fingerprinter = new RealAudioFingerprinting();
    this.config = config;
  }
  
  /**
   * Main recognition method - tries collection first, then external services
   */
  public async recognizeAudio(audioBuffer: Float32Array): Promise<RecognitionResult | null> {
    console.log('🎵 Starting real audio recognition...');
    
    // Step 1: Generate fingerprint
    const fingerprint = this.fingerprinter.generateFingerprint(audioBuffer);
    console.log(`Generated fingerprint: ${fingerprint.hash.substring(0, 16)}...`);
    
    // Step 2: Check against local collection first
    const collectionMatch = await this.matchCollection(fingerprint);
    if (collectionMatch) {
      console.log('✅ Found match in collection');
      return collectionMatch;
    }
    
    // Step 3: Try external services in order of reliability
    const services = [
      () => this.recognizeWithACRCloud(audioBuffer),
      () => this.recognizeWithAudD(audioBuffer),  
      () => this.recognizeWithAcoustID(fingerprint),
      () => this.recognizeWithShazam(audioBuffer)
    ];
    
    for (const service of services) {
      try {
        const result = await service();
        if (result) {
          console.log(`✅ Found match with ${result.service}`);
          return result;
        }
      } catch (error) {
        console.warn(`Service failed:`, error);
        continue;
      }
    }
    
    console.log('❌ No matches found in any service');
    return null;
  }
  
  /**
   * Match against local collection using fingerprinting
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async matchCollection(_fingerprint: AudioFingerprint): Promise<RecognitionResult | null> {
    // TODO: Implement database lookup
    // This would search your audio_fingerprints table
    /*
    const { data } = await supabase
      .from('audio_fingerprints')
      .select(`
        *,
        collection!inner(*)
      `)
      .gte('similarity_score', 0.8)
      .order('similarity_score', { ascending: false })
      .limit(1);
    */
    
    return null; // For now, until fingerprint database is built
  }
  
  /**
   * ACRCloud Recognition (Most accurate for commercial music)
   */
  private async recognizeWithACRCloud(audioBuffer: Float32Array): Promise<RecognitionResult | null> {
    if (!this.config.acrcloud) {
      throw new Error('ACRCloud not configured');
    }
    
    try {
      // Convert audio to the format ACRCloud expects
      const audioData = this.audioBufferToWav(audioBuffer);
      
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = this.createACRCloudSignature(timestamp);
      
      const formData = new FormData();
      formData.append('sample', new Blob([audioData], { type: 'audio/wav' }));
      formData.append('sample_bytes', audioData.byteLength.toString());
      formData.append('access_key', this.config.acrcloud.accessKey);
      formData.append('data_type', 'audio');
      formData.append('signature_version', '1');
      formData.append('signature', signature);
      formData.append('timestamp', timestamp.toString());
      
      const response = await fetch(`https://${this.config.acrcloud.host}/v1/identify`, {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.status.code === 0 && result.metadata?.music?.length > 0) {
        const music = result.metadata.music[0];
        return {
          artist: music.artists?.[0]?.name || 'Unknown Artist',
          title: music.title || 'Unknown Title',
          album: music.album?.name || 'Unknown Album',
          confidence: (music.score || 50) / 100,
          source: 'acrcloud',
          service: 'ACRCloud',
          image_url: music.album?.cover_url,
          duration: music.duration_ms ? music.duration_ms / 1000 : undefined,
          isrc: music.external_ids?.isrc,
          spotify_id: music.external_metadata?.spotify?.track?.id
        };
      }
      
      return null;
    } catch (error) {
      console.error('ACRCloud error:', error);
      throw error;
    }
  }
  
  /**
   * AudD Recognition (Good for older/rare music)
   */
  private async recognizeWithAudD(audioBuffer: Float32Array): Promise<RecognitionResult | null> {
    if (!this.config.audd?.apiToken) {
      throw new Error('AudD not configured');
    }
    
    try {
      // Convert audio to base64
      const audioData = this.audioBufferToWav(audioBuffer);
      const base64Audio = this.arrayBufferToBase64(audioData);
      
      const formData = new FormData();
      formData.append('audio', base64Audio);
      formData.append('return', 'apple_music,spotify,deezer,napster');
      formData.append('api_token', this.config.audd.apiToken);
      
      const response = await fetch('https://api.audd.io/', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.status === 'success' && result.result) {
        const track = result.result;
        return {
          artist: track.artist || 'Unknown Artist',
          title: track.title || 'Unknown Title', 
          album: track.album || 'Unknown Album',
          confidence: 0.85, // AudD doesn't provide confidence scores
          source: 'audd',
          service: 'AudD',
          image_url: track.spotify?.preview_url,
          spotify_id: track.spotify?.id
        };
      }
      
      return null;
    } catch (error) {
      console.error('AudD error:', error);
      throw error;
    }
  }
  
  /**
   * AcoustID Recognition (Open source, good for fingerprinting)
   */
  private async recognizeWithAcoustID(fingerprint: AudioFingerprint): Promise<RecognitionResult | null> {
    if (!this.config.acoustid?.clientKey) {
      throw new Error('AcoustID not configured');
    }
    
    try {
      // AcoustID uses chromaprint fingerprints, we'd need to convert our fingerprint
      // For now, using a simplified approach
      const params = new URLSearchParams({
        client: this.config.acoustid.clientKey,
        duration: fingerprint.duration.toString(),
        fingerprint: fingerprint.hash, // This would need to be chromaprint format
        meta: 'recordings+releasegroups+compress'
      });
      
      const response = await fetch(`https://api.acoustid.org/v2/lookup?${params}`);
      const result = await response.json();
      
      if (result.status === 'ok' && result.results?.length > 0) {
        const match = result.results[0];
        const recording = match.recordings?.[0];
        
        if (recording) {
          return {
            artist: recording.artists?.[0]?.name || 'Unknown Artist',
            title: recording.title || 'Unknown Title',
            album: recording.releasegroups?.[0]?.title || 'Unknown Album',
            confidence: match.score || 0.5,
            source: 'acoustid',
            service: 'AcoustID'
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('AcoustID error:', error);
      throw error;
    }
  }
  
  /**
   * Shazam Recognition (via RapidAPI)
   */
  private async recognizeWithShazam(audioBuffer: Float32Array): Promise<RecognitionResult | null> {
    if (!this.config.shazam?.rapidApiKey) {
      throw new Error('Shazam not configured');
    }
    
    try {
      const audioData = this.audioBufferToWav(audioBuffer);
      const base64Audio = this.arrayBufferToBase64(audioData);
      
      const response = await fetch('https://shazam.p.rapidapi.com/songs/v2/detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'X-RapidAPI-Key': this.config.shazam.rapidApiKey,
          'X-RapidAPI-Host': 'shazam.p.rapidapi.com'
        },
        body: base64Audio
      });
      
      const result = await response.json();
      
      if (result.track) {
        const track = result.track;
        return {
          artist: track.subtitle || 'Unknown Artist',
          title: track.title || 'Unknown Title',
          album: track.sections?.[0]?.metadata?.find((m: { title: string; text: string }) => m.title === 'Album')?.text || 'Unknown Album',
          confidence: 0.9, // Shazam is usually very confident
          source: 'shazam',
          service: 'Shazam',
          image_url: track.images?.coverart,
          spotify_id: track.hub?.providers?.find((p: { type: string }) => p.type === 'spotify')?.actions?.[0]?.uri
        };
      }
      
      return null;
    } catch (error) {
      console.error('Shazam error:', error);
      throw error;
    }
  }
  
  /**
   * Utility functions
   */
  private audioBufferToWav(audioBuffer: Float32Array): ArrayBuffer {
    const length = audioBuffer.length;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 44100, true);
    view.setUint32(28, 44100 * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
    
    return arrayBuffer;
  }
  
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  
  private createACRCloudSignature(timestamp: number): string {
    // Dynamic import for Node.js crypto in Next.js environment
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto');
    const method = 'POST';
    const uri = '/v1/identify';
    const accessKey = this.config.acrcloud!.accessKey;
    const accessSecret = this.config.acrcloud!.accessSecret;
    
    const signatureString = [method, uri, accessKey, 'audio', '1', timestamp].join('\n');
    
    return crypto
      .createHmac('sha1', accessSecret)
      .update(signatureString, 'utf-8')
      .digest()
      .toString('base64');
  }
}