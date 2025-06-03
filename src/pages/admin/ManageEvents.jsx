import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

const ManageEvents = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });
      if (!error) setEvents(data);
    };
    fetchEvents();
  }, []);

  return (
    <div style={{
      maxWidth: '640px',
      margin: '2rem auto',
      padding: '2rem',
      backgroundColor: '#ffffff',
      color: '#000000',
      border: '1px solid #ddd',
      borderRadius: '8px',
      minHeight: '100vh',
      boxShadow: '0 0 8px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{
        fontSize: '1.5rem',
        fontWeight: 'bold',
        marginBottom: '1.5rem'
      }}>Manage Events</h2>

      <Link to="/admin/events/new">
        <button style={{
          backgroundColor: '#2563eb',
          color: '#fff',
          padding: '0.5rem 1rem',
          border: 'none',
          borderRadius: '4px',
          marginBottom: '1.5rem',
          cursor: 'pointer'
        }}>
          Add New Event
        </button>
      </Link>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {events.map(event => (
          <li key={event.id} style={{
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 1rem',
            backgroundColor: '#f9f9f9',
            borderRadius: '4px',
            border: '1px solid #e0e0e0'
          }}>
            <span>{event.title} – {event.date}</span>
            <Link to={`/admin/events/${event.id}`} style={{
              color: '#2563eb',
              marginLeft: '1rem',
              textDecoration: 'underline',
              fontWeight: '500'
            }}>
              Edit
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ManageEvents;
