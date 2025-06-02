
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import '../../styles/internal.css';
import Breadcrumbs from '../../components/Breadcrumbs';
import '../../styles/breadcrumb.css';

const ManageEvents = () => {
  const [events, setEvents] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEvents = async () => {
      const { data, error } = await supabase.from('events').select('*');
      if (!error) setEvents(data);
    };
    fetchEvents();
  }, []);

  return (
    <div className="page-wrapper">
      <header className="internal-hero">
        <div className="overlay">
          <h1>Admin: Events</h1>
        </div>
      </header>
      <Breadcrumbs />
      <main className="internal-body">
        <div className="admin-events-controls">
          <button onClick={() => navigate('/admin/events/new')} className="blue-button">
            Add New Event
          </button>
        </div>
        <div className="admin-event-list">
          {events.map((event) => (
            <div key={event.id} className="admin-event-tile">
              <div className="event-info">
                <h2>{event.title}</h2>
                <p>{event.date}</p>
              </div>
              <button onClick={() => navigate(`/admin/events/${event.id}`)} className="blue-button small">
                Edit
              </button>
            </div>
          ))}
        </div>
      </main>
      <footer className="footer">© 2025 Dead Wax Dialogues</footer>
    </div>
  );
};

export default ManageEvents;
