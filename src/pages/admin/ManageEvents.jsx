import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Breadcrumbs from '../../components/Breadcrumbs';
import EditEventForm from '../../components/EditEventForm';
import AddSeriesModal from '../../components/AddSeriesModal';
import '../../styles/internal.css';
import '../../styles/breadcrumb.css';

const ManageEvents = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showSeriesModal, setShowSeriesModal] = useState(false); // correctly declared

  useEffect(() => {
    const fetchEvents = async () => {
      const { data, error } = await supabase.from('events').select('*').order('date');
      if (error) {
        console.error('Error fetching events:', error.message);
      } else {
        setEvents(data);
      }
    };

    fetchEvents();
  }, []);

  const handleEdit = (event) => {
    setSelectedEvent(event);
    setIsCreating(false);
  };

  const handleCreate = () => {
    setSelectedEvent(null);
    setIsCreating(true);
  };

  const handleDuplicate = (event) => {
    const clone = { ...event, id: null, title: `${event.title} (Copy)` };
    setSelectedEvent(clone);
    setIsCreating(true);
  };

  const handleAddSeries = () => {
    setShowSeriesModal(true);
  };

  const handleCloseModal = () => {
    setShowSeriesModal(false);
  };

  return (
    <div className="page-wrapper">
      <header className="internal-header">
        <h1 style={{ color: '#000' }}>Admin: Events</h1>
      </header>
      <Breadcrumbs />
      <main className="internal-body">
        <div className="admin-controls">
          <button className="blue-button" onClick={handleCreate}>Create New Event</button>
          <button className="blue-button" onClick={handleAddSeries}>Add Series</button>
        </div>
        {showSeriesModal && <AddSeriesModal onClose={handleCloseModal} />}
        {isCreating || selectedEvent ? (
          <EditEventForm
            eventData={selectedEvent}
            onCancel={() => {
              setSelectedEvent(null);
              setIsCreating(false);
            }}
          />
        ) : (
          <section className="event-grid">
            {events.map((event) => (
              <article key={event.id} className="event-card admin-event-card">
                <div className="admin-event-info">
                  <h2 style={{ color: '#000' }}>{event.title}</h2>
                  <p style={{ color: '#000' }}>{event.date}</p>
                  <p style={{ color: '#000' }}>{event.time}</p>
                </div>
                <div className="admin-event-actions">
                  <button className="blue-button" onClick={() => handleEdit(event)}>Edit</button>
                  <button className="blue-button" onClick={() => handleDuplicate(event)}>Duplicate</button>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
      <footer className="footer">
        © 2025 Dead Wax Dialogues
      </footer>
    </div>
  );
};

export default ManageEvents;
