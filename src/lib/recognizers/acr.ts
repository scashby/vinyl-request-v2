import axios from 'axios';
import { RecognizedTrack } from 'lib/types/recognizedTrack';

interface ACRCloudResponse {
  metadata?: {
    music?: {
      score?: number;
      title?: string;
      album?: { name?: string };
      artists?: { name?: string }[];
    }[];
  };
}

export async function recognizeWithACRCloud(audioBufferBase64: string): Promise<RecognizedTrack | null> {
  try {
    const response = await axios.post<ACRCloudResponse>('https://identify-eu-west-1.acrcloud.com/v1/identify', audioBufferBase64, {
      headers: {
        Authorization: `Bearer ${process.env.ACRCLOUD_ACCESS_KEY}`,
        'Content-Type': 'application/octet-stream'
      }
    });

    const track = response.data.metadata?.music?.[0];
    if (!track) return null;

    return {
      source: 'ACRCloud',
      confidence: track.score ?? 0,
      artist: track.artists?.[0]?.name || 'Unknown',
      title: track.title || 'Unknown',
      album: track.album?.name || 'Unknown'
    };
  } catch {
    return null;
  }
}
