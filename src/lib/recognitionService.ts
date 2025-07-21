import { recognizeWithACR } from './recognizers/acr';
import { recognizeWithAudD } from './recognizers/audd';
import { recognizeWithAcoustID } from './recognizers/acoustid';

export async function recognizeAudioSample(sample: Buffer) {
  let result = await recognizeWithACR(sample);
  if (result) return { source: 'ACRCloud', result };

  result = await recognizeWithAudD(sample);
  if (result) return { source: 'AudD', result };

  result = await recognizeWithAcoustID(sample);
  if (result) return { source: 'AcoustID', result };

  return null;
}
