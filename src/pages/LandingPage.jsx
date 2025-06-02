import '../styles/landing.css';

const LandingPage = () => {
  return (
    <header className="hero">
      <video autoPlay muted loop playsInline className="hero-video">
        <source src="/videos/header-video.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <div className="overlay"></div>
      <div className="hero-content">
        <h1>Dead Wax Dialogues</h1>
        <p>Drop the needle. Let the side play.</p>
        <nav className="hero-nav">
          <a href="/events">Events</a>
          <a href="/browse">Browse Collection</a>
          <a href="/dialogues">Dialogues</a>
          <a href="/about">About</a>
        </nav>
      </div>
    </header>
  );
};

export default LandingPage;
