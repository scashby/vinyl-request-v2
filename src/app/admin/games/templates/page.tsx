"use client";

import { useEffect, useState } from 'react';
import { Container } from 'components/ui/Container';

type TemplateRow = {
  id: number;
  name: string;
  game_type: string;
  template_state: unknown;
  created_at: string;
};

export default function GameTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [name, setName] = useState('');
  const [gameType, setGameType] = useState('trivia');
  const [templateJson, setTemplateJson] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const loadTemplates = async () => {
    const response = await fetch('/api/game-templates');
    const result = await response.json();
    if (response.ok) {
      setTemplates(result.data as TemplateRow[]);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleCreate = async () => {
    setStatus('');
    setError('');

    if (!name.trim()) {
      setError('Template name is required.');
      return;
    }

    let templateState: unknown = {};
    if (templateJson.trim()) {
      try {
        templateState = JSON.parse(templateJson.trim());
      } catch (parseError) {
        setError('Template JSON is invalid.');
        return;
      }
    }

    const response = await fetch('/api/game-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        gameType,
        templateState,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.error || 'Failed to create template.');
      return;
    }

    setStatus('Template created.');
    setName('');
    setTemplateJson('');
    await loadTemplates();
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Container size="lg">
        <div className="py-12">
          <p className="text-sm uppercase tracking-[0.35em] text-[#7bdcff]">
            Admin · Vinyl Games
          </p>
          <h1 className="text-3xl md:text-4xl font-black mt-2">
            Game Templates
          </h1>
          <p className="text-white/60 mt-2">
            Build reusable game setups you can apply to events later.
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
              <h2 className="text-lg font-semibold">Create template</h2>
              <div>
                <label className="text-sm font-semibold mb-2 block">
                  Template name
                </label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-lg bg-black/60 border border-white/10 px-4 py-3 text-white"
                  placeholder="Needle Drop Trivia Set 1"
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-2 block">
                  Game type
                </label>
                <select
                  value={gameType}
                  onChange={(event) => setGameType(event.target.value)}
                  className="w-full rounded-lg bg-black/60 border border-white/10 px-4 py-3 text-white"
                >
                  <option value="trivia">Needle Drop Trivia</option>
                  <option value="bingo">Vinyl Bingo</option>
                  <option value="bracketology">Bracketology</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold mb-2 block">
                  Template state (JSON)
                </label>
                <textarea
                  value={templateJson}
                  onChange={(event) => setTemplateJson(event.target.value)}
                  rows={6}
                  className="w-full rounded-lg bg-black/60 border border-white/10 px-4 py-3 text-white font-mono text-xs"
                  placeholder='{"trivia":{"questions":[{"prompt":"Name the sample","artist":"Artist","title":"Track"}]}}'
                />
              </div>
              <button
                type="button"
                onClick={handleCreate}
                className="rounded-lg bg-[#7bdcff] px-4 py-2 font-semibold text-black"
              >
                Save Template
              </button>
              {status && <p className="text-sm text-green-400">{status}</p>}
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0c0f1a] p-6">
              <h2 className="text-lg font-semibold mb-4">Saved templates</h2>
              <div className="space-y-3 max-h-[420px] overflow-y-auto">
                {templates.length === 0 && (
                  <p className="text-sm text-white/60">
                    No templates yet. Create one to get started.
                  </p>
                )}
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="rounded-xl border border-white/10 bg-black/40 p-4"
                  >
                    <div className="text-xs uppercase tracking-widest text-white/60">
                      {template.game_type}
                    </div>
                    <div className="mt-2 font-semibold">{template.name}</div>
                    <div className="text-xs text-white/60 mt-1">
                      {new Date(template.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
