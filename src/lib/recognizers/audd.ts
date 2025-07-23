import axios from 'axios';
import { RecognizedTrack } from 'lib/types/recognizedTrack';

interface AudDResponse {
  result?: {
    artist?: string;
    title?: string;
    album?: string;
  };
}

export async function recognizeWithAudD(audioUrl: string): Promise<RecognizedTrack | null> {
  try {
    const response = await axios.get<AudDResponse>('https://api.audd.io/', {
      params: {
        api_token: process.env.AUDD_API_TOKEN,
        url: audioUrl,
        return: 'apple_music,spotify'
      }
    });

    const result = response.data.result;
    if (!result) return null;

    return {
      source: 'AudD',
      confidence: 1.0,
      artist: result.artist || 'Unknown',
      title: result.title || 'Unknown',
      album: result.album || 'Unknown'
    };
  } catch {
    return null;
  }
}
