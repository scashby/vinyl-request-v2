// src/app/api/audio-recognition/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { supabaseAdmin } from 'lib/supabaseAdmin';
import { searchSpotifyTrack } from 'lib/spotify';
import { searchLastFMTrack } from 'lib/lastfm';

type ServiceStatus = 'success' | 'failed' | 'error' | 'skipped';

interface RecognitionMatch {
  artist: string;
  title: string;
  album: string;
  confidence: number;
  source: string;
  service: string;
  image_url?: string;
  albumId?: number;
  folder?: string;
}

interface ServiceResult {
  service: string;
  status: ServiceStatus;
  result?: RecognitionMatch;
  error?: string;
  processingTime: number;
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// Accept wavBase64 OR audioBase64/webmBase64
function pickAudioFromBody(body: any): { buffer: Buffer; contentType: string; ext: 'wav'|'webm'|'mp3'|'m4a'; durationSec?: number } {
  let b64: string | undefined;
  let ext: 'wav'|'webm'|'mp3'|'m4a' = 'webm';
  let contentType = 'audio/webm';

  if (body?.wavBase64) {
    b64 = body.wavBase64;
    ext = 'wav'; contentType = 'audio/wav';
  } else if (body?.audioData) {
    b64 = body.audioData;
    if (typeof b64 === 'string' && b64.startsWith('data:')) {
      const hdr = b64.split(';',1)[0];
      if (hdr.includes('webm')) { ext='webm'; contentType='audio/webm'; }
      else if (hdr.includes('mp3')||hdr.includes('mpeg')) { ext='mp3'; contentType='audio/mpeg'; }
      else if (hdr.includes('m4a')||hdr.includes('mp4')) { ext='m4a'; contentType='audio/mp4'; }
    } else {
      ext='webm'; contentType='audio/webm';
    }
    if (b64.startsWith('data:')) b64 = b64.split(',')[1];
  } else if (body?.webmBase64) {
    b64 = body.webmBase64; ext='webm'; contentType='audio/webm';
  }

  if (!b64) throw new Error('No audio provided (expected wavBase64 or audioData/webmBase64).');
  const buffer = Buffer.from(b64, 'base64');
  const durationSec = typeof body?.durationSec === 'number' ? body.durationSec : undefined;
  return { buffer, contentType, ext, durationSec };
}

async function uploadSampleAndGetUrl(filename: string, bytes: Buffer, contentType: string): Promise<string> {
  const path = `samples/${Date.now()}-${filename}`;
  const { error } = await supabaseAdmin.storage.from('audio-temp').upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  const { data } = supabaseAdmin.storage.from('audio-temp').getPublicUrl(path);
  return data.publicUrl;
}

// ACRCloud (WAV only)
async function checkACRCloud(audio: Buffer, ext: string): Promise<ServiceResult> {
  const startTime = Date.now();
  if (!process.env.ACRCLOUD_ACCESS_KEY || !process.env.ACRCLOUD_SECRET_KEY) {
    return { service: 'ACRCloud', status: 'skipped', error: 'Missing ACRCLOUD keys', processingTime: Date.now()-startTime };
  }
  if (ext !== 'wav') {
    return { service: 'ACRCloud', status: 'skipped', error: 'Sample not WAV; skipping ACRCloud', processingTime: Date.now()-startTime };
  }
  try {
    const ts = Math.floor(Date.now()/1000);
    const stringToSign = `POST\n/v1/identify\n${process.env.ACRCLOUD_ACCESS_KEY}\naudio\n1\n${ts}`;
    const signature = crypto.createHmac('sha1', process.env.ACRCLOUD_SECRET_KEY!).update(stringToSign).digest('base64');

    const form = new FormData();
    form.append('sample', new Blob([new Uint8Array(audio)], { type: 'audio/wav' }), 'sample.wav');
    form.append('sample_bytes', String(audio.length));
    form.append('access_key', process.env.ACRCLOUD_ACCESS_KEY!);
    form.append('data_type', 'audio');
    form.append('signature_version', '1');
    form.append('signature', signature);
    form.append('timestamp', String(ts));

    const endpoint = process.env.ACRCLOUD_ENDPOINT || 'identify-eu-west-1.acrcloud.com';
    const res = await fetch(`https://${endpoint}/v1/identify`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const json = await res.json();
    if (json.status?.code === 0 && json.metadata?.music?.length > 0) {
      const m = json.metadata.music[0];
      return {
        service: 'ACRCloud',
        status: 'success',
        result: {
          artist: m.artists?.map((a:any)=>a.name).join(', ') || 'Unknown Artist',
          title: m.title || 'Unknown Title',
          album: m.album?.name || 'Unknown Album',
          confidence: m.score ? Math.min(0.99, m.score/100) : 0.8,
          source: 'acrcloud',
          service: 'ACRCloud',
          image_url: m.album?.coverart
        },
        processingTime: Date.now()-startTime
      };
    }
    return { service:'ACRCloud', status:'failed', error:`No match (code ${json.status?.code})`, processingTime: Date.now()-startTime };
  } catch (e:any) {
    return { service:'ACRCloud', status:'error', error:e?.message ?? 'ACRCloud failed', processingTime: Date.now()-startTime };
  }
}

// AudD via URL
async function checkAudDByUrl(publicUrl: string): Promise<ServiceResult> {
  const startTime = Date.now();
  if (!process.env.AUDD_API_TOKEN) return { service:'AudD', status:'skipped', error:'Missing AUDD_API_TOKEN', processingTime: Date.now()-startTime };
  try {
    const params = new URLSearchParams({
      api_token: process.env.AUDD_API_TOKEN!,
      method: 'recognize',
      url: publicUrl,
      return: 'spotify,apple_music'
    });
    const res = await fetch('https://api.audd.io/', { method:'POST', body: params });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const json = await res.json();
    if (json.status === 'success' && json.result) {
      const t = json.result;
      return {
        service: 'AudD',
        status: 'success',
        result: {
          artist: t.artist || 'Unknown Artist',
          title: t.title || 'Unknown Title',
          album: t.album || 'Unknown Album',
          confidence: 0.9,
          source: 'audd',
          service: 'AudD',
          image_url: t.spotify?.album?.images?.[0]?.url
        },
        processingTime: Date.now()-startTime
      };
    }
    return { service:'AudD', status:'failed', error:'No match', processingTime: Date.now()-startTime };
  } catch (e:any) {
    return { service:'AudD', status:'error', error: e?.message ?? 'AudD failed', processingTime: Date.now()-startTime };
  }
}

// Shazam via URL (RapidAPI)
async function checkShazamByUrl(publicUrl: string): Promise<ServiceResult> {
  const startTime = Date.now();
  if (!process.env.SHAZAM_RAPID_API_KEY) return { service:'Shazam', status:'skipped', error:'Missing SHAZAM_RAPID_API_KEY', processingTime: Date.now()-startTime };
  try {
    const res = await fetch(`https://shazam-song-recognizer.p.rapidapi.com/recognize?link=${encodeURIComponent(publicUrl)}`, {
      method:'GET',
      headers: {
        'X-RapidAPI-Key': process.env.SHAZAM_RAPID_API_KEY!,
        'X-RapidAPI-Host': 'shazam-song-recognizer.p.rapidapi.com'
      }
    });
    if (!res.ok) {
      if (res.status === 403) throw new Error('Invalid RapidAPI key or subscription required');
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    const json = await res.json();
    const t = json?.result ?? json?.track ?? json;
    const title = t?.title || t?.track?.title;
    const artist = t?.subtitle || t?.track?.subtitle || (t?.artists ? t.artists.map((a:any)=>a.name).join(', ') : undefined);
    const image = t?.images?.coverart || t?.share?.image;
    if (title || artist) {
      return {
        service:'Shazam',
        status:'success',
        result: {
          artist: artist || 'Unknown Artist',
          title: title || 'Unknown Title',
          album: 'Unknown Album',
          confidence: 0.85,
          source: 'shazam',
          service: 'Shazam',
          image_url: image
        },
        processingTime: Date.now()-startTime
      };
    }
    return { service:'Shazam', status:'failed', error:'No match', processingTime: Date.now()-startTime };
  } catch (e:any) {
    return { service:'Shazam', status:'error', error: e?.message ?? 'Shazam failed', processingTime: Date.now()-startTime };
  }
}

// AcoustID (optional) — use dynamic imports so TS doesn't require types
async function checkAcoustIDWithChromaprintIfAvailable(wav: Buffer, durationSec?: number): Promise<ServiceResult> {
  const startTime = Date.now();
  if (!process.env.ACOUSTID_CLIENT_KEY) return { service:'AcoustID', status:'skipped', error:'Missing ACOUSTID_CLIENT_KEY', processingTime: Date.now()-startTime };
  try {
    const wavDecoder = await (new Function("return import('wav-decoder')"))().catch(() => null) as any;
    const chroma = await (new Function("return import('chromaprint-wasm')"))().catch(() => null) as any;
    if (!wavDecoder || !chroma) {
      return { service:'AcoustID', status:'skipped', error:'Chromaprint/WAV decoder not installed', processingTime: Date.now()-startTime };
    }
    const audio = await wavDecoder.decode(wav);
    const sampleRate: number = audio.sampleRate;
    const pcm: Float32Array = audio.channelData[0];
    const { Chromaprint } = chroma;
    const ctx = await Chromaprint.create();
    await ctx.configure(sampleRate, 1);
    const CHUNK = 8192;
    for (let i = 0; i < pcm.length; i += CHUNK) {
      await ctx.feed(pcm.subarray(i, Math.min(i + CHUNK, pcm.length)));
    }
    const fingerprint: string = await ctx.finish();
    const dur = Math.round(durationSec || (pcm.length / sampleRate));

    const params = new URLSearchParams({
      client: process.env.ACOUSTID_CLIENT_KEY!,
      fingerprint,
      duration: String(dur),
      meta: 'recordings+releases+releasegroups'
    });
    const res = await fetch('https://api.acoustid.org/v2/lookup', {
      method:'POST',
      headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      body: params
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const best = data?.results?.[0];
    const rec = best?.recordings?.[0];
    if (rec) {
      return { service:'AcoustID', status:'success', result: {
        artist: (rec.artists || []).map((a:any)=>a.name).join(', ') || 'Unknown Artist',
        title: rec.title || 'Unknown Title',
        album: (rec.releasegroups || rec.releases || [])[0]?.title || 'Unknown Album',
        confidence: Math.min(0.95, (best?.score || 0.7)),
        source: 'acoustid',
        service: 'AcoustID'
      }, processingTime: Date.now()-startTime };
    }
    return { service:'AcoustID', status:'failed', error:'No match', processingTime: Date.now()-startTime };
  } catch (e:any) {
    return { service:'AcoustID', status:'error', error: e?.message ?? 'AcoustID failed', processingTime: Date.now()-startTime };
  }
}

// Collection lookup
async function checkCollectionByMetadata(candidate?: { artist?: string; title?: string }): Promise<ServiceResult> {
  const startTime = Date.now();
  try {
    if (!candidate?.artist || !candidate?.title) {
      return { service:'Collection', status:'failed', error:'No metadata to match', processingTime: Date.now()-startTime };
    }
    const artist = candidate.artist.trim();
    const title = candidate.title.trim();
    const { data, error } = await supabase
      .from('collection')
      .select('id, artist, title, year, image_url, folder')
      .in('folder', ['Vinyl', 'Cassettes'])
      .or(`artist.ilike.%${artist}%,title.ilike.%${title}%`)
      .limit(20);
    if (error) throw error;

    const scored = (data ?? []).map(row => {
      const a = (row.artist || '').toLowerCase();
      const t = (row.title || '').toLowerCase();
      const at = artist.toLowerCase();
      const tt = title.toLowerCase();
      let score = 0;
      if (a === at) score += 60; else if (a.startsWith(at)) score += 35; else if (a.includes(at)) score += 20;
      if (t === tt) score += 60; else if (t.startsWith(tt)) score += 35; else if (t.includes(tt)) score += 20;
      return { row, score };
    }).sort((x,y)=>y.score-x.score);

    if (!scored.length || scored[0].score < 50) {
      return { service:'Collection', status:'failed', error:'Not in collection', processingTime: Date.now()-startTime };
    }
    const best: any = scored[0].row;
    return { service:'Collection', status:'success', result: {
      artist: best.artist || 'Unknown Artist',
      title: best.title || 'Unknown Title',
      album: best.title || 'Unknown Album',
      albumId: best.id,
      confidence: Math.min(0.99, scored[0].score/100),
      source: 'collection',
      service: 'Collection',
      image_url: best.image_url || undefined,
      folder: best.folder || undefined
    }, processingTime: Date.now()-startTime };
  } catch (e:any) {
    return { service:'Collection', status:'error', error: e?.message ?? 'Collection lookup failed', processingTime: Date.now()-startTime };
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const { buffer, contentType, ext, durationSec } = pickAudioFromBody(body);
    if (buffer.length < 4096) return NextResponse.json({ success:false, error:'Audio too small' }, { status: 400 });

    const publicUrl = await uploadSampleAndGetUrl(`sample.${ext}`, buffer, contentType);

    const [acr, audd, shazam, acoust] = await Promise.all([
      checkACRCloud(buffer, ext),
      checkAudDByUrl(publicUrl),
      checkShazamByUrl(publicUrl),
      ext === 'wav' ? checkAcoustIDWithChromaprintIfAvailable(buffer, durationSec) : Promise.resolve({ service:'AcoustID', status:'skipped', error:'Not WAV', processingTime:0 } as ServiceResult)
    ]);

    const serviceResults: ServiceResult[] = [acr, audd, shazam, acoust];

    const candidates = serviceResults.filter(s => s.status==='success').map(s => s.result!) as RecognitionMatch[];
    let best: RecognitionMatch | undefined = candidates[0];
    if (candidates.length > 1) {
      const order: Record<string, number> = { 'ACRCloud':0, 'AudD':1, 'Shazam':2, 'AcoustID':3 };
      candidates.sort((a,b)=> (order[a.service]??9) - (order[b.service]??9));
      best = candidates[0];
    }

    const alternatives: RecognitionMatch[] = [];
    if (best?.artist && best?.title) {
      const [sp, lf, coll] = await Promise.all([
        searchSpotifyTrack(best.artist, best.title),
        searchLastFMTrack(best.artist, best.title),
        checkCollectionByMetadata(best)
      ]);
      if (sp) alternatives.push(sp as any);
      if (lf) alternatives.push(lf as any);
      if (coll.status === 'success' && coll.result) alternatives.push(coll.result);
    }

    return NextResponse.json({
      success: Boolean(best),
      autoSelected: best || null,
      alternatives,
      serviceResults,
      processingTime: Date.now()-startTime
    });
  } catch (e:any) {
    return NextResponse.json({ success:false, error: e?.message ?? 'Recognition failed' }, { status: 500 });
  }
}