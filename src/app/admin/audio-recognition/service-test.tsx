// src/app/admin/audio-recognition/service-test.tsx
'use client';
import { useState } from 'react';

export default function ServiceTestPage() {
  const [results, setResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  const testEndpoints = async () => {
    setLoading(true);
    const endpoints = [
      { name: 'ACRCloud', url: '/api/audio-recognition/test-acrcloud' },
      { name: 'AudD', url: '/api/audio-recognition/test-audd' },
      { name: 'AcoustID', url: '/api/audio-recognition/test-acoustid' }
    ];

    const newResults: Record<string, any> = {};
    for (const { name, url } of endpoints) {
      try {
        const res = await fetch(url);
        const json = await res.json();
        newResults[name] = json;
      } catch (err) {
        newResults[name] = 'Error or invalid response';
      }
    }

    setResults(newResults);
    setLoading(false);
  };

  return (
    <main className="p-4">
      <h1>Recognition Service Diagnostics</h1>
      <button onClick={testEndpoints} disabled={loading}>
        {loading ? 'Running...' : 'Run Tests'}
      </button>
      <ul>
        {Object.entries(results).map(([service, output]) => (
          <li key={service}>
            <h2>{service}</h2>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(output, null, 2)}</pre>
          </li>
        ))}
      </ul>
    </main>
  );
}
