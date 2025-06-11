// API route: /api/substack
// Returns the latest Substack feed items using rss-parser.

import Parser from 'rss-parser';

export async function GET() {
  const parser = new Parser();
  try {
    const feed = await parser.parseURL('https://deadwaxdialogues.substack.com/feed');
    // Next.js way to set caching headers:
    return new Response(
      JSON.stringify({ items: feed.items }),
      {
        status: 200,
        headers: { 'Cache-Control': 's-maxage=1800' }
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500 }
    );
  }
}
