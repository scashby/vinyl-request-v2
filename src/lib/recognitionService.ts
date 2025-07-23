import { recognizeWithACRCloud } from 'lib/recognizers/acr';
import { recognizeWithAudD } from 'lib/recognizers/audd';
import { recognizeWithAcoustID } from 'lib/recognizers/acoustid';
import { RecognizedTrack } from 'lib/types/recognizedTrack';

export async function recognizeAudioSample(
  audioBufferBase64: string,
  audioUrl: string,
  fingerprint: string,
  duration: number
): Promise<{
  source: string;
  result: RecognizedTrack;
} | null> {
  let result = await recognizeWithACRCloud(audioBufferBase64);
  if (result) return { source: 'ACRCloud', result };

  result = await recognizeWithAudD(audioUrl);
  if (result) return { source: 'AudD', result };

  result = await recognizeWithAcoustID(fingerprint, duration);
  if (result) return { source: 'AcoustID', result };

  return null;
}
