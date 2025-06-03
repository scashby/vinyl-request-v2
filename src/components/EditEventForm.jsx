import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const EditEventForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [eventData, setEventData] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    image_url: '',
    info: '',
    has_queue: false,
    allowed_formats: '',
  });

  useEffect(() => {
    const fetchEvent = async () => {
      if (id) {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          console.error('Error fetching event:', error);
        } else {
          setEventData(data);
        }
      }
    };

    fetchEvent();
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEventData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...eventData,
      allowed_formats: `{${(eventData.allowed_formats || '').split(',').map(f => f.trim()).join(',')}}`,
    };

    let result;
    if (id) {
      result = await supabase.from('events').update(payload).eq('id', id);
    } else {
      result = await supabase.from('events').insert([payload]);
    }

    if (result.error) {
      alert(`Error saving event: ${result.error.message}`);
    } else {
      navigate('/admin/events');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>{id ? 'Edit Event' : 'New Event'}</h2>
      <form onSubmit={handleSubmit} style={{ maxWidth: '600px' }}>
        <input name="title" value={eventData.title} onChange={handleChange} placeholder="Title" style={{ display: 'block', width: '100%', marginBottom: '0.5rem' }} />
        <input name="date" value={eventData.date} onChange={handleChange} placeholder="Date (YYYY-MM-DD)" style={{ display: 'block', width: '100%', marginBottom: '0.5rem' }} />
        <input name="time" value={eventData.time} onChange={handleChange} placeholder="Time (e.g. 8:00 PM)" style={{ display: 'block', width: '100%', marginBottom: '0.5rem' }} />
        <input name="location" value={eventData.location} onChange={handleChange} placeholder="Location" style={{ display: 'block', width: '100%', marginBottom: '0.5rem' }} />
        <input name="image_url" value={eventData.image_url} onChange={handleChange} placeholder="Image URL" style={{ display: 'block', width: '100%', marginBottom: '0.5rem' }} />
        <a
          href="https://supabase.com/dashboard/project/bntoivaipesuovselglg/storage/buckets/event-images"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'block', marginBottom: '1rem', color: '#2563eb', textDecoration: 'underline' }}
        >
          Upload image manually to Supabase
        </a>
        <textarea name="info" value={eventData.info} onChange={handleChange} placeholder="Event Info" style={{ display: 'block', width: '100%', marginBottom: '0.5rem' }} />
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          <input type="checkbox" name="has_queue" checked={eventData.has_queue} onChange={handleChange} />
          {' '}Has Queue
        </label>
        <input name="allowed_formats" value={eventData.allowed_formats} onChange={handleChange} placeholder="Allowed Formats (comma-separated)" style={{ display: 'block', width: '100%', marginBottom: '1rem' }} />
        <button type="submit">Save</button>
      </form>
    </div>
  );
};

export default EditEventForm;
