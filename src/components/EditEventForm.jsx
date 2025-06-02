import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const EditEventForm = ({ event, onClose }) => {
  const [formData, setFormData] = useState({ ...event });
  const [uploading, setUploading] = useState(false);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);

    const { data, error } = await supabase.storage
      .from('event-images')
      .upload(`event-${event.id}-${file.name}`, file, { upsert: true });

    if (!error) {
      const publicUrl = supabase.storage
        .from('event-images')
        .getPublicUrl(data.path).data.publicUrl;
      setFormData(prev => ({ ...prev, image_url: publicUrl }));
    }

    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await supabase.from('events').update(formData).eq('id', event.id);
    onClose();
  };

  return (
    <form className="event-edit-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", background: "#f9f9f9", padding: "2rem", borderRadius: "8px", maxWidth: "600px" }}>
      <h2>Edit: {event.title}</h2>
      <label style={{ display: "flex", flexDirection: "column", fontWeight: "bold" }}>Title: <input name="title" value={formData.title} onChange={handleChange} /></label>
      <label style={{ display: "flex", flexDirection: "column", fontWeight: "bold" }}>Date: <input type="date" name="date" value={formData.date} onChange={handleChange} /></label>
      <label style={{ display: "flex", flexDirection: "column", fontWeight: "bold" }}>Time: <input name="time" value={formData.time} onChange={handleChange} /></label>
      <label style={{ display: "flex", flexDirection: "column", fontWeight: "bold" }}>Location: <input name="location" value={formData.location} onChange={handleChange} /></label>
      <label style={{ display: "flex", flexDirection: "column", fontWeight: "bold" }}>Info: <textarea name="info" value={formData.info} onChange={handleChange} /></label>
      <label style={{ display: "flex", flexDirection: "column", fontWeight: "bold" }}>Promo Image: <input type="file" onChange={handleImageUpload} disabled={uploading} /></label>
      {formData.image_url && <img src={formData.image_url} alt="Promo" style={{ maxWidth: 200 }} />}
      <label style={{ display: "flex", flexDirection: "column", fontWeight: "bold" }}>Has Queue: <input type="checkbox" name="has_queue" checked={formData.has_queue} onChange={handleChange} /></label>
      <label style={{ display: "flex", flexDirection: "column", fontWeight: "bold" }}>Allowed Formats:
        <input name="allowed_formats" value={formData.allowed_formats || ''} onChange={handleChange} placeholder="Vinyl, Cassette" />
      </label>
      <button type="submit">Save</button>
      <button type="button" onClick={onClose}>Cancel</button>
    </form>
  );
};

export default EditEventForm;
