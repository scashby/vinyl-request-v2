// API route: /api/substack
// Returns the latest Substack feed items using rss-parser, with categories/tags included.

import Parser from 'rss-parser';

export async function GET() {
  // Instruct rss-parser to extract the <category> fields as "categories" array
  const parser = new Parser({
    customFields: {
      item: [
        ['category', 'categories', { keepArray: true }],
      ],
    },
  });
  try {
    const feed = await parser.parseURL('https://deadwaxdialogues.substack.com/feed');
    // Normalize: ensure every item.categories is always an array (even if empty)
    feed.items.forEach(item => {
      if (!item.categories) item.categories = [];
    });
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
