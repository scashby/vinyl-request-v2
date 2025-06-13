// Dialogues page ("/dialogues")
// Lists all Substack entries (since tags/categories are missing), and embedded playlists.

"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Footer from "components/Footer";

const posts = [
  {
    title: "DJ Setlist: Summer Nights Playlist",
    image: "/images/setlist.jpg",
    date: "June 8, 2025",
    type: "PLAYLIST",
    summary: "Perfect side A’s for patio listening, plus Apple/Spotify embeds.",
  },
  {
    title: "Notes from the Booth",
    image: "/images/booth.jpg",
    date: "June 3, 2025",
    type: "BLOG",
    summary: "Stories, crowd picks, and last week’s most requested LP.",
  },
  {
    title: "5 New Finds at the Shop",
    image: "/images/records.jpg",
    date: "May 29, 2025",
    type: "NEWS",
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
  const match = html && html.match(/<img[^>]+src="([^">]+)"/i);
  return match ? match[1] : null;
}

export default function Page() {
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    fetch("/api/substack")
      .then(res => res.json())
      .then(data => {
        setArticles(data.items || []);
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
          {/* Main */}
          <div className="dialogues-main-col">
            {/* Substack Articles */}
            <div className="dialogues-posts-grid">
              {articles.map((item) => (
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
                    <span className="dialogues-post-meta dialogues-post-meta--substack">
                      SUBSTACK
                    </span>
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
              {/* Original Posts grid (unchanged) */}
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
                    <span className={`dialogues-post-meta dialogues-post-meta--${post.type.toLowerCase()}`}>
                      {post.type}
                    </span>
                    <div className="dialogues-post-title">{post.title}</div>
                    <div className="dialogues-post-date">{post.date}</div>
                    <div className="dialogues-post-summary">{post.summary}</div>
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
