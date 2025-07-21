// src/app/admin/audio-recognition/settings.tsx
'use client';
import { useEffect, useState } from 'react';
import 'src/styles/internal.css';

type ProviderKey = 'acrcloud' | 'audd' | 'acoustid';
const defaultSettings: Record<ProviderKey, boolean> = {
  acrcloud: true,
  audd: true,
  acoustid: true
};

export default function RecognitionSettingsPage() {
  const [settings, setSettings] = useState<Record<ProviderKey, boolean>>(defaultSettings);

  useEffect(() => {
    const stored = localStorage.getItem('recognitionProviderSettings');
    if (stored) {
      setSettings(JSON.parse(stored));
    }
  }, []);

  const handleToggle = (key: ProviderKey) => {
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    localStorage.setItem('recognitionProviderSettings', JSON.stringify(updated));
  };

  return (
    <main className="p-4">
      <h1>Recognition Providers</h1>
      <ul>
        {Object.entries(settings).map(([key, val]) => (
          <li key={key}>
            <label>
              <input type="checkbox" checked={val} onChange={() => handleToggle(key as ProviderKey)} />
              {key}
            </label>
          </li>
        ))}
      </ul>
    </main>
  );
}
