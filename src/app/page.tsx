// Home page ("/") — Landing for Dead Wax Dialogues (TypeScript version)

import Link from "next/link";
import "styles/landing.css";

export default function Page() {
  return (
    <header className="hero">
      <video autoPlay muted loop playsInline className="hero-video">
        <source src="/videos/header-video.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <div className="overlay"></div>
      <div className="hero-content">
        <h1 className="text-white">Dead Wax Dialogues</h1>
        <p className="text-white">Drop the needle. Let the side play.</p>
        <nav className="hero-nav">
          <Link href="/events/events-page">Events</Link>
          <Link href="/browse/browse-albums">Browse Collection</Link>
          <Link href="/dialogues">Dialogues</Link>
          <Link href="/about">About</Link>
        </nav>
      </div>
    </header>
  );
}
