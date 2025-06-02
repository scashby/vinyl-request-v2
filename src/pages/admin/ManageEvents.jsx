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
    <div className="admin-wrapper">
      <h1>Admin: Events</h1>
      {selectedEvent ? (
        <EditEventForm event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      ) : (
        <ul className="admin-event-list">
          {events.map(event => (
            <li key={event.id}>
              <strong>{event.title}</strong> – {event.date} @ {event.location || 'TBD'}
              <button onClick={() => setSelectedEvent(event)}>Edit</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ManageEvents;
