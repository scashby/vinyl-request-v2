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
    if (id) {
      const fetchEvent = async () => {
        const { data, error } = await supabase.from('events').select('*').eq('id', Number(id)).single();
        if (!error) setFormData(data);
      };
      fetchEvent();
    } else {
      const copied = sessionStorage.getItem('copiedEvent');
      if (copied) {
        const copiedData = JSON.parse(copied);
        const { id, created_at, ...cleaned } = copiedData;
        setFormData({
          ...cleaned,
          title: `${cleaned.title} (Copy)`,
          date: '',
        });
        sessionStorage.removeItem('copiedEvent');
      }
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
      if (error) alert('Error saving repeating events');
      else navigate('/admin/events');
    };

    if (!id && repeatOption !== 'none' && repeatEndDate) {
      await insertMultiple();
    } else {
      const { error } = id
        ? await supabase.from('events').update(formData).eq('id', Number(id))
        : await supabase.from('events').insert([formData]);
      if (error) alert('Error saving event');
      else navigate('/admin/events');
    }
  };

  return (
    <div style={{
      maxWidth: '600px',
      margin: '2rem auto',
      padding: '2rem',
      backgroundColor: '#ffffff',
      color: '#000000',
      border: '1px solid #ddd',
      minHeight: '100vh'
    }}>
      <h2 style={{ marginBottom: '1.5rem' }}>{id ? 'Edit Event' : 'Create New Event'}</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <label>
          Title:<br />
          <input type="text" name="title" value={formData.title} onChange={handleChange} required />
        </label>
        <label>
          Date:<br />
          <input type="date" name="date" value={formData.date} onChange={handleChange} required />
        </label>
        {!id && (
          <>
            <label>
              Repeat:<br />
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
                  Every:<br />
                  <input
                    type="number"
                    min="1"
                    value={repeatInterval}
                    onChange={(e) => setRepeatInterval(Number(e.target.value))}
                  /> {repeatOption}
                </label>
                <label>
                  Repeat Until:<br />
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
          Time:<br />
          <input type="text" name="time" value={formData.time} onChange={handleChange} />
        </label>
        <label>
          Location:<br />
          <input type="text" name="location" value={formData.location} onChange={handleChange} />
        </label>
        <label>
          Info:<br />
          <textarea name="info" value={formData.info} onChange={handleChange} rows={3} />
        </label>
        <label>
          Image URL:<br />
          <input type="text" name="image_url" value={formData.image_url} onChange={handleChange} />
          <br />
          <a href="https://supabase.com/dashboard/project/bntoivaipesuovselglg/storage/buckets/event-images"
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '0.85rem', display: 'inline-block', marginTop: '0.25rem' }}>
            Upload image to Supabase
          </a> and paste URL here.
        </label>
        <label>
          Allowed Formats:<br />
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
          style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '0.75rem', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Save Event
        </button>
      </form>
    </div>
  );
};

export default EditEventForm;
