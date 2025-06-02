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
  const [showSeriesModal, setShowSeriesModal] = useState(false); // ensure git detects change

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
        <h1>Admin: Events</h1>
      </header>
      <Breadcrumbs />
      <main className="internal-body">
        <div className="admin-controls">
          <button onClick={handleCreate}>Create New Event</button>
          <button onClick={handleAddSeries}>Add Series</button>
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
          <section className="admin-events">
            {events.map((event) => (
              <article key={event.id} className="admin-event-card">
                <div className="admin-event-info">
                  <h2>{event.title}</h2>
                  <p>{event.date}</p>
                  <p>{event.time}</p>
                </div>
                <div className="admin-event-actions">
                  <button onClick={() => handleEdit(event)}>Edit</button>
                  <button onClick={() => handleDuplicate(event)}>Duplicate</button>
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
