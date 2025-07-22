import { recognizeWithACRCloud } from './recognizers/acr';
import { recognizeWithAudD } from './recognizers/audd';
import { recognizeWithAcoustID } from './recognizers/acoustid';
import { RecognizedTrack } from './types/recognizedTrack';

export async function recognizeAudioSample(): Promise<{
  source: string;
  result: RecognizedTrack;
} | null> {
  let result = await recognizeWithACRCloud();
  if (result) return { source: 'ACRCloud', result };

  result = await recognizeWithAudD();
  if (result) return { source: 'AudD', result };

  result = await recognizeWithAcoustID('stub-fingerprint');
  if (result) return { source: 'AcoustID', result };

  return null;
}
