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
      allowed_formats: `{${(Array.isArray(eventData.allowed_formats) ? eventData.allowed_formats : []).map(f => f.trim()).join(',')}}`,
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
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>{id ? 'Edit Event' : 'New Event'}</h2>
      <form onSubmit={handleSubmit}>
        <input name="title" value={eventData.title} onChange={handleChange} placeholder="Title" required style={{ display: 'block', width: '100%', marginBottom: '1rem' }} />
        <input name="date" value={eventData.date} onChange={handleChange} placeholder="Date" style={{ display: 'block', width: '100%', marginBottom: '1rem' }} />
        <input name="time" value={eventData.time} onChange={handleChange} placeholder="Time" style={{ display: 'block', width: '100%', marginBottom: '1rem' }} />
        <input name="location" value={eventData.location} onChange={handleChange} placeholder="Location" style={{ display: 'block', width: '100%', marginBottom: '1rem' }} />
        <input name="image_url" value={eventData.image_url} onChange={handleChange} placeholder="Image URL" style={{ display: 'block', width: '100%', marginBottom: '0.5rem' }} />
        <a
          href="https://supabase.com/dashboard/project/bntoivaipesuovselglg/storage/buckets/event-images"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'block', marginBottom: '1rem', color: '#2563eb', textDecoration: 'underline' }}
        >
          Upload image manually to Supabase
        </a>
        <textarea name="info" value={eventData.info} onChange={handleChange} placeholder="Event Info" style={{ display: 'block', width: '100%', marginBottom: '1rem' }} />
<input name="info_url" value={eventData.info_url || ''} onChange={handleChange} placeholder="Event Info URL (optional)" style={{ display: 'block', width: '100%', marginBottom: '1rem' }} />
        <label style={{ display: 'block', marginBottom: '1rem' }}>
          <input type="checkbox" name="has_queue" checked={eventData.has_queue} onChange={handleChange} />
          {' '}Has Queue
        </label>
        
        <fieldset style={{ marginBottom: '1rem' }}>
          <legend>Allowed Formats</legend>
          {['Vinyl', 'Cassette', '45s', 'CDs'].map((format) => (
            <label key={format} style={{ display: 'block', marginBottom: '0.25rem' }}>
              <input
                type="checkbox"
                name="allowed_formats"
                value={format}
                checked={Array.isArray(eventData.allowed_formats) ? eventData.allowed_formats.includes(format) : false}
                onChange={(e) => {
                  const { value, checked } = e.target;
                  setEventData((prev) => {
                    const formats = Array.isArray(prev.allowed_formats) ? [...prev.allowed_formats] : [];
                    if (checked) {
                      return { ...prev, allowed_formats: [...formats, value] };
                    } else {
                      return { ...prev, allowed_formats: formats.filter((f) => f !== value) };
                    }
                  });
                }}
              />
              {' '}{format}
            </label>
          ))}
        </fieldset>
    
        <button type="submit" style={{ backgroundColor: '#2563eb', color: '#fff', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px' }}>
          Save
        </button>
      </form>
    </div>
  );
};

export default EditEventForm;