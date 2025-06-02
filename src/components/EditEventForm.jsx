
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

const EditEventForm = () => {
  const { id } = useParams();
  const isNew = useLocation().pathname.includes('/admin/events/new');
  const navigate = useNavigate();
  const [event, setEvent] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    info: '',
    image_url: '',
    has_queue: false,
    allowed_formats: ''
  });

  const [extraDates, setExtraDates] = useState([]);

  useEffect(() => {
    if (!isNew && id) {
      supabase.from('events').select('*').eq('id', id).single().then(({ data }) => {
        if (data) setEvent(data);
      });
    }
  }, [id, isNew]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isNew) {
      await supabase.from('events').insert([{ ...event }]);
    } else {
      await supabase.from('events').update({ ...event }).eq('id', id);
    }
    navigate('/admin/events');
  };

  const handleCopy = () => {
    navigate('/admin/events/new', { state: { event } });
  };

  return (
    <div className="admin-wrapper">
      <h1>{isNew ? 'Create Event' : 'Edit Event'}</h1>
      <form onSubmit={handleSubmit}>
        <label>Title:</label>
        <input value={event.title} onChange={e => setEvent({ ...event, title: e.target.value })} required />

        <label>Date:</label>
        <input type="date" value={event.date} onChange={e => setEvent({ ...event, date: e.target.value })} required />

        {isNew && (
          <>
            <label>Repeat / Add More Dates:</label>
            <input
              type="text"
              placeholder="Comma-separated dates"
              onChange={e => setExtraDates(e.target.value.split(',').map(d => d.trim()))}
            />
          </>
        )}

        <label>Time:</label>
        <input value={event.time} onChange={e => setEvent({ ...event, time: e.target.value })} />

        <label>Location:</label>
        <input value={event.location} onChange={e => setEvent({ ...event, location: e.target.value })} />

        <label>Info:</label>
        <textarea value={event.info} onChange={e => setEvent({ ...event, info: e.target.value })} />

        <label>Promo Image URL:</label>
        <input value={event.image_url} onChange={e => setEvent({ ...event, image_url: e.target.value })} />

        <label>Has Queue:</label>
        <input type="checkbox" checked={event.has_queue} onChange={e => setEvent({ ...event, has_queue: e.target.checked })} />

        {event.has_queue && (
          <>
            <label>Allowed Formats:</label>
            <input value={event.allowed_formats} onChange={e => setEvent({ ...event, allowed_formats: e.target.value })} />
          </>
        )}

        <button type="submit">{isNew ? 'Create Event' : 'Update Event'}</button>
        {!isNew && <button type="button" onClick={handleCopy}>Copy This Event</button>}
      </form>
    </div>
  );
};

export default EditEventForm;
