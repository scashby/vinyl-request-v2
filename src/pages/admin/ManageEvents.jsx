import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import '../../styles/internal.css';

const ManageEvents = () => {
  const [events, setEvents] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEvents = async () => {
      const { data, error } = await supabase.from('events').select('*').order('date');
      if (error) {
        console.error('Error fetching events:', error);
      } else {
        setEvents(data);
      }
    };

    fetchEvents();
  }, []);

  return (
    <div className="page-wrapper">
      <header className="event-hero">
        <div className="overlay">
          <h1>Admin: Events</h1>
        </div>
      </header>
      <main className="event-body">
        <div className="admin-controls">
          <button onClick={() => navigate('/admin/events/new')}>➕ Add New Event</button>
        </div>
        <section className="event-grid">
          {events.map((event) => (
            <article className="event-card" key={event.id}>
              <img
                src={event.image_url || '/images/event-header-still.jpg'}
                alt={event.title}
                className="card-square"
              />
              <h2>{event.title}</h2>
              <p>{event.location}</p>
              <p>{event.date}<br />{event.time}</p>
              <button onClick={() => navigate(`/admin/events/${event.id}`)}>Edit</button>
            </article>
          ))}
        </section>
      </main>
      <footer className="footer">© 2025 Dead Wax Dialogues</footer>
    </div>
  );
};

export default ManageEvents;
