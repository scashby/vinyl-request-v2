import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const EditEventForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    info: '',
    image_url: '',
    allowed_form_: '',
    has_queue: false,
  });

  useEffect(() => {
    if (id) {
      fetch(`/api/get-event?id=${id}`)
        .then(res => res.json())
        .then(({ data }) => {
          if (data) setFormData(data);
        });
    }
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Submitting event payload:', formData);

    const response = await fetch('/api/create-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const result = await response.json();
    console.log('Insert result:', result);

    if (!response.ok) {
      alert('Error saving event. Check console.');
    } else {
      navigate('/admin/events');
    }
  };

  return (
    <div style={{ backgroundColor: '#fff', padding: '2rem', maxWidth: '600px', margin: 'auto', minHeight: '100vh' }}>
      <h2>{id ? 'Edit Event' : 'Create New Event'}</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input name="title" value={formData.title} onChange={handleChange} placeholder="Title" required />
        <input name="date" type="date" value={formData.date} onChange={handleChange} required />
        <input name="time" value={formData.time} onChange={handleChange} placeholder="Time" />
        <input name="location" value={formData.location} onChange={handleChange} placeholder="Location" />
        <textarea name="info" value={formData.info} onChange={handleChange} placeholder="Info" rows={3} />
        <input name="image_url" value={formData.image_url} onChange={handleChange} placeholder="Image URL" />
        <input name="allowed_form_" value={formData.allowed_form_} onChange={handleChange} placeholder="Allowed Formats" />
        <label><input name="has_queue" type="checkbox" checked={formData.has_queue} onChange={handleChange} /> Enable Queue</label>
        <button type="submit">Save Event</button>
      </form>
    </div>
  );
};

export default EditEventForm;
