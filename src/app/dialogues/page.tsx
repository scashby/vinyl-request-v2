// src/app/dialogues/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Container } from "components/ui/Container";
import { useActiveTheme } from "src/lib/useActiveTheme";
import { getSocialIcon } from "src/lib/socialIcons";
import { DEFAULT_SECTIONS, type ConnectData, type HomepageSection } from "src/lib/homeContent";
import { postFocusStyle } from "src/lib/dialoguesPostFocus";

interface DialoguesIntroData {
  heading: string;
  subhead: string;
}

interface DialoguesSidebarData {
  heading: string;
  description: string;
}

const DEFAULT_INTRO: DialoguesIntroData = {
  heading: "Dialogues",
  subhead: "Crate digs, liner notes, and whatever else is on the turntable.",
};

const DEFAULT_SIDEBAR: DialoguesSidebarData = {
  heading: "Follow Along",
  description: "New posts, photos, and the playlist — wherever you already hang out.",
};

interface BlogPost {
  title: string;
  link: string;
  guid?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  "content:encoded"?: string;
  categories?: string[];
  featuredImageUrl?: string | null;
  postFocus?: { x: number; y: number; zoom: number } | null;
}

const CARD_TILT_VARS = ["--dwd-tilt-1", "--dwd-tilt-2", "--dwd-tilt-3", "--dwd-tilt-4"];

// The RSS body only has an image to scrape when the author embedded one
// inline — a post whose only image is a proper "featured image" (set via
// the editor's picker, never inserted into the text) has none at all, so
// prefer the real featured image from the API and fall back to scraping.
function extractFirstImg(post: BlogPost): string | null {
  if (post.featuredImageUrl) return post.featuredImageUrl;
  const html = post["content:encoded"] || post.content || "";
  const match = html.match(/<img[^>]+src=["']([^"'>]+)["']/i);
  if (match) return match[1];
  return null;
}

function Tags({ categories }: { categories?: string[] }) {
  if (!categories || !categories.length) return null;

  return (
    <div className="flex flex-wrap gap-3 mb-2">
      {categories.map((cat, i) => (
        <span key={i} className="font-bold text-xs uppercase tracking-wider text-[var(--dwd-accent-1)]">
          {cat.toUpperCase()}
        </span>
      ))}
    </div>
  );
}

