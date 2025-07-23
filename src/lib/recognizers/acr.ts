interface RecognitionResult {
  source: string;
  confidence: number;
  artist: string;
  title: string;
  album: string;
  raw_response: Record<string, unknown>;
}

export async function recognizeWithACRCloud(): Promise<RecognitionResult> {
  return {
    success: true,
    artist: 'Simulated Artist',
    title: 'Simulated Track',
    album: 'Simulated Album',
    confidence: 0.92,
    source: 'ACRCloud',
    fingerprint: 'placeholder_fp',
    duration: 115,
    error: undefined,
    raw_response: { mock: true }
},
  };
}
