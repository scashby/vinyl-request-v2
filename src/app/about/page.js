// About page ("/about") — final layout with hero, scrollable social feed, top 10 and wishlist

'use client'

import React, { useEffect, useState } from "react"
import 'styles/about.css'

export default function AboutPage() {
  const [mostWanted, setMostWanted] = useState([]);

  useEffect(() => {
    fetch("/api/most-wanted")
      .then(res => res.json())
      .then(data => setMostWanted(data));
  }, []);

  return (
    <div className="page-wrapper">
      <header className="about-hero">
        <div className="overlay">
          <h1>About</h1>
        </div>
      </header>
      <main className="event-body">
        <div className="about-body-row">
          <div className="about-main-col">
            <div className="about-body-container">
              <h2 className="about-title">About Dead Wax Dialogues</h2>
              <p>
                Hi, I&apos;m Stephen. If you ever wanted to know why anyone still loves vinyl, cassettes, or tangling with Discogs, you&apos;re in the right place.
              </p>
              <p>
                This site is a home for vinyl drop nights, weird collection habits, top 10 wishlists, and the best and worst audio formats ever invented.
              </p>
              <p>
                There will be occasional silly interviews, commentary, and projects from the road (and the turntable).
              </p>

              <div className="about-social-feed">
                <h3>Recent Social Posts</h3>
                <div className="social-widgets">

                  {/* Instagram Embed */}
                  <div
                    className="social-embed"
                    dangerouslySetInnerHTML={{ __html: `
                      <blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/deadwaxdialogues" data-instgrm-version="12" style="max-width:540px;width:100%"></blockquote>
                      <script async src="https://www.instagram.com/embed.js"></script>
                    ` }}
                  />

                  {/* Facebook Embed */}
                  <div
                    className="social-embed"
                    dangerouslySetInnerHTML={{ __html: `
                      <iframe frameborder="0" width="340" height="130" src="https://www.facebook.com/v9.0/plugins/page.php?adapt_container_width=true&app_id=113869198637480&href=https://www.facebook.com/profile.php?id=61576451743378&tabs=timeline&width=500&height=130&hide_cover=false&show_facepile=true&small_header=true"></iframe>
                    ` }}
                  />

                  {/* BlueSky Embed */}
                  <div className="social-embed">
                    <script async src="https://cdn.jsdelivr.net/npm/bsky-embed@0.0.5/dist/bsky-embed.es.js"></script>
                    <bsky-embed username="deadwaxdialogues" limit="5"></bsky-embed>
                  </div>

                </div>
              </div>
            </div>
          </div>

          <aside className="about-sidebar">
            <div className="about-sidebar-title">Top 10 Most Wanted</div>
            <ol className="about-mostwanted">
              {mostWanted.map((item) => (
                <li key={item.id}>
                  <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
                </li>
              ))}
            </ol>
            <div className="about-wishlist">
              <h3>Wish List</h3>
              <a href="https://www.amazon.com/hz/wishlist/ls/" target="_blank" rel="noopener noreferrer">
                Full Amazon Wish List
              </a>
              <a href="https://www.discogs.com/user/socialblunders/wants" target="_blank" rel="noopener noreferrer">
                Full Discogs Wantlist
              </a>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
