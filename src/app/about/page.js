// About page ("/about") — final layout with hero, scrollable social feed, top 10 and wishlist

'use client'

import React, { useEffect, useState } from "react"
import SocialEmbeds from "components/SocialEmbeds"
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
                  <SocialEmbeds />

                  <div className="social-embed">
                    <a
                      href="https://linktr.ee/deadwaxdialogues"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="linktree-button"
                    >
                      Visit Our Linktree
                    </a>
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
              <div className="about-sidebar-title">Wish List</div>
              <a href="https://www.amazon.com/hz/wishlist/ls/D5MXYF471325?ref_=wl_share" target="_blank" rel="noopener noreferrer">
                Full Amazon Wish List
              </a>
              <a href="https://www.discogs.com/wantlist?user=socialblunders" target="_blank" rel="noopener noreferrer">
                Full Discogs Wantlist
              </a>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
