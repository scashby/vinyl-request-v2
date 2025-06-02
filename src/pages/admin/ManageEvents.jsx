
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import EditEventForm from '../../components/EditEventForm';
import Breadcrumbs from '../../components/Breadcrumbs';
import '../../styles/breadcrumb.css';

const ManageEvents = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    const { data, error } = await supabase.from('events').select('*').order('date', { ascending: true });
    if (!error) setEvents(data);
  };

  const handleFormClose = () => {
    setSelectedEvent(null);
    setIsCreating(false);
    fetchEvents();
  };

  return (
    <div className="admin-wrapper" style={{ backgroundColor: '#f9f9f9', minHeight: '100vh', padding: '2rem' }}>
      <h1 style={{ color: '#000' }}>Admin: Events</h1>
      <Breadcrumbs current="Events" parent="Admin" />
      {!selectedEvent && !isCreating && (
        <>
          <button
            onClick={() => setIsCreating(true)}
            style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', marginBottom: '1rem' }}
          >
            Create New Event
          </button>
          <ul style={{ listStyle: 'none', padding: 0, fontSize: '1rem', color: '#000' }}>
            {events.map((event) => (
              <li key={event.id} style={{ marginBottom: '1rem', background: '#fff', padding: '1rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <strong>{event.title}</strong> – {event.date}
                <div style={{ marginTop: '0.5rem' }}>
                  <button onClick={() => setSelectedEvent(event)} style={{ marginRight: '0.5rem', background: '#2563eb', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '4px', border: 'none' }}>
                    Edit
                  </button>
                  <button disabled style={{ marginRight: '0.5rem' }}>Duplicate</button>
                  <button disabled>Add Series</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {(selectedEvent || isCreating) && (
        <EditEventForm eventData={selectedEvent} onClose={handleFormClose} />
      )}
    </div>
  );
};

export default ManageEvents;
