// src/app/api/enrich-sources/discogs-versions/route.ts
import { NextResponse } from "next/server";

const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN ?? process.env.NEXT_PUBLIC_DISCOGS_TOKEN;

type DiscogsVersion = {
  format?: string;
  major_formats?: string[];
  country?: string;
  title?: string;
  label?: string;
  catno?: string;
  released?: string;
};

type DiscogsVersionsResponse = {
  versions?: DiscogsVersion[];
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const masterId = searchParams.get('masterId');
    
    if (!masterId) {
      return NextResponse.json({ error: 'masterId required' }, { status: 400 });
    }

    if (!DISCOGS_TOKEN) {
      return NextResponse.json({ error: 'Discogs token not configured' }, { status: 500 });
    }

    const res = await fetch(
      `https://api.discogs.com/masters/${masterId}/versions?per_page=500`,
      {
        headers: {
          'User-Agent': 'DeadwaxDialogues/1.0',
          'Authorization': `Discogs token=${DISCOGS_TOKEN}`
        }
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: `Discogs API error: ${res.status}` }, { status: res.status });
    }

    const data: DiscogsVersionsResponse = await res.json();
    
    const versions = (data.versions || []).map((v: DiscogsVersion) => ({
      format: v.format,
      major_formats: v.major_formats || [],
      country: v.country,
      title: v.title,
      label: v.label,
      catno: v.catno,
      released: v.released
    }));

    return NextResponse.json({ versions });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}