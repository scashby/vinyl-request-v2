// Dialogues page ("/dialogues")
// Lists all WordPress articles (with tag/category badges), and embedded playlists.

"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Footer from "components/Footer";
import 'styles/dialogues.css';
import 'styles/internal.css';

// Playlists (unchanged)
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

// Utility to extract first image from HTML
function extractFirstImg(html) {
  const match = html && html.match(/<img[^>]+src="([^">]+)"/i);
  return match ? match[1] : null;
}

export default function DialoguesPage() {
  const [articles, setArticles] = useState([]);
  const [featured, setFeatured] = useState(null);

  useEffect(() => {
    fetch("/api/wordpress")
      .then(res => res.json())
      .then(data => {
        setArticles(data.items || []);
        // Find a post tagged 'featured' (case-insensitive)
        const found = data.items?.find(item =>
          item.categories && item.categories.some(c => c.toLowerCase() === "featured")
        );
        setFeatured(found || null);
      });
  }, []);

  return (
    <div className="page-wrapper">
      <header className="event-hero">
        <div className="overlay">
          <h1>Dialogues</h1>
        </div>
      </header>
      <main className="event-body">
        <div className="dialogues-body-row">
          {/* Main column */}
          <div className="dialogues-main-col">
            {/* Featured Article */}
            {featured && (
              <div className="dialogues-featured" key={featured.guid || featured.link}>
                <Image
                  className="dialogues-featured-image"
                  src={extractFirstImg(featured['content:encoded'] || featured.content) || "/images/vinyl-featured.jpg"}
                  alt={featured.title}
                  width={700}
                  height={260}
                  style={{ objectFit: "cover", borderRadius: 14 }}
                  unoptimized
                />
                <div className="dialogues-featured-content">
                  <span className="dialogues-featured-meta">FEATURED</span>
                  <h2 className="dialogues-featured-title">{featured.title}</h2>
                  <div className="dialogues-featured-date">
                    {featured.pubDate
                      ? new Date(featured.pubDate).toLocaleDateString(undefined, {
                          year: "numeric", month: "long", day: "numeric"
                        })
                      : ""}
                  </div>
                  <p className="dialogues-featured-summary">
                    {featured.contentSnippet || ""}
                  </p>
                  {/* Tag badges */}
                  {featured.categories && featured.categories.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {featured.categories.map((cat, i) => (
                        <span
                          key={i}
                          className={`dialogues-post-meta-tag${cat.toLowerCase() === "featured" ? " dialogues-post-meta-featured" : ""}`}
                          style={{
                            display: "inline-block",
                            marginRight: 6,
                            padding: "2px 8px",
                            background: cat.toLowerCase() === "featured" ? "#9333ea" : "#f1f1f1",
                            color: cat.toLowerCase() === "featured" ? "#fff" : "#222",
                            borderRadius: 8,
                            fontSize: "0.75rem",
                            fontWeight: 500,
                            textTransform: "uppercase",
                            letterSpacing: "0.03em",
                          }}
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* All Articles Grid */}
            <div className="dialogues-posts-grid">
              {articles.filter(item => !(
                item.categories && item.categories.some(c => c.toLowerCase() === "featured")
              )).map((item) => (
                <div className="dialogues-post" key={item.guid || item.link}>
                  <Image
                    className="dialogues-post-image"
                    src={extractFirstImg(item['content:encoded'] || item.content) || "/images/vinyl-featured.jpg"}
                    alt={item.title}
                    width={350}
                    height={200}
                    style={{ objectFit: "cover", borderRadius: 10 }}
                    unoptimized
                  />
                  <div className="dialogues-post-content">
                    {/* Tag/category badges */}
                    <div style={{ marginBottom: 8 }}>
                      {item.categories && item.categories.map((cat, i) => (
                        <span
                          key={i}
                          className={`dialogues-post-meta-tag${cat.toLowerCase() === "featured" ? " dialogues-post-meta-featured" : ""}`}
                          style={{
                            display: "inline-block",
                            marginRight: 6,
                            padding: "2px 8px",
                            background: cat.toLowerCase() === "featured" ? "#9333ea" : "#f1f1f1",
                            color: cat.toLowerCase() === "featured" ? "#fff" : "#222",
                            borderRadius: 8,
                            fontSize: "0.75rem",
                            fontWeight: 500,
                            textTransform: "uppercase",
                            letterSpacing: "0.03em",
                          }}
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                    <div className="dialogues-post-title">{item.title}</div>
                    <div className="dialogues-post-date">
                      {item.pubDate
                        ? new Date(item.pubDate).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : ""}
                    </div>
                    <div className="dialogues-post-summary">
                      {item.contentSnippet || ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Sidebar */}
          <aside className="dialogues-sidebar">
            <div className="dialogues-sidebar-title">Playlists</div>
            <div className="dialogues-sidebar-list">
              {playlists.map((p) => (
                <div className="dialogues-playlist" key={p.platform}>
                  <div className="dialogues-playlist-label">{p.platform}</div>
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
      <Footer />
    </div>
  );
}
