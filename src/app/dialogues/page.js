"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Footer from "components/Footer";
import 'styles/dialogues.css';
import 'styles/internal.css';

// Posts example (edit categories as you wish)
const posts = [
  {
    title: "DJ Setlist: Summer Nights Playlist",
    image: "/images/setlist.jpg",
    date: "June 8, 2025",
    categories: ["playlist"],
    summary: "Perfect side A’s for patio listening, plus Apple/Spotify embeds.",
  },
  {
    title: "Notes from the Booth",
    image: "/images/booth.jpg",
    date: "June 3, 2025",
    categories: ["blog"],
    summary: "Stories, crowd picks, and last week’s most requested LP.",
  },
  {
    title: "5 New Finds at the Shop",
    image: "/images/records.jpg",
    date: "May 29, 2025",
    categories: ["news"],
    summary: "Quick reviews of the freshest wax in the collection.",
  },
];

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

function extractFirstImg(html) {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"'>]+)["']/i);
  return match ? match[1] : null;
}

// Renders a single colored tag (all-caps, no pill)
function Tag({ tag }) {
  const t = tag.toLowerCase();
  let color = "#444";
  if (t === "blog") color = "#16a34a";
  if (t === "news") color = "#ea580c";
  if (t === "playlist") color = "#dc2626";
  if (t === "featured") color = "#9333ea";
  return (
    <span style={{
      color,
      fontWeight: 700,
      textTransform: "uppercase",
      fontSize: "1.05em",
      letterSpacing: "0.05em",
      marginRight: 14,
      background: "none",
      border: "none"
    }}>
      {tag}
    </span>
  );
}

export default function DialoguesPage() {
  const [featured, setFeatured] = useState(null);

  useEffect(() => {
    fetch("/api/wordpress")
      .then(res => res.json())
      .then(data => {
        if (!data.items || !Array.isArray(data.items)) return;
        const found = data.items.find(item =>
          item.categories && item.categories.some(c => c.toLowerCase() === "featured")
        );
        if (found) setFeatured(found);
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
          <div className="dialogues-main-col">
            {/* FEATURED ARTICLE: only show FEATURED tag above title, no others */}
            {featured && (
              <div className="dialogues-featured" key={featured.guid || featured.link}>
                <Image
                  className="dialogues-featured-image"
                  src={extractFirstImg(featured['content:encoded'] || featured.content) || "/images/vinyl-featured.jpg"}
                  alt={featured.title}
                  width={350}
                  height={260}
                  style={{ objectFit: "cover", borderRadius: 10 }}
                  unoptimized
                  priority
                />
                <div className="dialogues-featured-content">
                  <Tag tag="FEATURED" />
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
                </div>
              </div>
            )}

            {/* NON-FEATURED POSTS: show tags in color */}
            <div className="dialogues-posts-grid">
              {posts.map((post) => (
                <div className="dialogues-post" key={post.title}>
                  <Image
                    className="dialogues-post-image"
                    src={post.image}
                    alt={post.title}
                    width={350}
                    height={200}
                    style={{ objectFit: "cover", borderRadius: 10 }}
                    unoptimized
                  />
                  <div className="dialogues-post-content">
                    <div className="post-tags">
                      {post.categories && post.categories.map((cat, i) => (
                        <Tag tag={cat} key={i} />
                      ))}
                    </div>
                    <div className="dialogues-post-title">{post.title}</div>
                    <div className="dialogues-post-date">{post.date}</div>
                    <div className="dialogues-post-summary">{post.summary}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
