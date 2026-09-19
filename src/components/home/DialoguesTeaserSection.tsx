import Link from 'next/link';
import { Container } from 'components/ui/Container';
import type { DialoguesTeaserData } from 'src/lib/homeContent';

interface BlogPost {
  title: string;
  link: string;
  guid?: string;
  contentSnippet?: string;
  content?: string;
  'content:encoded'?: string;
  featuredImageUrl?: string | null;
}

const CARD_TILT_VARS = ['--dwd-tilt-1', '--dwd-tilt-2', '--dwd-tilt-3', '--dwd-tilt-4'];

// The RSS body only has an image to scrape when the author embedded one
// inline — a post whose only image is a proper "featured image" (set via
// the editor's picker, never inserted into the text) has none at all, so
// prefer the real featured image from the API and fall back to scraping.
const extractFirstImg = (post: BlogPost): string | null => {
  if (post.featuredImageUrl) return post.featuredImageUrl;
  const html = post['content:encoded'] || post.content || '';
  const match = html.match(/<img[^>]+src=["']([^"'>]+)["']/i);
  return match ? match[1] : null;
};

export function DialoguesTeaserSection({
  data,
  posts,
}: {
  data: DialoguesTeaserData;
  posts: BlogPost[];
}) {
  if (posts.length === 0) return null;

  return (
    <Container size="xl">
      <div className="mb-16 md:mb-20">
        <div className="flex items-baseline justify-between mb-7">
          <div className="font-[family-name:var(--dwd-font-display)] [text-transform:var(--dwd-headline-transform)] text-2xl md:text-3xl text-[var(--dwd-ink)]">
            {data.heading}
          </div>
          <Link href={data.cta_href} className="text-sm font-bold text-[var(--dwd-accent-1)] hover:text-[var(--dwd-accent-1-hover)]">
            {data.cta_label}
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {posts.map((post, i) => (
            <a
              key={post.guid || post.link}
              href={post.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group block bg-[var(--dwd-bg-card)] overflow-hidden transition-transform duration-150 hover:!rotate-0 hover:-translate-y-1 [border:var(--dwd-card-border)] [border-radius:var(--dwd-card-radius)] [box-shadow:var(--dwd-card-shadow)]"
              style={{ transform: `rotate(var(${CARD_TILT_VARS[i % CARD_TILT_VARS.length]}))` }}
            >
              <div
                className="h-[150px] bg-[var(--dwd-accent-3)] opacity-60 bg-cover bg-center"
                style={extractFirstImg(post) ? { backgroundImage: `url(${extractFirstImg(post)})`, opacity: 1 } : undefined}
              />
              <div className="p-5">
                <div className="text-base font-bold mb-2 leading-snug line-clamp-2 text-[var(--dwd-ink)]">{post.title}</div>
                <div className="text-sm text-[var(--dwd-ink-faint)] leading-relaxed line-clamp-3">
                  {post.contentSnippet || ''}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </Container>
  );
}
