// src/app/admin/edit-about/page.js - Admin interface for editing About page content

"use client";

import { useState, useEffect } from 'react';
import { supabase } from 'lib/supabaseClient';

export default function EditAboutPage() {
  const [aboutContent, setAboutContent] = useState({
    main_description: "",
    booking_description: "",
    services: [
      {
        title: "Vinyl Drop Nights",
        description: "Interactive vinyl listening experiences where attendees discover new music and share stories",
        price: "Contact for pricing"
      }
    ],
    testimonials: [
      {
        text: "Steve brought such a unique energy to our event. The vinyl experience was unforgettable!",
        author: "Sarah M., Event Coordinator"
      }
    ],
    booking_notes: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchAboutContent();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAboutContent = async () => {
    setLoading(true);
    try {
      // Try to fetch from Supabase table
      const { data, error } = await supabase
        .from('about_content')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows returned
        console.error('Error fetching about content:', error);
      } else if (data) {
        setAboutContent({
          main_description: data.main_description || "",
          booking_description: data.booking_description || "",
          services: data.services || aboutContent.services,
          testimonials: data.testimonials || aboutContent.testimonials,
          booking_notes: data.booking_notes || ""
        });
      }
    } catch (error) {
      console.error('Error fetching about content:', error);
      // Use default values if table doesn't exist yet
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    
    try {
      // First try to update existing record
      const { data: existingData } = await supabase
        .from('about_content')
        .select('id')
        .single();

      let result;
      if (existingData) {
        // Update existing record
        result = await supabase
          .from('about_content')
          .update({
            main_description: aboutContent.main_description,
            booking_description: aboutContent.booking_description,
            services: aboutContent.services,
            testimonials: aboutContent.testimonials,
            booking_notes: aboutContent.booking_notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingData.id);
      } else {
        // Insert new record
        result = await supabase
          .from('about_content')
          .insert([{
            main_description: aboutContent.main_description,
            booking_description: aboutContent.booking_description,
            services: aboutContent.services,
            testimonials: aboutContent.testimonials,
            booking_notes: aboutContent.booking_notes
          }]);
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
        Loading...
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

      {/* Main Description */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Main Description
        </h3>
        <textarea
          value={aboutContent.main_description}
          onChange={(e) => setAboutContent(prev => ({ ...prev, main_description: e.target.value }))}
          placeholder="Enter the main about description..."
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
        <small style={{ color: '#666', fontSize: '0.875rem' }}>
          Use \n\n for paragraph breaks
        </small>
      </div>

      {/* Booking Description */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Booking Description
        </h3>
        <textarea
          value={aboutContent.booking_description}
          onChange={(e) => setAboutContent(prev => ({ ...prev, booking_description: e.target.value }))}
          placeholder="Enter the booking section description..."
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

      {/* Services */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0 }}>
            Services
          </h3>
          <button
            onClick={addService}
            style={{
              backgroundColor: '#22c55e',
              color: 'white',
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            + Add Service
          </button>
        </div>
        
        {aboutContent.services.map((service, index) => (
          <div key={index} style={{
            border: '1px solid #ddd',
            borderRadius: '6px',
            padding: '1rem',
            marginBottom: '1rem',
            backgroundColor: '#f9f9f9'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold' }}>
                Service {index + 1}
              </h4>
              <button
                onClick={() => removeService(index)}
                style={{
                  backgroundColor: '#dc2626',
                  color: 'white',
                  padding: '0.25rem 0.5rem',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.75rem'
                }}
              >
                Remove
              </button>
            </div>
            
            <input
              type="text"
              value={service.title}
              onChange={(e) => updateService(index, 'title', e.target.value)}
              placeholder="Service title"
              style={{
                display: 'block',
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                marginBottom: '0.5rem'
              }}
            />
            
            <textarea
              value={service.description}
              onChange={(e) => updateService(index, 'description', e.target.value)}
              placeholder="Service description"
              rows="2"
              style={{
                display: 'block',
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                marginBottom: '0.5rem'
              }}
            />
            
            <input
              type="text"
              value={service.price}
              onChange={(e) => updateService(index, 'price', e.target.value)}
              placeholder="Price (e.g., 'Starting at $500' or 'Contact for pricing')"
              style={{
                display: 'block',
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
          </div>
        ))}
      </div>

      {/* Testimonials */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0 }}>
            Testimonials
          </h3>
          <button
            onClick={addTestimonial}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            + Add Testimonial
          </button>
        </div>
        
        {aboutContent.testimonials.map((testimonial, index) => (
          <div key={index} style={{
            border: '1px solid #ddd',
            borderRadius: '6px',
            padding: '1rem',
            marginBottom: '1rem',
            backgroundColor: '#f0f9ff'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold' }}>
                Testimonial {index + 1}
              </h4>
              <button
                onClick={() => removeTestimonial(index)}
                style={{
                  backgroundColor: '#dc2626',
                  color: 'white',
                  padding: '0.25rem 0.5rem',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.75rem'
                }}
              >
                Remove
              </button>
            </div>
            
            <textarea
              value={testimonial.text}
              onChange={(e) => updateTestimonial(index, 'text', e.target.value)}
              placeholder="Testimonial text"
              rows="2"
              style={{
                display: 'block',
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                marginBottom: '0.5rem'
              }}
            />
            
            <input
              type="text"
              value={testimonial.author}
              onChange={(e) => updateTestimonial(index, 'author', e.target.value)}
              placeholder="Author (e.g., 'Sarah M., Event Coordinator')"
              style={{
                display: 'block',
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
          </div>
        ))}
      </div>

      {/* Booking Notes */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Booking Notes
        </h3>
        <textarea
          value={aboutContent.booking_notes}
          onChange={(e) => setAboutContent(prev => ({ ...prev, booking_notes: e.target.value }))}
          placeholder="Additional booking information (travel fees, setup details, etc.)"
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
        <small style={{ color: '#666', fontSize: '0.875rem' }}>
          This appears at the bottom of the booking section
        </small>
      </div>

      {/* Save Button */}
      <div style={{ textAlign: 'center', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            backgroundColor: saving ? '#9ca3af' : '#2563eb',
            color: '#fff',
            padding: '0.75rem 2rem',
            border: 'none',
            borderRadius: '6px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '1.1rem',
            fontWeight: '600'
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Preview Link */}
      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <a
          href="/about"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#3b82f6',
            textDecoration: 'none',
            fontSize: '0.95rem'
          }}
        >
          Preview About Page →
        </a>
      </div>

      {/* Database Setup Instructions */}
      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        backgroundColor: '#fef3c7',
        border: '1px solid #f59e0b',
        borderRadius: '6px',
        fontSize: '0.875rem',
        color: '#92400e'
      }}>
        <strong>Database Setup Required:</strong>
        <p style={{ margin: '0.5rem 0' }}>
          If you see errors saving, you may need to create the about_content table in Supabase:
        </p>
        <code style={{
          display: 'block',
          backgroundColor: '#ffffff',
          padding: '0.5rem',
          borderRadius: '4px',
          fontSize: '0.8rem',
          marginTop: '0.5rem'
        }}>
          {`CREATE TABLE about_content (
  id SERIAL PRIMARY KEY,
  main_description TEXT,
  booking_description TEXT,
  services JSONB DEFAULT '[]',
  testimonials JSONB DEFAULT '[]',
  booking_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`}
        </code>
      </div>
    </div>
  );
}