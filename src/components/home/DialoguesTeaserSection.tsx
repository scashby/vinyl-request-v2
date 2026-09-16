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
}

const CARD_TILTS = ['-rotate-[1.2deg]', 'rotate-1', '-rotate-[0.6deg]', 'rotate-[1.4deg]'];

const extractFirstImg = (post: BlogPost): string | null => {
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
          <div className="font-[family-name:var(--font-alfa-slab)] text-2xl md:text-3xl text-[#2A2118]">
            {data.heading}
          </div>
          <Link href={data.cta_href} className="text-sm font-bold text-[#C1502E] hover:text-[#8F3A1F]">
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
              className={`group block bg-white border-2 border-[#2A2118] rounded-xl overflow-hidden transition-transform duration-150 hover:!rotate-0 hover:-translate-y-1 ${CARD_TILTS[i % CARD_TILTS.length]}`}
              style={{ boxShadow: '6px 6px 0 rgba(42,33,24,0.08)' }}
            >
              <div
                className="h-[150px] bg-[#D8C9AE] bg-cover bg-center"
                style={extractFirstImg(post) ? { backgroundImage: `url(${extractFirstImg(post)})` } : undefined}
              />
              <div className="p-5">
                <div className="text-base font-bold mb-2 leading-snug line-clamp-2">{post.title}</div>
                <div className="text-sm text-[#6B5B45] leading-relaxed line-clamp-3">
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
