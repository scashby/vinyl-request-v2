// EditEventForm.tsx — Fully TypeScript-safe, no .checked on ambiguous targets

"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from 'lib/supabaseClient';

const formatList = ['Vinyl', 'Cassettes', 'CD', '45s', '8-Track'];

export default function EditEventForm() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const router = useRouter();
  const [eventData, setEventData] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    image_url: '',
    info: '',
    info_url: '',
    has_queue: false,
    allowed_formats: [] as string[],
  });

  useEffect(() => {
    const fetchEvent = async () => {
      let copiedEvent = null;
      if (typeof window !== 'undefined') {
        const stored = sessionStorage.getItem('copiedEvent');
        if (stored) {
          copiedEvent = JSON.parse(stored);
          sessionStorage.removeItem('copiedEvent');
        }
      }
      if (copiedEvent) {
        setEventData({
          ...eventData,
          ...copiedEvent,
          allowed_formats: Array.isArray(copiedEvent.allowed_formats)
            ? copiedEvent.allowed_formats
            : typeof copiedEvent.allowed_formats === 'string'
              ? copiedEvent.allowed_formats.replace(/[{}]/g, '').split(',').map((f: string) => f.trim()).filter(Boolean)
              : [],
          title: copiedEvent.title ? `${copiedEvent.title} (Copy)` : '',
        });
      } else if (id) {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          console.error('Error fetching event:', error);
        } else if (data) {
          setEventData({
            ...eventData,
            ...data,
            allowed_formats: Array.isArray(data.allowed_formats)
              ? data.allowed_formats
              : typeof data.allowed_formats === 'string'
                ? data.allowed_formats.replace(/[{}]/g, '').split(',').map((f: string) => f.trim()).filter(Boolean)
                : [],
          });
        }
      }
    };
    fetchEvent();
    // eslint-disable-next-line
  }, [id]);

  // For all text inputs and textareas (NO CHECKBOXES HERE)
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setEventData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // For has_queue checkbox
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setEventData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  // For allowed_formats checkboxes only
  const handleFormatChange = (format: string, checked: boolean) => {
    setEventData((prev) => {
      const formats = Array.isArray(prev.allowed_formats) ? [...prev.allowed_formats] : [];
      if (checked) {
        return { ...prev, allowed_formats: [...formats, format] };
      } else {
        return { ...prev, allowed_formats: formats.filter((f) => f !== format) };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...eventData,
      allowed_formats: `{${eventData.allowed_formats.map(f => f.trim()).join(',')}}`,
    };

    let result;
    if (id) {
      result = await supabase.from('events').update(payload).eq('id', id);
    } else {
      result = await supabase.from('events').insert([payload]);
    }

    if (result.error) {
      alert(`Error saving event: ${result.error.message}`);
    } else {
      router.push('/admin/manage-events');
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
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
        {id ? 'Edit Event' : 'New Event'}
      </h2>
      <form onSubmit={handleSubmit}>
        <input
          name="title"
          value={eventData.title}
          onChange={handleChange}
          placeholder="Title"
          required
          style={{ display: 'block', width: '100%', marginBottom: '1rem' }}
        />
        <input
          name="date"
          value={eventData.date}
          onChange={handleChange}
          placeholder="Date"
          style={{ display: 'block', width: '100%', marginBottom: '1rem' }}
        />
        <input
          name="time"
          value={eventData.time}
          onChange={handleChange}
          placeholder="Time"
          style={{ display: 'block', width: '100%', marginBottom: '1rem' }}
        />
        <input
          name="location"
          value={eventData.location}
          onChange={handleChange}
          placeholder="Location"
          style={{ display: 'block', width: '100%', marginBottom: '1rem' }}
        />
        <input
          name="image_url"
          value={eventData.image_url}
          onChange={handleChange}
          placeholder="Image URL"
          style={{ display: 'block', width: '100%', marginBottom: '0.5rem' }}
        />
        <a
          href="https://supabase.com/dashboard/project/bntoivaipesuovselglg/storage/buckets/event-images"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'block', marginBottom: '1rem', color: '#2563eb', textDecoration: 'underline' }}
        >
          Upload image manually to Supabase
        </a>
        <textarea
          name="info"
          value={eventData.info}
          onChange={handleChange}
          placeholder="Event Info"
          style={{ display: 'block', width: '100%', marginBottom: '1rem' }}
        />
        <input
          name="info_url"
          value={eventData.info_url || ''}
          onChange={handleChange}
          placeholder="Event Info URL (optional)"
          style={{ display: 'block', width: '100%', marginBottom: '1rem' }}
        />
        <label style={{ display: 'block', marginBottom: '1rem' }}>
          <input
            type="checkbox"
            name="has_queue"
            checked={eventData.has_queue}
            onChange={handleCheckboxChange}
          />
          {' '}Has Queue
        </label>

        <fieldset style={{ marginBottom: '1rem' }}>
          <legend>Allowed Formats</legend>
          {formatList.map((format) => (
            <label key={format} style={{ display: 'block', marginBottom: '0.25rem' }}>
              <input
                type="checkbox"
                name="allowed_formats"
                value={format}
                checked={Array.isArray(eventData.allowed_formats) ? eventData.allowed_formats.includes(format) : false}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFormatChange(format, e.target.checked)}
              />
              {' '}{format}
            </label>
          ))}
        </fieldset>

        <button
          type="submit"
          style={{
            backgroundColor: '#2563eb',
            color: '#fff',
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          Save
        </button>
      </form>
    </div>
  );
}
