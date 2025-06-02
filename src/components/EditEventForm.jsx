import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import '../../styles/internal.css';

const EditEventForm = ({ eventId, onSave }) => {
  const [event, setEvent] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    info: '',
    image_url: '',
    has_queue: false,
    allowed_formats: '',
  });

  const [repeat, setRepeat] = useState(false);
  const [repeatFrequency, setRepeatFrequency] = useState('weekly');
  const [repeatDay, setRepeatDay] = useState('Sunday');
  const [repeatEndDate, setRepeatEndDate] = useState('');

  useEffect(() => {
    const fetchEvent = async () => {
      if (eventId) {
        const { data, error } = await supabase.from('events').select('*').eq('id', eventId).single();
        if (data) setEvent(data);
      }
    };
    fetchEvent();
  }, [eventId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEvent(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (eventId) {
      await supabase.from('events').update(event).eq('id', eventId);
    } else {
      await supabase.from('events').insert([event]);
    }
    if (onSave) onSave();
  };

  return (
    <form className="edit-event-form" onSubmit={handleSubmit}>
      <h2>{eventId ? 'Edit Event' : 'Create New Event'}</h2>
      <label>Title:
        <input type="text" name="title" value={event.title} onChange={handleChange} required />
      </label>
      <label>Date:
        <input type="date" name="date" value={event.date} onChange={handleChange} required />
      </label>
      <label>Time:
        <input type="text" name="time" value={event.time} onChange={handleChange} />
      </label>
      <label>Location:
        <input type="text" name="location" value={event.location} onChange={handleChange} />
      </label>
      <label>Info:
        <textarea name="info" value={event.info || ''} onChange={handleChange} />
      </label>
      <label>Image URL:
        <input type="url" name="image_url" value={event.image_url || ''} onChange={handleChange} />
      </label>
      <label>
        <input type="checkbox" name="has_queue" checked={event.has_queue} onChange={handleChange} />
        Has Queue?
      </label>
      {event.has_queue && (
        <label>Allowed Formats:
          <input type="text" name="allowed_formats" value={event.allowed_formats || ''} onChange={handleChange} />
        </label>
      )}
      <label>
        <input type="checkbox" checked={repeat} onChange={() => setRepeat(!repeat)} />
        Repeat
      </label>
      {repeat && (
        <div className="repeat-options">
          <label>Frequency:
            <select value={repeatFrequency} onChange={e => setRepeatFrequency(e.target.value)}>
              <option value="weekly">Every Week</option>
              <option value="biweekly">Every 2 Weeks</option>
              <option value="monthly">Every Month</option>
            </select>
          </label>
          <label>Day of Week:
            <select value={repeatDay} onChange={e => setRepeatDay(e.target.value)}>
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </label>
          <label>End Date:
            <input type="date" value={repeatEndDate} onChange={e => setRepeatEndDate(e.target.value)} />
          </label>
        </div>
      )}
      <button type="submit">Save Event</button>
    </form>
  );
};

export default EditEventForm;
