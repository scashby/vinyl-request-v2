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
    source: 'ACRCloud',
    confidence: 0.92,
    artist: 'Simulated Artist',
    title: 'Simulated Track',
    album: 'Simulated Album',
    raw_response: { mock: true },
  };
}
