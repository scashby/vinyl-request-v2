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
        console.log('Fetched events:', data);
        setEvents(data);
      }
    };

    fetchEvents();
  }, []);

  return (
    <div className="events-page">
      <h1 className="page-title">Debug: Supabase Events</h1>
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', background: '#f4f4f4', padding: '1rem', borderRadius: '8px' }}>
        {JSON.stringify(events, null, 2)}
      </pre>
    </div>
  );
};

export default EventsPage;
