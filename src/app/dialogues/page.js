// Dialogues page ("/dialogues")
// Lists all WordPress articles (with tag/category badges), and embedded playlists.

"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Footer from "components/Footer";
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

// Extract the first image from content HTML
function extractFirstImg(html) {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"'>]+)["']/i);
  return match ? match[1] : null;
}

function Tags({ categories }) {
  if (!categories || !categories.length) return null;
  return (
    <div className="post-tags">
      {categories.map((cat, i) => (
        <span key={i} className={`tag tag-${cat.toLowerCase()}`}>
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
    <div className="page-wrapper">
      <header className="event-hero">
        <div className="overlay">
          <h1>Dialogues</h1>
        </div>
      </header>
      <main className="event-body">
        <div className="dialogues-body-row">
          <div className="dialogues-main-col">
            {/* Featured from WordPress */}
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
                  <Tags categories={featured.categories} />
                </div>
              </div>
            )}

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
                    <Tags categories={post.categories} />
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