export default function DialoguesPage() {
  const [featured, setFeatured] = useState<BlogPost | null>(null);
  const [articles, setArticles] = useState<BlogPost[]>([]);
  const [connectData, setConnectData] = useState<ConnectData>(DEFAULT_SECTIONS.connect);
  const [intro, setIntro] = useState<DialoguesIntroData>(DEFAULT_INTRO);
  const [sidebarCopy, setSidebarCopy] = useState<DialoguesSidebarData>(DEFAULT_SIDEBAR);
  const { cssVars } = useActiveTheme();

  useEffect(() => {
    fetch("/api/homepage-sections?page=home")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: HomepageSection<Partial<ConnectData>>[]) => {
        const connectRow = rows.find((r) => r.section_type === "connect");
        if (connectRow) setConnectData({ ...DEFAULT_SECTIONS.connect, ...connectRow.data });
      })
      .catch((err) => console.error("Error loading social links:", err));
  }, []);

  useEffect(() => {
    fetch("/api/homepage-sections?page=dialogues")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: { section_type: string; data: Record<string, unknown> }[]) => {
        const introRow = rows.find((r) => r.section_type === "dialogues_intro");
        if (introRow) setIntro({ ...DEFAULT_INTRO, ...introRow.data } as DialoguesIntroData);
        const sidebarRow = rows.find((r) => r.section_type === "dialogues_sidebar");
        if (sidebarRow) setSidebarCopy({ ...DEFAULT_SIDEBAR, ...sidebarRow.data } as DialoguesSidebarData);
      })
      .catch((err) => console.error("Error loading dialogues page content:", err));
  }, []);

  useEffect(() => {
    fetch("/api/wordpress")
      .then(res => res.json())
      .then(data => {
        if (!data.items || !Array.isArray(data.items)) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: BlogPost[] = data.items.map((p: any) => ({
          ...p,
          link: p.guid || p.link
        }));

        const featuredItem = items.find(item =>
          item.categories?.map(c => c.toLowerCase()).includes("featured")
        );
        setFeatured(featuredItem || null);

        const rest = items.filter(item => item !== featuredItem);
        setArticles(rest);
      });
  }, []);

  return (
    <div
      className="min-h-screen font-[family-name:var(--dwd-font-body)] bg-[var(--dwd-bg)] text-[var(--dwd-ink)]"
      style={cssVars}
    >
      <Container size="xl">
        <div className="pt-16 pb-10 md:pt-20">
          <div className="font-[family-name:var(--dwd-font-display)] [text-transform:var(--dwd-headline-transform)] text-4xl md:text-5xl mb-3">
            {intro.heading}
          </div>
          <p className="text-lg text-[var(--dwd-ink-soft)] max-w-xl">
            {intro.subhead}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-10 items-start pb-20">

          {/* Main Content */}
          <div className="flex-1 min-w-0 w-full">
            {featured && (
              <div
                className="overflow-hidden mb-10 flex flex-col md:flex-row bg-[var(--dwd-bg-card)] [border:var(--dwd-card-border)] [border-radius:var(--dwd-card-radius)] [box-shadow:var(--dwd-card-shadow)]"
              >
                <div className="md:w-1/2 md:self-start relative aspect-[4/3] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element -- transform-origin math needs a raw img, which next/image's fill mode can't express exactly */}
                  <img
                    src={extractFirstImg(featured) || "/images/coverplaceholder.png"}
                    alt={featured.title}
                    className="absolute inset-0 h-full w-full"
                    style={postFocusStyle(featured.postFocus)}
                  />
                </div>
                <div className="p-8 md:w-1/2 flex flex-col justify-center">
                  <div className="mb-2">
                    <span className="font-bold text-xs uppercase tracking-wider text-[var(--dwd-accent-1)]">FEATURED</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold mb-3 leading-tight">
                    <a href={featured.link} target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">
                      {featured.title}
                    </a>
                  </h2>
                  <div className="text-sm text-[var(--dwd-ink-faint)] mb-4">
                    {featured.pubDate
                      ? new Date(featured.pubDate).toLocaleDateString(undefined, {
                          year: "numeric", month: "long", day: "numeric"
                        })
                      : ""}
                  </div>
                  <p className="text-[var(--dwd-ink-soft)] leading-relaxed mb-6 line-clamp-3">
                    {featured.contentSnippet || ""}
                  </p>
                  <a
                    href={featured.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--dwd-accent-1)] font-semibold hover:text-[var(--dwd-accent-1-hover)]"
                  >
                    Read more &rarr;
                  </a>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {articles.map((post, i) => (
                <div
                  className="overflow-hidden flex flex-col transition-transform duration-150 hover:!rotate-0 hover:-translate-y-1 bg-[var(--dwd-bg-card)] [border:var(--dwd-card-border)] [border-radius:var(--dwd-card-radius)] [box-shadow:var(--dwd-card-shadow)]"
                  style={{ transform: `rotate(var(${CARD_TILT_VARS[i % CARD_TILT_VARS.length]}))` }}
                  key={post.guid || post.link}
                >
                  <a
                    href={post.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col h-full"
                  >
                    <div className="relative w-full aspect-[4/3] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element -- transform-origin math needs a raw img, which next/image's fill mode can't express exactly */}
                      <img
                        src={extractFirstImg(post) || "/images/coverplaceholder.png"}
                        alt={post.title}
                        className="absolute inset-0 h-full w-full"
                        style={postFocusStyle(post.postFocus)}
                      />
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <Tags categories={post.categories} />
                      <h3 className="text-lg font-bold mb-2 leading-snug line-clamp-2">
                        {post.title}
                      </h3>
                      <div className="text-xs text-[var(--dwd-ink-faint)] mb-3">
                        {post.pubDate ? new Date(post.pubDate).toLocaleDateString(undefined, {
                          year: "numeric", month: "long", day: "numeric"
                        }) : ""}
                      </div>
                      <p className="text-sm text-[var(--dwd-ink-soft)] line-clamp-3 mb-4 flex-1">
                        {post.contentSnippet || ""}
                      </p>
                      <span className="text-[var(--dwd-accent-1)] text-sm font-semibold mt-auto">
                        Read more &rarr;
                      </span>
                    </div>
                  </a>
                </div>
              ))}
            </div>

            {articles.length > 9 && (
              <div className="mt-12 text-center">
                <a
                  href="https://blog.deadwaxdialogues.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--dwd-accent-1)] font-semibold hover:text-[var(--dwd-accent-1-hover)] text-lg"
                >
                  View more on Substack &rarr;
                </a>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside
            className="w-full lg:w-[320px] flex-shrink-0 space-y-8 p-6 bg-[var(--dwd-bg-card)] [border:var(--dwd-card-border)] [border-radius:var(--dwd-card-radius)]"
          >
            <div>
              <div className="text-lg font-bold mb-4 border-b border-[var(--dwd-ink)]/10 pb-2">
                {sidebarCopy.heading}
              </div>
              <p className="text-sm text-[var(--dwd-ink-faint)] mb-4">
                {sidebarCopy.description}
              </p>
              <div className="flex flex-wrap gap-2.5">
                {connectData.socials.map(({ name, url }) => {
                  const Icon = getSocialIcon(name);
                  return (
                    <a
                      key={name}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={name}
                      className="w-10 h-10 rounded-full bg-[var(--dwd-ink)] text-[var(--dwd-bg)] flex items-center justify-center hover:-translate-y-0.5 hover:-rotate-[4deg] transition-transform"
                    >
                      <Icon size={17} />
                    </a>
                  );
                })}
              </div>
            </div>
          </aside>

        </div>
      </Container>
    </div>
  );
}
// AUDIT: restyled for v2 brand (theme-aware, shared card language); data source unchanged.
