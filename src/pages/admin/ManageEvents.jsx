import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import '../../../styles/internal.css';

const ManageEvents = () => {
  const [events, setEvents] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    const { data, error } = await supabase.from('events').select().order('date', { ascending: true });
    if (error) {
      console.error('Error fetching events:', error.message);
    } else {
      setEvents(data);
    }
  };

  return (
    <div className="admin-panel">
      <h2>Manage Events</h2>
      <button onClick={() => navigate('/admin/events/new')} className="blue-button">Add New Event</button>
      <div className="event-list">
        {events.map((event) => (
          <div key={event.id} className="event-item">
            <span>{event.title} – {event.date}</span>
            <Link to={`/admin/events/${event.id}`} className="edit-link">Edit</Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ManageEvents;
