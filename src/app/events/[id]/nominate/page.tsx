"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { supabase } from 'src/lib/supabaseClient';
import { Container } from 'components/ui/Container';

type EventSummary = {
  id: number;
  title: string;
  date: string | null;
};

type Candidate = {
  id: number;
  artist: string;
  title: string;
  cover_image: string | null;
  vote_count: number;
};

type MasterSearchResult = {
  id: number;
  title: string;
  cover_image_url: string | null;
  artist?: {
    id: number;
    name: string | null;
  } | null;
};

export default function TournamentNominationPage() {
  const params = useParams();
  const eventId = Number(params.id);

  const [event, setEvent] = useState<EventSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<Candidate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<MasterSearchResult[]>([]);
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const hasValidEvent = useMemo(
    () => Number.isFinite(eventId) && eventId > 0,
    [eventId]
  );

  useEffect(() => {
    if (!hasValidEvent) return;

    let isMounted = true;

    const loadEvent = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, date')
        .eq('id', eventId)
        .single();

      if (!error && data && isMounted) {
        setEvent(data);
      }
    };

    loadEvent();

    return () => {
      isMounted = false;
    };
  }, [eventId, hasValidEvent]);

  const loadLeaderboard = useCallback(async () => {
    if (!hasValidEvent) return;
    const { data } = await supabase
      .from('tournament_candidates')
      .select('id, artist, title, cover_image, vote_count')
      .eq('event_id', eventId)
      .order('vote_count', { ascending: false })
      .limit(16);

    setLeaderboard(data || []);
  }, [eventId, hasValidEvent]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const term = searchTerm.trim();
    let isMounted = true;

    const search = async () => {
      const { data } = await supabase
        .from('masters')
        .select('id, title, cover_image_url, artist:artists ( id, name )')
        .ilike('title', `%${term}%`)
        .order('title')
        .limit(8);

      if (isMounted) {
        setSearchResults((data as MasterSearchResult[]) || []);
      }
    };

    const timeout = setTimeout(search, 250);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [searchTerm]);

  const handleSelectMaster = (master: MasterSearchResult) => {
    setArtist(master.artist?.name ?? '');
    setTitle(master.title);
    setCoverImage(master.cover_image_url ?? null);
    setSearchTerm('');
    setSearchResults([]);
  };

  const handleSubmit = async (eventForm: FormEvent<HTMLFormElement>) => {
    eventForm.preventDefault();
    setErrorMessage('');
    setStatusMessage('');

    if (!artist.trim() || !title.trim()) {
      setErrorMessage('Please add both an artist and track title.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/tournament/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          artist: artist.trim(),
          title: title.trim(),
          coverImage,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit nomination.');
      }

      setStatusMessage('Nomination submitted! Thanks for voting.');
      await loadLeaderboard();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to submit nomination.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-black text-white min-h-screen">
      <div className="bg-gradient-to-b from-[#0c0f1a] via-black to-black py-12">
        <Container size="lg">
          <div className="mb-10">
            <p className="text-sm uppercase tracking-[0.35em] text-[#7bdcff] font-semibold">
              Vinyl Games · Bracketology
            </p>
            <h1 className="text-4xl md:text-5xl font-black mt-3">
              Nominate a Track
            </h1>
            {event && (
              <p className="text-lg text-white/70 mt-2">
                {event.title} · {event.date || 'TBA'}
              </p>
            )}
          </div>

          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="bg-[#101321] border border-[#1f2937] rounded-2xl p-6">
              <h2 className="text-2xl font-bold mb-4">Find a track</h2>
              <div className="relative">
                <input
                  value={searchTerm}
                  onChange={(eventInput) => setSearchTerm(eventInput.target.value)}
                  placeholder="Search your collection..."
                  className="w-full rounded-lg bg-black/40 border border-white/10 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#7bdcff]"
                />

                {searchResults.length > 0 && (
                  <div className="absolute z-20 mt-2 w-full rounded-lg border border-white/10 bg-[#05070f] shadow-xl">
                    {searchResults.map((master) => (
                      <button
                        key={master.id}
                        type="button"
                        onClick={() => handleSelectMaster(master)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5"
                      >
                        <div className="h-12 w-12 overflow-hidden rounded bg-white/10">
                          {master.cover_image_url ? (
                            <Image
                              src={master.cover_image_url}
                              alt={master.title}
                              width={48}
                              height={48}
                              className="h-12 w-12 object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="h-12 w-12 bg-white/5" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold">{master.title}</div>
                          <div className="text-sm text-white/60">
                            {master.artist?.name || 'Unknown Artist'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Artist
                  </label>
                  <input
                    value={artist}
                    onChange={(eventInput) => setArtist(eventInput.target.value)}
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#7bdcff]"
                    placeholder="Artist name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Track title
                  </label>
                  <input
                    value={title}
                    onChange={(eventInput) => setTitle(eventInput.target.value)}
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#7bdcff]"
                    placeholder="Track title"
                  />
                </div>

                {coverImage && (
                  <div className="flex items-center gap-4 rounded-lg border border-white/10 bg-black/30 p-3">
                    <Image
                      src={coverImage}
                      alt={`${artist} - ${title}`}
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded object-cover"
                      unoptimized
                    />
                    <div className="text-sm text-white/70">
                      Cover art pulled from your collection.
                    </div>
                  </div>
                )}

                {errorMessage && (
                  <p className="text-red-400 text-sm">{errorMessage}</p>
                )}
                {statusMessage && (
                  <p className="text-green-400 text-sm">{statusMessage}</p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-[#7bdcff] text-black font-bold py-3 transition hover:bg-white disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Nomination'}
                </button>
              </form>
            </section>

            <section className="bg-[#0b0f1d] border border-[#1f2937] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Top Nominations</h2>
                <span className="text-sm text-white/60">
                  {leaderboard.length} tracks
                </span>
              </div>
              <div className="space-y-3">
                {leaderboard.length === 0 && (
                  <p className="text-white/60 text-sm">
                    Be the first to nominate a track for this event.
                  </p>
                )}
                {leaderboard.map((candidate, index) => (
                  <div
                    key={candidate.id}
                    className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/5 p-3"
                  >
                    <div className="text-sm font-semibold text-white/60 w-6">
                      {index + 1}
                    </div>
                    <div className="h-12 w-12 overflow-hidden rounded bg-white/10">
                      {candidate.cover_image ? (
                        <Image
                          src={candidate.cover_image}
                          alt={`${candidate.artist} - ${candidate.title}`}
                          width={48}
                          height={48}
                          className="h-12 w-12 object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="h-12 w-12 bg-white/10" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{candidate.title}</div>
                      <div className="text-sm text-white/60">
                        {candidate.artist}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-[#7bdcff]">
                      {candidate.vote_count} votes
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </Container>
      </div>
    </div>
  );
}
