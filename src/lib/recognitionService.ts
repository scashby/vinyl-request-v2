import { recognizeWithAcoustID, generateChromaprint } from './recognizers/acoustid';
import { readFile } from 'fs/promises';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';
import crypto from 'crypto';

export async function recognize(samplePath: string) {
  return (
    await tryACRCloud(samplePath) ??
    await tryAudD(samplePath) ??
    await tryAcoustID(samplePath) ??
    null
  );
}

async function tryACRCloud(filePath: string) {
  try {
    const host = process.env.ACRCLOUD_HOST!;
    const accessKey = process.env.ACRCLOUD_ACCESS_KEY!;
    const accessSecret = process.env.ACRCLOUD_ACCESS_SECRET!;
    const buffer = await readFile(filePath);
    const dataType = 'audio';
    const signatureVersion = '1';
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const stringToSign = ['POST', '/v1/identify', accessKey, dataType, signatureVersion, timestamp].join('\n');
    const signature = crypto.createHmac('sha1', accessSecret).update(stringToSign).digest('base64');

    const form = new FormData();
    form.append('sample', buffer, { filename: path.basename(filePath) });
    form.append('access_key', accessKey);
    form.append('data_type', dataType);
    form.append('signature', signature);
    form.append('signature_version', signatureVersion);
    form.append('timestamp', timestamp);

    const response = await fetch(`https://${host}/v1/identify`, { method: 'POST', body: form });
    const json = await response.json();
    return json?.metadata?.music?.[0] ?? null;
  } catch (err) {
    return null;
  }
}

async function tryAudD(filePath: string) {
  try {
    const buffer = await readFile(filePath);
    const form = new FormData();
    form.append('file', buffer, { filename: path.basename(filePath) });
    form.append('api_token', process.env.AUDD_API_TOKEN!);

    const response = await fetch('https://api.audd.io/', { method: 'POST', body: form });
    const json = await response.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

async function tryAcoustID(filePath: string) {
  try {
    const { fingerprint, duration } = await generateChromaprint(filePath);
    return await recognizeWithAcoustID(fingerprint, duration);
  } catch (err) {
    console.error('AcoustID error:', err);
    return null;
  }
}
