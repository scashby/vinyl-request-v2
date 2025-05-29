
export default function EventDetail() {
  const event = { name: 'Vinyl Sunday', date: '2025-06-02', description: 'Bring your own vinyl!' };

  return (
    <main>
      <h1>{event.name}</h1>
      <div className="card">
        <h2>Date: {event.date}</h2>
        <p>{event.description}</p>
        <button className="button">Add to Queue</button>
      </div>
    </main>
  );
}
