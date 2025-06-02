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
      <h1 style={{ color: "#000" }}>Admin: Events</h1>
      {selectedEvent ? (
        <EditEventForm event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      ) : (
        <ul className="admin-event-list" style={{ listStyle: 'none', padding: 0, fontSize: '1rem', color: '#000' }}>
          {events.map(event => (
            <li key={event.id} style={{ marginBottom: '1rem', background: '#fff', padding: '1rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <strong>{event.title}</strong> – {event.date} @ {event.location || 'TBD'}
              <button onClick={() => setSelectedEvent(event)} style={{ marginLeft: '1rem', background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px' }}>Edit</button>
            </li>
          ))}
        </ul>
      )}

    {showSeriesModal && (
      <AddSeriesModal
        onClose={() => setShowSeriesModal(false)}
        onAddSeries={({ startDate, endDate, dayOfWeek }) => {
          const start = new Date(startDate);
          const end = new Date(endDate);
          const newEvents = [];
          const targetDay = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(dayOfWeek);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            if (d.getDay() === targetDay) {
              newEvents.push({
                title: 'Vinyl Sunday',
                date: d.toISOString().split('T')[0],
                time: '12-6pm',
                info: '',
                location: '',
                image_url: '',
                has_queue: false,
                allowed_formats: null,
              });
            }
          }
          if (newEvents.length > 0) {
            supabase.from('events').insert(newEvents).then(fetchEvents);
          }
        }}
      />
    )}
    </div>
  );
};

export default ManageEvents;
