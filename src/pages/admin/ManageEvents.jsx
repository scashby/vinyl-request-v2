import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import '../../styles/internal.css';
import { useNavigate } from 'react-router-dom';

const ManageEvents = () => {
  const [events, setEvents] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEvents = async () => {
      const { data, error } = await supabase.from('events').select('*');
      if (error) {
        console.error('Error fetching events:', error);
      } else {
        setEvents(data);
      }
    };

    fetchEvents();
  }, []);

  const handleEdit = (eventId) => {
    navigate(`/admin/events/${eventId}`);
  };

  const handleAddNew = () => {
    navigate('/admin/events/new');
  };

  return (
    <div className="admin-container">
      <h1>Admin: Events</h1>
      <button className="btn" onClick={handleAddNew}>
        ➕ Add New Event
      </button>
      <div className="event-list">
        {events.map((event) => (
          <div key={event.id} className="event-tile">
            <div>
              <strong>{event.title}</strong>
              <div>{event.date}</div>
            </div>
            <button className="btn" onClick={() => handleEdit(event.id)}>
              Edit
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ManageEvents;
