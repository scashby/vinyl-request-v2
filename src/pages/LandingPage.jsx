import React from "react";
import "./LandingPage.css";

export default function LandingPage() {
  return (
    <div className="landing-container">
      <video autoPlay muted loop playsInline className="background-video">
        <source src="/hero-background.mp4" type="video/mp4" />
      </video>
      <div className="overlay-content">
        <img src="/deadwax-logo.svg" alt="Dead Wax Dialogues" className="hero-logo" />
        <h1>Drop the Needle</h1>
      </div>
    </div>
  );
}
