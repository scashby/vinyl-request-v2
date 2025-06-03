import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
    allowed_formats: '',
    has_queue: false,
  });

  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [repeatDay, setRepeatDay] = useState('Thursday');
  const [repeatEndDate, setRepeatEndDate] = useState('');

  useEffect(() => {
    if (id) {
      const fetchEvent = async () => {
        const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
        if (error) console.error('Fetch error:', error);
        else setFormData(data);
      };
      fetchEvent();
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

    if (repeatWeekly && repeatEndDate && !id) {
      const startDate = new Date(formData.date);
      const endDate = new Date(repeatEndDate);
      const dayIndex = weekdays.indexOf(repeatDay);
      const events = [];

      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        if (date.getDay() === dayIndex) {
          events.push({ ...formData, date: date.toISOString().split('T')[0] });
        }
      }

      const { error } = await supabase.from('events').insert(events);
      if (error) alert('Error saving repeating events');
      else navigate('/admin/manage-events');
    } else {
      const { error } = id
        ? await supabase.from('events').update(formData).eq('id', id)
        : await supabase.from('events').insert([formData]);
      if (error) alert('Error saving event');
      else navigate('/admin/manage-events');
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <h2>{id ? 'Edit Event' : 'Create New Event'}</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label>
          Title:
          <input type="text" name="title" value={formData.title} onChange={handleChange} required />
        </label>
        <label>
          Date:
          <input type="date" name="date" value={formData.date} onChange={handleChange} required />
        </label>
        {!id && (
          <>
            <label>
              <input
                type="checkbox"
                checked={repeatWeekly}
                onChange={(e) => setRepeatWeekly(e.target.checked)}
              />{' '}
              Repeat weekly
            </label>
            {repeatWeekly && (
              <>
                <label>
                  Day of Week:
                  <select value={repeatDay} onChange={(e) => setRepeatDay(e.target.value)}>
                    {weekdays.map((day) => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Repeat Until:
                  <input
                    type="date"
                    value={repeatEndDate}
                    onChange={(e) => setRepeatEndDate(e.target.value)}
                    required={repeatWeekly}
                  />
                </label>
              </>
            )}
          </>
        )}
        <label>
          Time:
          <input type="text" name="time" value={formData.time} onChange={handleChange} placeholder="e.g. 5pm to 9pm" />
        </label>
        <label>
          Location:
          <input type="text" name="location" value={formData.location} onChange={handleChange} />
        </label>
        <label>
          Info:
          <textarea name="info" value={formData.info} onChange={handleChange} rows={3} />
        </label>
        <label>
          Image URL:
          <input type="text" name="image_url" value={formData.image_url} onChange={handleChange} />
          <small>
            <a
              href="https://supabase.com/dashboard/project/bntoivaipesuovselglg/storage/buckets/event-images"
              target="_blank"
              rel="noopener noreferrer"
            >
              Upload image to Supabase
            </a>{' '}
            and paste URL here.
          </small>
        </label>
        <label>
          Allowed Formats:
          <input
            type="text"
            name="allowed_formats"
            value={formData.allowed_formats}
            onChange={handleChange}
            placeholder="vinyl, cassette, cd"
          />
        </label>
        <label>
          <input type="checkbox" name="has_queue" checked={formData.has_queue} onChange={handleChange} /> Enable Request Queue
        </label>
        <button
          type="submit"
          style={{ backgroundColor: '#2563eb', color: 'white', padding: '0.5rem', border: 'none' }}
        >
          Save Event
        </button>
      </form>
    </div>
  );
};

export default EditEventForm;
