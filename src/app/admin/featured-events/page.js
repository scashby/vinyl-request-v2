// app/admin/featured-events/page.js
// Admin Featured Events page ("/admin/featured-events")
// Lets admins manage is_featured_upnext, is_featured_grid, and featured_priority
// for upcoming / TBA events without touching recurrence or other event fields.

"use client";

import { useEffect, useState } from 'react';
import { supabase } from 'lib/supabaseClient';

export default function Page() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load upcoming & TBA events
  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('events')
        .select('id,title,date,location,is_featured_upnext,is_featured_grid,featured_priority')
        .or(`date.gte.${today},date.eq.9999-12-31`)
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching featured events:', error);
        alert(`Error loading events: ${error.message}`);
        setEvents([]);
      } else {
        setEvents(data || []);
      }
      setLoading(false);
    }

    fetchEvents();
  }, []);

  async function refreshEvents() {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('events')
      .select('id,title,date,location,is_featured_upnext,is_featured_grid,featured_priority')
      .or(`date.gte.${today},date.eq.9999-12-31`)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error refreshing featured events:', error);
      alert(`Error refreshing events: ${error.message}`);
    } else {
      setEvents(data || []);
    }
  }

  async function updateEventFlags(id, updates) {
    // Optimistic UI update
    setEvents((prev) =>
      prev.map((ev) => (ev.id === id ? { ...ev, ...updates } : ev))
    );

    const { error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating featured flags:', error);
      alert(`Error saving changes: ${error.message}`);
      // Reload from DB to undo optimistic update on failure
      await refreshEvents();
    }
  }

  function handleToggleUpNext(eventRow, nextChecked) {
    // Enforce at most 2 Up Next events
    if (nextChecked) {
      const upNextCount = events.filter((e) => !!e.is_featured_upnext).length;
      if (!eventRow.is_featured_upnext && upNextCount >= 2) {
        alert('You can only have 2 "Up Next" events at a time.');
        return;
      }
    }

    updateEventFlags(eventRow.id, { is_featured_upnext: nextChecked });
  }

  function handleToggleGrid(eventRow, nextChecked) {
    updateEventFlags(eventRow.id, { is_featured_grid: nextChecked });
  }

  function handlePriorityChange(eventRow, value) {
    const trimmed = value.trim();
    const parsed =
      trimmed === '' ? null : Number.isNaN(parseInt(trimmed, 10)) ? null : parseInt(trimmed, 10);

    updateEventFlags(eventRow.id, { featured_priority: parsed });
  }

  const renderDate = (date) => {
    if (!date || date === '9999-12-31') return 'TBA';
    return date;
  };

  return (
    <div
      style={{
        maxWidth: '900px',
        margin: '2rem auto',
        padding: '2rem',
        backgroundColor: '#ffffff',
        color: '#000000',
        border: '1px solid #ddd',
        borderRadius: '8px',
        minHeight: '100vh',
        boxShadow: '0 0 8px rgba(0,0,0,0.1)',
      }}
    >
      <h2
        style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          marginBottom: '1.5rem',
        }}
      >
        Manage Featured Events
      </h2>

      <p style={{ marginBottom: '1rem', fontSize: '0.95rem', color: '#555' }}>
        Use this page to control which upcoming/TBA events appear in{' '}
        <strong>Up Next</strong>, the <strong>Featured Grid</strong>, and in what{' '}
        <strong>priority order</strong>. Changes are saved immediately.
      </p>

      {loading ? (
        <div>Loading events…</div>
      ) : events.length === 0 ? (
        <div>No upcoming or TBA events found.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.9rem',
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '0.5rem',
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  Title
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '0.5rem',
                    borderBottom: '1px solid #e5e7eb',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Date
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '0.5rem',
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  Location
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '0.5rem',
                    borderBottom: '1px solid #e5e7eb',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Up Next
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '0.5rem',
                    borderBottom: '1px solid #e5e7eb',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Featured Grid
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '0.5rem',
                    borderBottom: '1px solid #e5e7eb',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Priority
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td
                    style={{
                      padding: '0.5rem',
                      borderBottom: '1px solid #f3f4f6',
                      maxWidth: '280px',
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{ev.title}</div>
                  </td>
                  <td
                    style={{
                      padding: '0.5rem',
                      borderBottom: '1px solid #f3f4f6',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {renderDate(ev.date)}
                  </td>
                  <td
                    style={{
                      padding: '0.5rem',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    {ev.location || ''}
                  </td>
                  <td
                    style={{
                      padding: '0.5rem',
                      borderBottom: '1px solid #f3f4f6',
                      textAlign: 'center',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!ev.is_featured_upnext}
                      onChange={(e) => handleToggleUpNext(ev, e.target.checked)}
                    />
                  </td>
                  <td
                    style={{
                      padding: '0.5rem',
                      borderBottom: '1px solid #f3f4f6',
                      textAlign: 'center',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!ev.is_featured_grid}
                      onChange={(e) => handleToggleGrid(ev, e.target.checked)}
                    />
                  </td>
                  <td
                    style={{
                      padding: '0.5rem',
                      borderBottom: '1px solid #f3f4f6',
                      textAlign: 'center',
                    }}
                  >
                    <input
                      type="number"
                      style={{ width: '4rem' }}
                      value={ev.featured_priority ?? ''}
                      onChange={(e) => handlePriorityChange(ev, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
