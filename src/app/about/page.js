// About page ("/about") — final layout with hero, scrollable social feed, top 10 and wishlist

'use client'

import React from "react"
import 'styles/about.css'

export default function AboutPage() {
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
                <div className="social-scroll-strip">
                  <div className="social-card">
                    <h4>@instagram</h4>
                    <p>Spinning Blue Note reissues tonight at Devil’s Purse 🍻</p>
                    <time>2h ago</time>
                  </div>
                  <div className="social-card">
                    <h4>@threads</h4>
                    <p>Nothing beats a good Side B after midnight.</p>
                    <time>4h ago</time>
                  </div>
                  <div className="social-card">
                    <h4>@bluesky</h4>
                    <p>New Discogs arrivals in the crate 📦</p>
                    <time>6h ago</time>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <aside className="about-sidebar">
            <div className="about-sidebar-title">Top 10 Most Wanted</div>
            <ol className="about-mostwanted">
              <li><a href="#">The National – Sad Songs for Dirty Lovers (LP)</a></li>
              <li><a href="#">Radiohead – Kid A (First UK Pressing)</a></li>
              <li><a href="#">Fleet Foxes – Helplessness Blues (LP)</a></li>
              <li><a href="#">Beastie Boys – Paul&apos;s Boutique (180g)</a></li>
              <li><a href="#">PJ Harvey – Let England Shake (LP)</a></li>
              <li><a href="#">Talk Talk – Spirit of Eden (LP)</a></li>
              <li><a href="#">Beck – Sea Change (MoFi)</a></li>
              <li><a href="#">Sufjan Stevens – Illinois (LP)</a></li>
              <li><a href="#">Wilco – Yankee Hotel Foxtrot (Deluxe)</a></li>
              <li><a href="#">Fiona Apple – Extraordinary Machine (LP)</a></li>
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
