import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const EditEventForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [formTitle, setFormTitle] = useState(id ? 'Edit Event' : 'Create New Event');
  const [eventData, setEventData] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    info: '',
    image_url: '',
    allowed_formats: '',
    has_queue: false
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      if (id) {
        const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
        if (!error && data) {
          setEventData({
            ...data,
            allowed_formats: Array.isArray(data.allowed_formats)
              ? data.allowed_formats.join(', ')
              : data.allowed_formats
          });
        }
      } else if (location.state?.copyData) {
        const copy = location.state.copyData;
        setEventData({
          ...copy,
          allowed_formats: Array.isArray(copy.allowed_formats)
            ? copy.allowed_formats.join(', ')
            : copy.allowed_formats
        });
      }
    };
    fetchEvent();
  }, [id, location.state]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEventData((prevData) => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const filePath = `${Date.now()}_${file.name}`;
    setUploading(true);

    const { error } = await supabase.storage.from('event-images').upload(filePath, file);
    if (error) {
      alert('Upload failed.');
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from('event-images').getPublicUrl(filePath);
    setEventData(prev => ({ ...prev, image_url: data.publicUrl }));
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...eventData,
      allowed_formats: `{${eventData.allowed_formats.split(',').map(f => f.trim()).join(',')}}`
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
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>{formTitle}</h2>
      <form onSubmit={handleSubmit}>
        <input name="title" value={eventData.title} onChange={handleChange} placeholder="Title" required style={{ display: 'block', width: '100%', marginBottom: '1rem' }} />
        <input name="date" type="date" value={eventData.date} onChange={handleChange} required style={{ display: 'block', width: '100%', marginBottom: '1rem' }} />
        <input name="time" value={eventData.time} onChange={handleChange} placeholder="Time" style={{ display: 'block', width: '100%', marginBottom: '1rem' }} />
        <input name="location" value={eventData.location} onChange={handleChange} placeholder="Location" style={{ display: 'block', width: '100%', marginBottom: '1rem' }} />
        <textarea name="info" value={eventData.info} onChange={handleChange} placeholder="Info" style={{ display: 'block', width: '100%', marginBottom: '1rem' }} />
        <input name="image_url" value={eventData.image_url} onChange={handleChange} placeholder="Image URL" style={{ display: 'block', width: '100%', marginBottom: '0.5rem' }} />
        <input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'block', marginBottom: '1rem' }} />
        {uploading && <p style={{ marginBottom: '1rem' }}>Uploading...</p>}
        <input name="allowed_formats" value={eventData.allowed_formats} onChange={handleChange} placeholder="Allowed Formats (comma-separated)" style={{ display: 'block', width: '100%', marginBottom: '1rem' }} />
        <label style={{ display: 'block', marginBottom: '1rem' }}>
          <input type="checkbox" name="has_queue" checked={eventData.has_queue} onChange={handleChange} />
          {' '}Has Queue
        </label>
        <button type="submit" style={{ backgroundColor: '#2563eb', color: '#fff', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px' }}>
          Save
        </button>
      </form>
    </div>
  );
};

export default EditEventForm;
