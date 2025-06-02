import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const EditEventForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = useLocation().pathname.includes('/new');

  const [eventData, setEventData] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    info: '',
    image_url: '',
    has_queue: false,
    allowed_formats: ''
  });

  const [extraDates, setExtraDates] = useState('');

  useEffect(() => {
    if (!isNew && id) {
      supabase.from('events').select('*').eq('id', id).single().then(({ data }) => {
        if (data) setEventData(data);
      });
    }
  }, [id, isNew]);

  const handleChange = (field, value) => {
    setEventData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isNew) {
      const base = { ...eventData };
      const dates = extraDates.split(',').map(d => d.trim()).filter(Boolean);
      const payload = dates.length
        ? dates.map(date => ({ ...base, date }))
        : [{ ...base }];
      await supabase.from('events').insert(payload);
    } else {
      await supabase.from('events').update(eventData).eq('id', id);
    }
    navigate('/admin/events');
  };

  const handleCopy = () => {
    navigate('/admin/events/new', { state: { eventData } });
  };

  return (
    <div style={{ backgroundColor: '#f9f9f9', minHeight: '100vh', padding: '2rem' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>{isNew ? 'Create Event' : 'Edit Event'}</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px' }}>
        <label>
          Title:
          <input value={eventData.title} onChange={e => handleChange('title', e.target.value)} required />
        </label>
        <label>
          Date:
          <input type="date" value={eventData.date} onChange={e => handleChange('date', e.target.value)} required />
        </label>
        {isNew && (
          <label>
            Repeat / Add More Dates (comma-separated YYYY-MM-DD):
            <input type="text" value={extraDates} onChange={e => setExtraDates(e.target.value)} />
          </label>
        )}
        <label>
          Time:
          <input value={eventData.time} onChange={e => handleChange('time', e.target.value)} />
        </label>
        <label>
          Location:
          <input value={eventData.location} onChange={e => handleChange('location', e.target.value)} />
        </label>
        <label>
          Info:
          <textarea value={eventData.info} onChange={e => handleChange('info', e.target.value)} />
        </label>
        <label>
          Promo Image URL:
          <input value={eventData.image_url} onChange={e => handleChange('image_url', e.target.value)} />
        </label>
        <label>
          Has Queue:
          <input type="checkbox" checked={eventData.has_queue} onChange={e => handleChange('has_queue', e.target.checked)} />
        </label>
        {eventData.has_queue && (
          <label>
            Allowed Formats:
            <input value={eventData.allowed_formats} onChange={e => handleChange('allowed_formats', e.target.value)} />
          </label>
        )}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="submit">{isNew ? 'Create Event' : 'Update Event'}</button>
          {!isNew && <button type="button" onClick={handleCopy}>Copy This Event</button>}
        </div>
      </form>
    </div>
  );
};

export default EditEventForm;
