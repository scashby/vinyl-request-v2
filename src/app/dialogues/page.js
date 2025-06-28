// Dialogues page ("/dialogues")
// Lists all WordPress articles (with tag/category badges), and embedded playlists.

"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import 'styles/dialogues.css';
import 'styles/internal.css';

export default function Page() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    fetch('https://blog.deadwaxdialogues.com/wp-json/wp/v2/posts?_embed&per_page=5')
      .then(res => res.json())
      .then(setPosts)
      .catch(console.error);
  }, []);

  const getImage = (post) =>
    post?._embedded?.['wp:featuredmedia']?.[0]?.source_url || "/images/dialogues-placeholder.jpg";

  return (
    <div className="site-wrapper">
      <div className="dialogues-body-row">
        <main className="dialogues-main-col">

          <section className="dialogues-featured">
            <Image
              className="dialogues-featured-image"
              src={getImage(posts[0])}
              alt=""
              width={800}
              height={450}
              unoptimized
            />
            <div className="dialogues-featured-content">
              <span className="dialogues-featured-meta">FEATURED</span>
              <h2 className="dialogues-featured-title">
                {posts[0] ? (
                  <a href={posts[0].link} target="_blank" rel="noopener noreferrer">
                    {posts[0].title.rendered}
                  </a>
                ) : (
                  "Title of the featured interview goes here"
                )}
              </h2>
              <div className="dialogues-featured-date">
                {posts[0]
                  ? new Date(posts[0].date).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "May 24, 2024"}
              </div>
              <p className="dialogues-featured-summary">
                {posts[0]
                  ? posts[0].excerpt.rendered
                  : "A short excerpt of the featured interview or article will appear here to draw users in..."}
              </p>
            </div>
          </section>

          <section className="dialogues-posts-grid">
            {[1, 2, 3].map((i) => (
              <article key={posts[i]?.id || i} className="dialogues-post">
                <Image
                  className="dialogues-post-image"
                  src={getImage(posts[i])}
                  alt=""
                  width={600}
                  height={400}
                  unoptimized
                />
                <div className="dialogues-post-content">
                  <h3 className="dialogues-post-title">
                    {posts[i] ? (
                      <a href={posts[i].link} target="_blank" rel="noopener noreferrer">
                        {posts[i].title.rendered}
                      </a>
                    ) : (
                      i === 1
                        ? "Post title"
                        : i === 2
                        ? "Another post title"
                        : "Third post title"
                    )}
                  </h3>
                  <div className="dialogues-post-date">
                    {posts[i]
                      ? new Date(posts[i].date).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : i === 1
                      ? "May 21, 2024"
                      : i === 2
                      ? "May 17, 2024"
                      : "May 12, 2024"}
                  </div>
                  <p className="dialogues-post-summary">
                    {posts[i]
                      ? posts[i].excerpt.rendered
                      : i === 1
                      ? "Short summary of the article or post goes here..."
                      : i === 2
                      ? "Another brief summary appears here with a link..."
                      : "And a third post has a quick excerpt right here..."}
                  </p>
                </div>
              </article>
            ))}
          </section>

        </main>

        <aside className="dialogues-sidebar">
          <div className="dialogues-sidebar-title">Featured Playlist</div>
          <iframe
            className="dialogues-playlist-iframe"
            src="https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M"
            width="100%"
            height="80"
            allow="encrypted-media"
          />
        </aside>
      </div>
    </div>
  );
}
