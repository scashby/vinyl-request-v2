// About page ("/about") — Original layout restored with clean structure

'use client'

import React from "react"
import 'styles/about.css'

export default function AboutPage() {
  return (
    <div className="page-wrapper">
      <main className="about-body-row">
        <div className="about-main-col">
          <h1 className="about-title">About Dead Wax Dialogues</h1>
          <p>
            Hi, I&apos;m Stephen. If you ever wanted to know why anyone still loves vinyl, cassettes, or tangling with Discogs, you&apos;re in the right place.
          </p>
          <p>
            This site is a home for vinyl drop nights, weird collection habits, top 10 wishlists, and the best and worst audio formats ever invented.
          </p>
          <p>
            There will be occasional silly interviews, commentary, and projects from the road (and the turntable).
          </p>

          <h2>Wish List</h2>
          <ul className="about-wishlist">
            <li>
              <a href="https://www.amazon.com/hz/wishlist/ls/" target="_blank" rel="noopener noreferrer">
                Full Amazon Wish List
              </a>
            </li>
            <li>
              <a href="https://www.discogs.com/user/socialblunders/wants" target="_blank" rel="noopener noreferrer">
                Full Discogs Wantlist
              </a>
            </li>
          </ul>
        </div>

        <aside className="about-sidebar">
          <h2>Top 10 Most Wanted</h2>
          <ol className="about-mostwanted">
            <li>The National – Sad Songs for Dirty Lovers (LP)</li>
            <li>Radiohead – Kid A (First UK Pressing)</li>
            <li>Fleet Foxes – Helplessness Blues (LP)</li>
            <li>Beastie Boys – Paul&apos;s Boutique (180g)</li>
            <li>PJ Harvey – Let England Shake (LP)</li>
            <li>Talk Talk – Spirit of Eden (LP)</li>
            <li>Beck – Sea Change (MoFi)</li>
            <li>Sufjan Stevens – Illinois (LP)</li>
            <li>Wilco – Yankee Hotel Foxtrot (Deluxe)</li>
            <li>Fiona Apple – Extraordinary Machine (LP)</li>
          </ol>

          <div className="about-social-feed">[Social Feed Placeholder]</div>
        </aside>
      </main>
    </div>
  )
}
