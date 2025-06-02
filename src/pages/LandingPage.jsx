import React from 'react';
import { Link } from 'react-router-dom';

function LandingPage() {
  return (
    <div className="landing-page">
      <h1 className="text-4xl font-bold mb-8 text-center">Dead Wax Dialogues</h1>
      <div className="flex flex-col items-center gap-4">
        <Link to="/events" className="btn">Events</Link>
        <Link to="/browse" className="btn">Browse Collection</Link>
        <Link to="/dialogues" className="btn">Dialogues</Link>
        <Link to="/about" className="btn">About</Link>
      </div>
    </div>
  );
}

export default LandingPage;
