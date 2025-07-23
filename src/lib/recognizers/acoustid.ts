import axios from 'axios';
import { RecognizedTrack } from 'lib/types/recognizedTrack';

interface AcoustIDResponse {
  results?: {
    score?: number;
    recordings?: {
      title?: string;
      artists?: { name?: string }[];
      releasegroups?: { title?: string }[];
    }[];
  }[];
}

export async function recognizeWithAcoustID(fingerprint: string, duration: number): Promise<RecognizedTrack | null> {
  try {
    const response = await axios.get<AcoustIDResponse>('https://api.acoustid.org/v2/lookup', {
      params: {
        client: process.env.ACOUSTID_CLIENT_KEY,
        fingerprint,
        duration,
        meta: 'recordings+releasegroups'
      }
    });

    const result = response.data.results?.[0]?.recordings?.[0];
    if (!result) return null;

    return {
      source: 'AcoustID',
      confidence: response.data.results?.[0]?.score ?? 0,
      artist: result.artists?.[0]?.name || 'Unknown',
      title: result.title || 'Unknown',
      album: result.releasegroups?.[0]?.title || 'Unknown'
    };
  } catch {
    return null;
  }
}
