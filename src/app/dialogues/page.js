// Dialogues page ("/dialogues")
// Lists all WordPress articles (with tag/category badges), and embedded playlists.

"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import 'styles/dialogues.css';
import 'styles/internal.css';

const playlists = [
  {
    platform: "Spotify",
    embed: "https://open.spotify.com/embed/playlist/37i9dQZF1DX2sUQwD7tbmL?utm_source=generator",
  },
  {
    platform: "Apple Music",
    embed: "https://embed.music.apple.com/us/playlist/indie-plaza/pl.1234567890abcdef",
  },
  {
    platform: "Tidal",
    embed: "https://embed.tidal.com/albums/192548722?layout=gridify",
  },
];

function extractFirstImg(post) {
  const html = post["content:encoded"] || post.content || "";
  const match = html.match(/<img[^>]+src=["']([^"'>]+)["']/i);
  if (match) return match[1];

  const media = post["media:thumbnail"]?.url || post["media:content"]?.url;
  return media || null;
}

function Tags({ categories }) {
  if (!categories || !categories.length) return null;
  return (
    <div className="post-tags relative">
      {categories.map((cat, i) => (
        <span key={i} className={`tag tag-${cat.toLowerCase()} badge badge-${cat.toLowerCase()}`}>
          {cat.toUpperCase()}
        </span>
      ))}
    </div>
  );
}

export default function DialoguesPage() {
  const [featured, setFeatured] = useState(null);
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    fetch("/api/wordpress")
      .then(res => res.json())
      .then(data => {
        if (!data.items || !Array.isArray(data.items)) return;

        const all = data.items;
        const featuredItem = all.find(item =>
          item.categories?.map(c => c.toLowerCase()).includes("featured")
        );
        const rest = all.filter(item => item !== featuredItem);

        const cleaned = rest.map(p => ({
          ...p,
          categories: (p.categories || []).filter(c => c.toLowerCase() !== "featured")
        }));

        setFeatured(featuredItem);
        setArticles(cleaned);
      });
  }, []);

  return (
    <div className="relative page-wrapper">
      <header className="event-hero">
        <div className="relative overlay">
          <h1>Dialogues</h1>
        </div>
      </header>
      <main className="event-body">
        <div className="relative dialogues-body-row">
          <div className="relative dialogues-main-col">
            {featured && (
              <div className="relative dialogues-featured" key={featured.guid || featured.link}>
                <Image
                  className="dialogues-featured-image"
                  src={extractFirstImg(featured) || "/images/vinyl-featured.jpg"}
                  alt={featured.title}
                  width={350}
                  height={260}
                  style={{ objectFit: "cover", borderRadius: 10 }}
                  unoptimized
                  priority
                />
                <div className="relative dialogues-featured-content">
                  <span className="badge badge-featured">FEATURED</span>
                  <h2 className="dialogues-featured-title">
                    <a href={featured.link} target="_blank" rel="noopener noreferrer">
                      {featured.title}
                    </a>
                  </h2>
                  <div className="relative dialogues-featured-date">
                    {featured.pubDate
                      ? new Date(featured.pubDate).toLocaleDateString(undefined, {
                          year: "numeric", month: "long", day: "numeric"
                        })
                      : ""}
                  </div>
                  <p className="dialogues-featured-summary">
                    {featured.contentSnippet || ""}
                  </p>
                </div>
              </div>
            )}

            <div className="relative dialogues-posts-grid">
              {articles.map((post) => (
                <a
                  href={post.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative dialogues-post"
                  key={post.guid || post.link}
                >
                  <Image
                    className="dialogues-post-image"
                    src={extractFirstImg(post) || "/images/vinyl-featured.jpg"}
                    alt={post.title}
                    width={350}
                    height={200}
                    style={{ objectFit: "cover", borderRadius: 10 }}
                    unoptimized
                  />
                  <div className="relative dialogues-post-content">
                    <Tags categories={post.categories} />
                    <div className="relative dialogues-post-title">{post.title}</div>
                    <div className="relative dialogues-post-date">
                      {post.pubDate ? new Date(post.pubDate).toLocaleDateString(undefined, {
                        year: "numeric", month: "long", day: "numeric"
                      }) : ""}
                    </div>
                    <div className="relative dialogues-post-summary">{post.contentSnippet || ""}</div>
                    <a
                      href={post.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dialogues-read-more"
                    >
                      Read more →
                    </a>
                  </div>
                </a>
              ))}
            </div>
          </div>

          <aside className="dialogues-sidebar">
            <div className="relative dialogues-sidebar-title">Playlists</div>
            <div className="relative dialogues-sidebar-list">
              {playlists.map((p) => (
                <div className="relative dialogues-playlist" key={p.platform}>
                  <div className="relative dialogues-playlist-label">{p.platform}</div>
                  <iframe
                    title={p.platform}
                    src={p.embed}
                    width="100%"
                    height="80"
                    className="dialogues-playlist-iframe"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                  ></iframe>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
