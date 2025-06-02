import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import '../../styles/events.css';

const EventsPage = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching events:', error);
      } else {
        setEvents(data);
      }
    };

    fetchEvents();
  }, []);

  return (
    <div className="events-page">
      <h1 className="page-title">Upcoming Events</h1>
      <div className="event-list">
        {events.map(event => (
          <div className="event-card" key={event.id}>
            <img
              src={event.image_url || '/images/event-placeholder.jpg'}
              alt={event.title}
              className="event-image"
            />
            <div className="event-details">
              <h2 className="event-title">{event.title}</h2>
              <p className="event-date">{event.date} @ {event.time}</p>
              <p className="event-location">{event.location}</p>
              {event.has_queue && (
                <span className="event-badge">Queue Enabled</span>
              )}
              <p className="event-info">{event.info}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventsPage;
