// About page ("/about") — Info and wishlist for Dead Wax Dialogues

'use client'

import React from "react"
import 'styles/about.css'

export default function AboutPage() {
  return (
    <div className="page-wrapper">
      <header className="event-hero">
        <div className="overlay">
          <h1>About</h1>
        </div>
      </header>
      <main className="event-body">
        <div className="about-body-row">
          <div className="about-main-col">
            <div className="about-body-container">
              <h2 className="about-title">About Dead Wax Dialogues</h2>
              <p className="about-intro">
                Hi, I&apos;m Stephen. If you ever wanted to know why anyone still loves vinyl, cassettes, or tangling with Discogs, you’re in the right place.
              </p>
              <div className="about-qa">
                <div className="about-qa__q"><strong>Q:</strong> Why vinyl?</div>
                <div className="about-qa__a"><strong>A:</strong> Because you can hold it, hear it, and see the music. It’s not just sound, it’s an experience.</div>
                <div className="about-qa__q"><strong>Q:</strong> What’s your favorite side to drop?</div>
                <div className="about-qa__a"><strong>A:</strong> Side A, always. But Side B after midnight.</div>
                <div className="about-qa__q"><strong>Q:</strong> Most wanted record right now?</div>
                <div className="about-qa__a"><strong>A:</strong> See the wish list below. (Feel free to send one my way.)</div>
                <div className="about-qa__q"><strong>Q:</strong> Where can I find you online?</div>
                <div className="about-qa__a"><strong>A:</strong> Try the linktree below—or at the next vinyl night.</div>
              </div>
              <h3>Top 10 Most Wanted</h3>
              <ol>
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
            </div>
          </div>
          <aside className="about-sidebar">
            <div className="about-sidebar-title">Wish List</div>
            <div className="about-sidebar-list">
              <a href="https://www.amazon.com/hz/wishlist/ls/" target="_blank" rel="noopener noreferrer">
                Full Amazon Wish List
              </a>
              <a href="https://www.discogs.com/user/socialblunders/wants" target="_blank" rel="noopener noreferrer">
                Full Discogs Wantlist
              </a>
            </div>
            <div className="about-social-feed">[Social Feed Placeholder]</div>
          </aside>
        </div>
      </main>
    </div>
  )
}
