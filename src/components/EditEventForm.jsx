import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const EditEventForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = location.pathname.includes('/new');

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

  const [repeat, setRepeat] = useState(false);
  const [repeatInterval, setRepeatInterval] = useState('1');
  const [repeatDay, setRepeatDay] = useState('Sunday');
  const [repeatEndDate, setRepeatEndDate] = useState('');

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

    if (isNew && repeat && repeatEndDate) {
      const baseDate = new Date(eventData.date);
      const end = new Date(repeatEndDate);
      const interval = parseInt(repeatInterval);
      const dayMap = {
        Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
        Thursday: 4, Friday: 5, Saturday: 6
      };
      const targetDay = dayMap[repeatDay];
      const eventsToInsert = [];

      let current = new Date(baseDate);
      while (current <= end) {
        if (current.getDay() === targetDay) {
          eventsToInsert.push({ ...eventData, date: current.toISOString().split('T')[0] });
          current.setDate(current.getDate() + interval * 7);
        } else {
          current.setDate(current.getDate() + 1);
        }
      }

      if (eventsToInsert.length > 0) {
        await supabase.from('events').insert(eventsToInsert);
      }
    } else if (isNew) {
      await supabase.from('events').insert([{ ...eventData }]);
    } else {
      await supabase.from('events').update(eventData).eq('id', id);
    }

    navigate('/admin/events');
  };

  const handleCopy = () => {
    navigate('/admin/events/new', { state: { eventData } });
  };

  return (
    <div style={{ backgroundColor: '#f9f9f9', padding: '2rem', minHeight: '100vh' }}>
      <h1 style={{ color: '#000', fontSize: '1.5rem', marginBottom: '1rem' }}>
        {isNew ? 'Create New Event' : 'Edit Event'}
      </h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px' }}>
        <label style={{ color: '#000' }}>
          Title:
          <input type="text" value={eventData.title} onChange={e => handleChange('title', e.target.value)} required />
        </label>
        <label style={{ color: '#000' }}>
          Date:
          <input type="date" value={eventData.date} onChange={e => handleChange('date', e.target.value)} required />
        </label>
        <label style={{ color: '#000' }}>
          Time:
          <input type="text" value={eventData.time} onChange={e => handleChange('time', e.target.value)} />
        </label>
        <label style={{ color: '#000' }}>
          Location:
          <input type="text" value={eventData.location} onChange={e => handleChange('location', e.target.value)} />
        </label>
        <label style={{ color: '#000' }}>
          Info:
          <textarea value={eventData.info} onChange={e => handleChange('info', e.target.value)} />
        </label>
        <label style={{ color: '#000' }}>
          Image URL:
          <input type="text" value={eventData.image_url} onChange={e => handleChange('image_url', e.target.value)} />
        </label>
        <label style={{ color: '#000' }}>
          <input type="checkbox" checked={eventData.has_queue} onChange={e => handleChange('has_queue', e.target.checked)} />
          Has Queue
        </label>
        {eventData.has_queue && (
          <label style={{ color: '#000' }}>
            Allowed Formats:
            <input type="text" value={eventData.allowed_formats} onChange={e => handleChange('allowed_formats', e.target.value)} />
          </label>
        )}
        {isNew && (
          <>
            <label style={{ color: '#000' }}>
              <input type="checkbox" checked={repeat} onChange={() => setRepeat(!repeat)} />
              Repeat this event
            </label>
            {repeat && (
              <>
                <label style={{ color: '#000' }}>
                  Repeat every
                  <select value={repeatInterval} onChange={e => setRepeatInterval(e.target.value)}>
                    <option value="1">1 week</option>
                    <option value="2">2 weeks</option>
                    <option value="3">3 weeks</option>
                  </select>
                </label>
                <label style={{ color: '#000' }}>
                  On
                  <select value={repeatDay} onChange={e => setRepeatDay(e.target.value)}>
                    <option>Sunday</option>
                    <option>Monday</option>
                    <option>Tuesday</option>
                    <option>Wednesday</option>
                    <option>Thursday</option>
                    <option>Friday</option>
                    <option>Saturday</option>
                  </select>
                </label>
                <label style={{ color: '#000' }}>
                  Until
                  <input type="date" value={repeatEndDate} onChange={e => setRepeatEndDate(e.target.value)} />
                </label>
              </>
            )}
          </>
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