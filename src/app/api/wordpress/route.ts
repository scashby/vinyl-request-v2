import Parser from 'rss-parser';
import { NextResponse } from 'next/server';

export async function GET() {
  // Replace with your actual WordPress RSS feed URL
  const FEED_URL = 'https://blog.deadwaxdialogues.com/feed/';
  const parser = new Parser({
    customFields: {
      item: [
        ['category', 'categories', { keepArray: true }],
        ['guid', 'guid'],
      ],
    },
  });

  try {
    const feed = await parser.parseURL(FEED_URL);
    // Ensure categories is always an array
    feed.items.forEach(item => {
      if (!item.categories) item.categories = [];
    });
    return NextResponse.json({ items: feed.items }, {
      status: 200,
      headers: { 'Cache-Control': 's-maxage=1800' }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}