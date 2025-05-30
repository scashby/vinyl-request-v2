
import '../styles/landing.css';
import { useLocation } from 'react-router-dom';

function LandingPage() {
  const location = useLocation();

  return (
    <div className="header-container">
      <div className="header-video-wrapper">
        <video autoPlay muted loop className="header-video">
          <source src="/videos/header-video.mp4" type="video/mp4" />
        </video>
        <div className="header-overlay"></div>
        <div className="header-content">
          <h1>Dead Wax Dialogues</h1>
          <p>Full-side explorations, analog warmth, community vibes</p>
        </div>
      </div>
      <section className="landing-content">
        <h2>Browse upcoming events or request vinyl sides</h2>
      </section>
    </div>
  );
}

export default LandingPage;
