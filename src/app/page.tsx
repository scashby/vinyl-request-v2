// Home page ("/") — Landing for Dead Wax Dialogues

"use client";

import Link from "next/link";
import { useSession } from "src/components/AuthProvider";
import "styles/landing.css";

export default function Page() {
  const { session } = useSession();

  return (
    <div className="landing-page dark">
      <header className="hero">
        <video autoPlay muted loop playsInline className="hero-video">
          <source src="/videos/header-video.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        <div className="hero-content">
          <h1>Dead Wax Dialogues</h1>
          <p>A vinyl-focused listening lounge, jukebox, and community.</p>

          <nav className="hero-nav">
            <a href="/browse/browse-queue">Browse Queue</a>
            <a href="/browse/browse-albums">Browse Albums</a>
            <a href="/events/events-page">Events</a>
            <a href="/dialogues">Dialogues</a>

            {session && (
              <Link
                href="/admin/admin-dashboard"
                style={{
                  backgroundColor: "rgba(37, 99, 235, 0.8)",
                  padding: "0.5rem 1rem",
                  borderRadius: "4px",
                }}
              >
                Admin
              </Link>
            )}
          </nav>
        </div>
      </header>
    </div>
  );
}
