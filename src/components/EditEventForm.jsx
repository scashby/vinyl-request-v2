import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const EditEventForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [eventData, setEventData] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    image_url: '',
    info: '',
    has_queue: false,
    allowed_formats: '',
  });

  useEffect(() => {
    const fetchEvent = async () => {
      if (id) {
        const { data, error } = await supabase.from('events').select('*').eq('id', Number(id)).single();
        if (error) {
          console.error('Error fetching event:', error.message);
        } else {
          setEventData(data);
        }
      }
    };
    fetchEvent();
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEventData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (id) {
      const { error } = await supabase.from('events').update(eventData).eq('id', Number(id));
      if (error) {
        console.error('Error updating event:', error.message);
      } else {
        navigate('/admin/events');
      }
    } else {
      const { error } = await supabase.from('events').insert([eventData]);
      if (error) {
        console.error('Error creating event:', error.message);
      } else {
        navigate('/admin/events');
      }
    }
  };

  const handleCopy = async () => {
    const { error } = await supabase.from('events').insert([eventData]);
    if (error) {
      console.error('Error copying event:', error.message);
    } else {
      navigate('/admin/events');
    }
  };

  return (
    <div className="form-container">
      <h2>{id ? 'Edit Event' : 'Add New Event'}</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Title:
          <input type="text" name="title" value={eventData.title} onChange={handleChange} required />
        </label>
        <label>
          Date:
          <input type="date" name="date" value={eventData.date} onChange={handleChange} required />
        </label>
        <label>
          Time:
          <input type="text" name="time" value={eventData.time} onChange={handleChange} />
        </label>
        <label>
          Location:
          <input type="text" name="location" value={eventData.location} onChange={handleChange} />
        </label>
        <label>
          Artwork URL:
          <input type="text" name="image_url" value={eventData.image_url} onChange={handleChange} />
        </label>
        <label>
          Info:
          <textarea name="info" value={eventData.info} onChange={handleChange}></textarea>
        </label>
        <label>
          <input
            type="checkbox"
            name="has_queue"
            checked={eventData.has_queue}
            onChange={handleChange}
          />
          Has Queue
        </label>
        {eventData.has_queue && (
          <label>
            Allowed Formats:
            <input
              type="text"
              name="allowed_formats"
              value={eventData.allowed_formats}
              onChange={handleChange}
            />
          </label>
        )}
        <button type="submit">Save Event</button>
        {id && <button type="button" onClick={handleCopy}>Copy This Event</button>}
      </form>
    </div>
  );
};

export default EditEventForm;
