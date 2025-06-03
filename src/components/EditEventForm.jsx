import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

const EditEventForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [info, setInfo] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [allowedFormats, setAllowedFormats] = useState('');
  const [hasQueue, setHasQueue] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) return;

      const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
      if (error) {
        console.error('Error fetching event:', error);
      } else if (data) {
        setTitle(data.title || '');
        setDate(data.date || '');
        setTime(data.time || '');
        setLocation(data.location || '');
        setInfo(data.info || '');
        setImageUrl(data.image_url || '');
        setAllowedFormats(data.allowed_formats || '');
        setHasQueue(data.has_queue || false);
      }
    };

    fetchEvent();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      title,
      date,
      time,
      location,
      info,
      image_url: imageUrl,
      allowed_formats: allowedFormats,
      has_queue: hasQueue,
    };

    console.log('Submitting event payload:', payload);

    let response;
    if (id) {
      response = await supabase.from('events').update(payload).eq('id', id);
    } else {
      response = await supabase.from('events').insert([payload]);
    }

    if (response.error) {
      console.error('Insert/Update error:', response.error);
      alert('Error saving event: ' + response.error.message);
    } else {
      console.log('Success:', response.data);
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
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
        {id ? 'Edit Event' : 'Create New Event'}
      </h2>
      <form onSubmit={handleSubmit}>
        <label>Title<input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required /></label><br />
        <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label><br />
        <label>Time<input type="text" value={time} onChange={(e) => setTime(e.target.value)} /></label><br />
        <label>Location<input type="text" value={location} onChange={(e) => setLocation(e.target.value)} /></label><br />
        <label>Info<textarea value={info} onChange={(e) => setInfo(e.target.value)} /></label><br />
        <label>Image URL<input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} /></label><br />
        <label>Allowed Formats<input type="text" value={allowedFormats} onChange={(e) => setAllowedFormats(e.target.value)} /></label><br />
        <label>
          <input type="checkbox" checked={hasQueue} onChange={(e) => setHasQueue(e.target.checked)} />
          Has Queue
        </label><br /><br />
        <button type="submit" style={{ backgroundColor: '#2563eb', color: '#fff', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px' }}>
          Save
        </button>
      </form>
    </div>
  );
};

export default EditEventForm;
