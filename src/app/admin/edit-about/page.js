// src/app/admin/edit-about/page.js - Admin interface for editing About page content

"use client";

import { useState, useEffect } from 'react';
import { supabase } from 'lib/supabaseClient';

export default function EditAboutPage() {
  const [aboutContent, setAboutContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchAboutContent();
  }, []);

  const fetchAboutContent = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('about_content')
        .select('*')
        .single();

      if (error) {
        setMessage('Error loading content. Please check database setup.');
        console.error('Error fetching about content:', error);
      } else if (data) {
        setAboutContent(data);
      } else {
        setMessage('No content found. Database may be empty.');
      }
    } catch (error) {
      setMessage('Error loading content. Please check database setup.');
      console.error('Error fetching about content:', error);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    
    try {
      const { data: existingData } = await supabase
        .from('about_content')
        .select('id')
        .single();

      let result;
      if (existingData) {
        result = await supabase
          .from('about_content')
          .update({
            main_description: aboutContent.main_description,
            booking_description: aboutContent.booking_description,
            contact_name: aboutContent.contact_name,
            contact_company: aboutContent.contact_company,
            contact_email: aboutContent.contact_email,
            contact_phone: aboutContent.contact_phone,
            calendly_url: aboutContent.calendly_url,
            services: aboutContent.services,
            testimonials: aboutContent.testimonials,
            booking_notes: aboutContent.booking_notes,
            amazon_wishlist_url: aboutContent.amazon_wishlist_url,
            discogs_wantlist_url: aboutContent.discogs_wantlist_url,
            linktree_url: aboutContent.linktree_url,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingData.id);
      } else {
        result = await supabase
          .from('about_content')
          .insert([aboutContent]);
      }

      if (result.error) {
        throw result.error;
      }

      setMessage('About page content saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error saving about content:', error);
      setMessage(`Error saving: ${error.message}`);
    }
    setSaving(false);
  };

  const addService = () => {
    setAboutContent(prev => ({
      ...prev,
      services: [...prev.services, { title: "", description: "", price: "" }]
    }));
  };

  const updateService = (index, field, value) => {
    setAboutContent(prev => ({
      ...prev,
      services: prev.services.map((service, i) => 
        i === index ? { ...service, [field]: value } : service
      )
    }));
  };

  const removeService = (index) => {
    setAboutContent(prev => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index)
    }));
  };

  const addTestimonial = () => {
    setAboutContent(prev => ({
      ...prev,
      testimonials: [...prev.testimonials, { text: "", author: "" }]
    }));
  };

  const updateTestimonial = (index, field, value) => {
    setAboutContent(prev => ({
      ...prev,
      testimonials: prev.testimonials.map((testimonial, i) => 
        i === index ? { ...testimonial, [field]: value } : testimonial
      )
    }));
  };

  const removeTestimonial = (index) => {
    setAboutContent(prev => ({
      ...prev,
      testimonials: prev.testimonials.filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div style={{
        maxWidth: '800px',
        margin: '2rem auto',
        padding: '2rem',
        textAlign: 'center'
      }}>
        Loading content...
      </div>
    );
  }

  if (!aboutContent) {
    return (
      <div style={{
        maxWidth: '800px',
        margin: '2rem auto',
        padding: '2rem',
        backgroundColor: '#ffffff',
        border: '1px solid #ddd',
        borderRadius: '8px'
      }}>
        <h2>Database Setup Required</h2>
        <p>Run this SQL in Supabase to populate your content:</p>
        <pre style={{
          backgroundColor: '#f5f5f5',
          padding: '1rem',
          borderRadius: '4px',
          fontSize: '0.9rem',
          overflow: 'auto'
        }}>
{`INSERT INTO about_content (
  main_description,
  booking_description,
  contact_name,
  contact_company,
  contact_email,
  contact_phone,
  calendly_url,
  services,
  testimonials,
  booking_notes,
  amazon_wishlist_url,
  discogs_wantlist_url,
  linktree_url
) VALUES (
  'Hi, I''m Stephen. If you ever wanted to know why anyone still loves vinyl, cassettes, or tangling with Discogs, you''re in the right place.

This site is a home for vinyl drop nights, weird collection habits, top 10 wishlists, and the best and worst audio formats ever invented.

There will be occasional silly interviews, commentary, and projects from the road (and the turntable).',
  'Looking to bring vinyl culture to your venue or event? Dead Wax Dialogues offers unique vinyl experiences that connect people through music discovery and storytelling.',
  'Steve Ashby',
  'Dead Wax Dialogues',
  'steve@deadwaxdialogues.com',
  '443-235-6608',
  'https://calendly.com/deadwaxdialogues',
  '[
    {"title": "Vinyl Drop Nights", "description": "Interactive vinyl listening experiences where attendees discover new music and share stories", "price": "Contact for pricing"},
    {"title": "Private Events", "description": "Custom vinyl experiences for parties, corporate events, and special occasions", "price": "Starting at $500"},
    {"title": "Educational Workshops", "description": "Learn about vinyl history, collecting, and the culture surrounding physical media", "price": "Starting at $300"}
  ]',
  '[
    {"text": "Steve brought such a unique energy to our event. The vinyl experience was unforgettable!", "author": "Sarah M., Event Coordinator"},
    {"text": "Dead Wax Dialogues turned our corporate gathering into something truly special.", "author": "Mike R., Corporate Events"}
  ]',
  'All events include professional setup, curated vinyl selection, and engaging facilitation. Travel fees may apply for events outside the Baltimore/DC area.',
  'https://www.amazon.com/hz/wishlist/ls/D5MXYF471325?ref_=wl_share',
  'https://www.discogs.com/wantlist?user=socialblunders',
  'https://linktr.ee/deadwaxdialogues'
);`}
        </pre>
        <button onClick={fetchAboutContent} style={{
          backgroundColor: '#2563eb',
          color: '#fff',
          padding: '0.5rem 1rem',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginTop: '1rem'
        }}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '800px',
      margin: '2rem auto',
      padding: '2rem',
      backgroundColor: '#ffffff',
      color: '#000000',
      border: '1px solid #ddd',
      borderRadius: '8px',
      boxShadow: '0 0 8px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
        Edit About Page Content
      </h2>

      {message && (
        <div style={{
          padding: '1rem',
          marginBottom: '1.5rem',
          borderRadius: '4px',
          backgroundColor: message.includes('Error') ? '#fee2e2' : '#dcfce7',
          color: message.includes('Error') ? '#dc2626' : '#16a34a',
          border: `1px solid ${message.includes('Error') ? '#fca5a5' : '#bbf7d0'}`
        }}>
          {message}
        </div>
      )}

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Main Description
        </h3>
        <textarea
          value={aboutContent.main_description || ''}
          onChange={(e) => setAboutContent(prev => ({ ...prev, main_description: e.target.value }))}
          rows="6"
          style={{
            display: 'block',
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '1rem',
            fontFamily: 'inherit'
          }}
        />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Booking Description
        </h3>
        <textarea
          value={aboutContent.booking_description || ''}
          onChange={(e) => setAboutContent(prev => ({ ...prev, booking_description: e.target.value }))}
          rows="3"
          style={{
            display: 'block',
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '1rem',
            fontFamily: 'inherit'
          }}
        />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Contact Information
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Contact Name"
            value={aboutContent.contact_name || ''}
            onChange={(e) => setAboutContent(prev => ({ ...prev, contact_name: e.target.value }))}
            style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <input
            type="text"
            placeholder="Company Name"
            value={aboutContent.contact_company || ''}
            onChange={(e) => setAboutContent(prev => ({ ...prev, contact_company: e.target.value }))}
            style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <input
            type="email"
            placeholder="Email"
            value={aboutContent.contact_email || ''}
            onChange={(e) => setAboutContent(prev => ({ ...prev, contact_email: e.target.value }))}
            style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <input
            type="tel"
            placeholder="Phone"
            value={aboutContent.contact_phone || ''}
            onChange={(e) => setAboutContent(prev => ({ ...prev, contact_phone: e.target.value }))}
            style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>
        <input
          type="url"
          placeholder="Calendly URL"
          value={aboutContent.calendly_url || ''}
          onChange={(e) => setAboutContent(prev => ({ ...prev, calendly_url: e.target.value }))}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
        />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0 }}>Services</h3>
          <button onClick={addService} style={{
            backgroundColor: '#22c55e', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer'
          }}>
            + Add Service
          </button>
        </div>
        {aboutContent.services && aboutContent.services.map((service, index) => (
          <div key={index} style={{
            border: '1px solid #ddd', borderRadius: '6px', padding: '1rem', marginBottom: '1rem', backgroundColor: '#f9f9f9'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0 }}>Service {index + 1}</h4>
              <button onClick={() => removeService(index)} style={{
                backgroundColor: '#dc2626', color: 'white', padding: '0.25rem 0.5rem', border: 'none', borderRadius: '4px', cursor: 'pointer'
              }}>
                Remove
              </button>
            </div>
            <input
              type="text"
              value={service.title || ''}
              onChange={(e) => updateService(index, 'title', e.target.value)}
              placeholder="Service title"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '0.5rem' }}
            />
            <textarea
              value={service.description || ''}
              onChange={(e) => updateService(index, 'description', e.target.value)}
              placeholder="Service description"
              rows="2"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '0.5rem' }}
            />
            <input
              type="text"
              value={service.price || ''}
              onChange={(e) => updateService(index, 'price', e.target.value)}
              placeholder="Price"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0 }}>Testimonials</h3>
          <button onClick={addTestimonial} style={{
            backgroundColor: '#3b82f6', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer'
          }}>
            + Add Testimonial
          </button>
        </div>
        {aboutContent.testimonials && aboutContent.testimonials.map((testimonial, index) => (
          <div key={index} style={{
            border: '1px solid #ddd', borderRadius: '6px', padding: '1rem', marginBottom: '1rem', backgroundColor: '#f0f9ff'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0 }}>Testimonial {index + 1}</h4>
              <button onClick={() => removeTestimonial(index)} style={{
                backgroundColor: '#dc2626', color: 'white', padding: '0.25rem 0.5rem', border: 'none', borderRadius: '4px', cursor: 'pointer'
              }}>
                Remove
              </button>
            </div>
            <textarea
              value={testimonial.text || ''}
              onChange={(e) => updateTestimonial(index, 'text', e.target.value)}
              placeholder="Testimonial text"
              rows="2"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '0.5rem' }}
            />
            <input
              type="text"
              value={testimonial.author || ''}
              onChange={(e) => updateTestimonial(index, 'author', e.target.value)}
              placeholder="Author"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Booking Notes</h3>
        <textarea
          value={aboutContent.booking_notes || ''}
          onChange={(e) => setAboutContent(prev => ({ ...prev, booking_notes: e.target.value }))}
          placeholder="Additional booking information"
          rows="3"
          style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px' }}
        />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem' }}>External Links</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
          <input
            type="url"
            placeholder="Amazon Wishlist URL"
            value={aboutContent.amazon_wishlist_url || ''}
            onChange={(e) => setAboutContent(prev => ({ ...prev, amazon_wishlist_url: e.target.value }))}
            style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <input
            type="url"
            placeholder="Discogs Wantlist URL"
            value={aboutContent.discogs_wantlist_url || ''}
            onChange={(e) => setAboutContent(prev => ({ ...prev, discogs_wantlist_url: e.target.value }))}
            style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <input
            type="url"
            placeholder="Linktree URL"
            value={aboutContent.linktree_url || ''}
            onChange={(e) => setAboutContent(prev => ({ ...prev, linktree_url: e.target.value }))}
            style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>
      </div>

      <div style={{ textAlign: 'center', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
        <button onClick={handleSave} disabled={saving} style={{
          backgroundColor: saving ? '#9ca3af' : '#2563eb',
          color: '#fff',
          padding: '0.75rem 2rem',
          border: 'none',
          borderRadius: '6px',
          cursor: saving ? 'not-allowed' : 'pointer',
          fontSize: '1.1rem',
          fontWeight: '600'
        }}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}