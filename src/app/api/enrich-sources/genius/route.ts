import { NextResponse } from "next/server";

const GENIUS_TOKEN = process.env.GENIUS_ACCESS_TOKEN ?? process.env.GENIUS_TOKEN;

type GeniusSearchHit = {
  result?: {
    full_title?: string;
    url?: string;
  };
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { artist, title } = body;

    if (!artist || !title) {
      return NextResponse.json({ success: false, error: 'Artist and title required' }, { status: 400 });
    }

    if (!GENIUS_TOKEN) {
      return NextResponse.json({ success: false, error: 'Genius token not configured' }, { status: 500 });
    }

    const query = encodeURIComponent(`${artist} ${title}`);
    const res = await fetch(`https://api.genius.com/search?q=${query}`, {
      headers: { Authorization: `Bearer ${GENIUS_TOKEN}` }
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: `Genius API returned ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    const hit = (data.response?.hits?.[0] as GeniusSearchHit | undefined)?.result;

    if (!hit) {
      return NextResponse.json({ success: false, error: 'No results found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        title: hit.full_title,
        url: hit.url
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
