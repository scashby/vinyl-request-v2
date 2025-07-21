// src/lib/recognitionService.ts
import { recognizeWithACRCloud } from './recognizers/acrcloud';
import { recognizeWithAudD } from './recognizers/audd';
import { recognizeWithAcoustID } from './recognizers/acoustid';

export async function recognizeAudio(
  buffer: ArrayBuffer,
  services: string[] = ['acrcloud', 'audd', 'acoustid']
) {
  const results: Record<string, unknown> = {};

  for (const service of services) {
    if (service === 'acrcloud') {
      results.acrcloud = await recognizeWithACRCloud(buffer);
    } else if (service === 'audd') {
      results.audd = await recognizeWithAudD(buffer);
    } else if (service === 'acoustid') {
      results.acoustid = await recognizeWithAcoustID(buffer);
    }
  }

  return results;
}
