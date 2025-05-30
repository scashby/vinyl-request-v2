import React from "react";
import "./EventsPage.css";

const mockEvents = [
  { id: 1, title: "Vinyl Sunday", image: "/event1.jpg" },
  { id: 2, title: "Indie Night", image: "/event2.jpg" },
];

export default function EventsPage() {
  return (
    <div className="events-grid">
      {mockEvents.map(event => (
        <div key={event.id} className="event-card">
          <img src={event.image} alt={event.title} className="event-image" />
          <h2>{event.title}</h2>
        </div>
      ))}
    </div>
  );
}
