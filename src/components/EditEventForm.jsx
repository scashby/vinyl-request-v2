import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

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

  const [repeatOption, setRepeatOption] = useState('none');
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatEndDate, setRepeatEndDate] = useState('');

  useEffect(() => {
    const fetchEvent = async () => {
      if (id) {
        const { data, error } = await supabase.from('events').select('*').eq('id', Number(id)).single();
        if (!error && data) setFormData(data);
      }
    };
    fetchEvent();
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

    const insertMultiple = async () => {
      const startDate = new Date(formData.date);
      const endDate = new Date(repeatEndDate);
      const unit = repeatOption;
      const events = [];
      let date = new Date(startDate);

      while (date <= endDate) {
        events.push({ ...formData, date: date.toISOString().split('T')[0] });
        if (unit === 'daily') date.setDate(date.getDate() + repeatInterval);
        else if (unit === 'weekly') date.setDate(date.getDate() + 7 * repeatInterval);
        else if (unit === 'monthly') date.setMonth(date.getMonth() + repeatInterval);
        else if (unit === 'yearly') date.setFullYear(date.getFullYear() + repeatInterval);
        else break;
      }

      const { error } = await supabase.from('events').insert(events);
      if (!error) navigate('/admin/manage-events');
    };

    if (!id && repeatOption !== 'none' && repeatEndDate) {
      await insertMultiple();
    } else {
      const { error } = id
        ? await supabase.from('events').update(formData).eq('id', Number(id))
        : await supabase.from('events').insert([formData]);
      if (!error) navigate('/admin/manage-events');
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
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>{id ? 'Edit Event' : 'Create New Event'}</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
              Repeat:
              <select value={repeatOption} onChange={(e) => setRepeatOption(e.target.value)}>
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>
            {repeatOption !== 'none' && (
              <>
                <label>
                  Every:
                  <input
                    type="number"
                    min="1"
                    value={repeatInterval}
                    onChange={(e) => setRepeatInterval(Number(e.target.value))}
                  /> {repeatOption === 'daily' ? 'day(s)' : repeatOption === 'weekly' ? 'week(s)' : repeatOption === 'monthly' ? 'month(s)' : 'year(s)'}
                </label>
                <label>
                  Repeat Until:
                  <input
                    type="date"
                    value={repeatEndDate}
                    onChange={(e) => setRepeatEndDate(e.target.value)}
                    required
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
            <a href="https://supabase.com/dashboard/project/bntoivaipesuovselglg/storage/buckets/event-images" target="_blank" rel="noopener noreferrer">
              Upload image to Supabase
            </a> and paste URL here.
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
          style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '0.75rem', border: 'none', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px' }}
        >
          Save Event
        </button>
      </form>
    </div>
  );
};

export default EditEventForm;
