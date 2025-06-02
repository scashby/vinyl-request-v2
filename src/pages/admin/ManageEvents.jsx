import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import EditEventForm from '../../components/EditEventForm';

const ManageEvents = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    const fetchEvents = async () => {
      const { data, error } = await supabase.from('events').select('*').order('date', { ascending: true });
      if (!error) setEvents(data);
    };
    fetchEvents();
  }, []);

  return (
    <div className="admin-wrapper" style={{ backgroundColor: '#f9f9f9', minHeight: '100vh', padding: '2rem' }}>
      <h1>Admin: Events</h1>
      {selectedEvent ? (
        <EditEventForm event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      ) : (
        <ul className="admin-event-list" style={{ listStyle: 'none', padding: 0, fontSize: '1rem' }}>
          {events.map(event => (
            <li key={event.id} style={{ marginBottom: '1rem', background: '#fff', padding: '1rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <strong>{event.title}</strong> – {event.date} @ {event.location || 'TBD'}
              <button onClick={() => setSelectedEvent(event)} style={{ marginLeft: '1rem', background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px' }}>Edit</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ManageEvents;
