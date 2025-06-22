// Dialogues page ("/dialogues")
// Lists all WordPress articles (with tag/category badges), and embedded playlists.

"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import 'styles/dialogues.css';
import 'styles/internal.css';

const posts = [
  {
    title: "DJ Setlist: Summer Nights Playlist",
    image: "/images/setlist.jpg",
    date: "June 8, 2025",
    type: "PLAYLIST",
    summary: "Perfect side A’s for patio listening, plus Apple/Spotify embeds.",
    categories: ["playlist"],
  },
  {
    title: "Notes from the Booth",
    image: "/images/booth.jpg",
    date: "June 3, 2025",
    type: "BLOG",
    summary: "Stories, crowd picks, and last week’s most requested LP.",
    categories: ["blog"],
  },
  {
    title: "5 New Finds at the Shop",
    image: "/images/records.jpg",
    date: "May 29, 2025",
    type: "NEWS",
    summary: "Quick reviews of the freshest wax in the collection.",
    categories: ["news"],
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

  useEffect(() => {
    fetch("/api/wordpress")
      .then(res => res.json())
      .then(data => {
        if (!data.items || !Array.isArray(data.items)) return;
        const found = data.items.find(item =>
          item.categories && item.categories.map(c => c.toLowerCase()).includes("featured")
        );
        if (found) setFeatured(found);
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
                  src={extractFirstImg(featured['content:encoded'] || featured.content) || "/images/vinyl-featured.jpg"}
                  alt={featured.title}
                  width={350}
                  height={260}
                  style={{ objectFit: "cover", borderRadius: 10 }}
                  unoptimized
                  priority
                />
                <div className="relative dialogues-featured-content">
                  <span className="badge badge-featured">FEATURED</span>
                  <h2 className="dialogues-featured-title">{featured.title}</h2>
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
              {posts.map((post) => (
                <div className="relative dialogues-post" key={post.title}>
                  <Image
                    className="dialogues-post-image"
                    src={post.image}
                    alt={post.title}
                    width={350}
                    height={200}
                    style={{ objectFit: "cover", borderRadius: 10 }}
                    unoptimized
                  />
                  <div className="relative dialogues-post-content">
                    <Tags categories={post.categories} />
                    <div className="relative dialogues-post-title">{post.title}</div>
                    <div className="relative dialogues-post-date">{post.date}</div>
                    <div className="relative dialogues-post-summary">{post.summary}</div>
                  </div>
                </div>
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
