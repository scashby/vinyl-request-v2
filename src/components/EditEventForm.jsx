import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import DatePicker from 'react-multi-date-picker';
import 'react-multi-date-picker/styles/colors/teal.css';

const EditEventForm = () => {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

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

  const [repeatDates, setRepeatDates] = useState([]);

  useEffect(() => {
    if (!isNew) {
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
      const formattedDates = repeatDates.length
        ? repeatDates.map(d => d.format('YYYY-MM-DD'))
        : [eventData.date];

      const payload = formattedDates.map(date => ({
        ...eventData,
        date
      }));

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
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#000' }}>
        {isNew ? 'Create Event' : 'Edit Event'}
      </h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px' }}>
        <label style={{ color: '#000' }}>
          Title:
          <input value={eventData.title} onChange={e => handleChange('title', e.target.value)} required />
        </label>
        {!isNew && (
          <label style={{ color: '#000' }}>
            Date:
            <input type="date" value={eventData.date} onChange={e => handleChange('date', e.target.value)} required />
          </label>
        )}
        {isNew && (
          <label style={{ color: '#000' }}>
            Select Dates:
            <DatePicker
              multiple
              value={repeatDates}
              onChange={setRepeatDates}
              format="YYYY-MM-DD"
              className="teal"
            />
          </label>
        )}
        <label style={{ color: '#000' }}>
          Time:
          <input value={eventData.time} onChange={e => handleChange('time', e.target.value)} />
        </label>
        <label style={{ color: '#000' }}>
          Location:
          <input value={eventData.location} onChange={e => handleChange('location', e.target.value)} />
        </label>
        <label style={{ color: '#000' }}>
          Info:
          <textarea value={eventData.info} onChange={e => handleChange('info', e.target.value)} />
        </label>
        <label style={{ color: '#000' }}>
          Promo Image URL:
          <input value={eventData.image_url} onChange={e => handleChange('image_url', e.target.value)} />
        </label>
        <label style={{ color: '#000' }}>
          Has Queue:
          <input type="checkbox" checked={eventData.has_queue} onChange={e => handleChange('has_queue', e.target.checked)} />
        </label>
        {eventData.has_queue && (
          <label style={{ color: '#000' }}>
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
