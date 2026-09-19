import Parser from 'rss-parser';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from 'src/lib/supabaseAdmin';
import { keyForPostLink, type PostFocus } from 'src/lib/dialoguesPostFocus';

const BLOG_ORIGIN = 'https://blog.deadwaxdialogues.com';
const POST_FOCUS_KEY_PREFIX = 'dialogues:post-focus:';

// Per-post pan/zoom overrides saved from /admin/edit-dialogues, keyed by a
// hash of the post's own permalink (see src/lib/dialoguesPostFocus.ts).
async function fetchPostFocusByLink(): Promise<Map<string, PostFocus>> {
  const lookup = new Map<string, PostFocus>();
  try {
    const { data: rows } = await supabaseAdmin
      .from('admin_settings')
      .select('key, value')
      .like('key', `${POST_FOCUS_KEY_PREFIX}%`);
    for (const row of rows ?? []) {
      const key = (row.key as string).slice(POST_FOCUS_KEY_PREFIX.length);
      try {
        lookup.set(key, JSON.parse(row.value as string) as PostFocus);
      } catch {
        // Skip malformed rows.
      }
    }
  } catch {
    // Supabase being unreachable shouldn't break the feed.
  }
  return lookup;
}

type FeaturedMediaLookup = Map<string, string>;

// The RSS feed's <content:encoded> only ever has an image when the author
// happened to embed one inline in the post body — a post that only has a
// "featured image" set via the editor's picker (never inserted into the
// text) shows up with zero <img> tags at all, and no <enclosure>/media RSS
// field either. WordPress's REST API exposes that featured image properly
// via _embedded['wp:featuredmedia'], so fetch it separately and merge it in
// by permalink (which matches between the two APIs, including for posts
// whose permalink points out to Substack rather than this WP install).
async function fetchFeaturedMediaByLink(): Promise<FeaturedMediaLookup> {
  const lookup: FeaturedMediaLookup = new Map();
  try {
    const res = await fetch(
      `${BLOG_ORIGIN}/wp-json/wp/v2/posts?per_page=20&_embed=wp:featuredmedia&_fields=link,_links,_embedded`,
      { next: { revalidate: 1800 } }
    );
    if (!res.ok) return lookup;
    const posts = (await res.json()) as Array<{
      link?: string;
      _embedded?: { 'wp:featuredmedia'?: Array<{ source_url?: string }> };
    }>;
    for (const post of posts) {
      const url = post._embedded?.['wp:featuredmedia']?.[0]?.source_url;
      if (post.link && url) lookup.set(post.link, url);
    }
  } catch {
    // REST API being unreachable shouldn't break the RSS-based feed.
  }
  return lookup;
}

export async function GET() {
  const FEED_URL = `${BLOG_ORIGIN}/feed/`;
  const parser = new Parser({
    customFields: {
      item: [
        ['category', 'categories', { keepArray: true }],
        ['guid', 'guid'],
      ],
    },
  });

  try {
    const [feed, featuredMediaByLink, postFocusByKey] = await Promise.all([
      parser.parseURL(FEED_URL),
      fetchFeaturedMediaByLink(),
      fetchPostFocusByLink(),
    ]);

    feed.items.forEach((item) => {
      if (!item.categories) item.categories = [];
    });

    const items = feed.items.map((item) => ({
      ...item,
      featuredImageUrl: (item.link && featuredMediaByLink.get(item.link)) || null,
      postFocus: item.link ? postFocusByKey.get(keyForPostLink(item.link)) ?? null : null,
    }));

    return NextResponse.json({ items }, {
      status: 200,
      headers: { 'Cache-Control': 's-maxage=1800' }
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
