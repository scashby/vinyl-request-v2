
import React from 'react';
import '../styles/landing.css';

const LandingPage = () => {
  return (
    <div className="landing-page">
      {/* Video Header Start */}
      <header className="video-header">
        <video autoPlay muted loop className="background-video">
          <source src="/videos/header-video.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="overlay-text">
          <h1>Dead Wax Dialogues</h1>
          <p>Full-side explorations, analog warmth, community vibes</p>
        </div>
      </header>
      {/* Video Header End */}
      <section className="landing-content">
        <h2>Browse upcoming events or request vinyl sides</h2>
        {/* TODO: Add routing buttons or promo callouts here */}
      </section>
    </div>
  );
};

export default LandingPage;
