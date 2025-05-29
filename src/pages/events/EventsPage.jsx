
export default function EventsPage() {
  const sampleEvents = [
    { id: 1, name: 'Vinyl Sunday', date: '2025-06-02' },
    { id: 2, name: '80s Night', date: '2025-06-09' }
  ];

  return (
    <main>
      <h1>Upcoming Events</h1>
      {sampleEvents.map(event => (
        <div key={event.id} className="card">
          <h2>{event.name}</h2>
          <p>Date: {event.date}</p>
          <a className="button" href={`/events/${event.id}`}>View Details</a>
        </div>
      ))}
    </main>
  );
}
