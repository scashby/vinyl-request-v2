
export default function BrowsePage() {
  const collection = [
    { id: 1, album: 'Unknown Pleasures', artist: 'Joy Division' },
    { id: 2, album: 'Kind of Blue', artist: 'Miles Davis' }
  ];

  return (
    <main>
      <h1>Browse Collection</h1>
      {collection.map(record => (
        <div key={record.id} className="card">
          <h2>{record.album}</h2>
          <p>by {record.artist}</p>
          <button className="button">Request Side A</button>
        </div>
      ))}
    </main>
  );
}
