interface RecognitionResult {
  source: string;
  confidence: number;
  artist: string;
  title: string;
  album: string;
  raw_response: Record<string, unknown>;
}

export async function recognizeWithAudD(): Promise<RecognitionResult> {
  return {
    success: true,
    artist: 'Fallback Artist',
    title: 'Fallback Track',
    album: 'Fallback Album',
    confidence: 0.78,
    source: 'AudD',
    fingerprint: 'placeholder_fp',
    duration: 120,
    error: undefined,
    raw_response: { mock: true }
},
  };
}
