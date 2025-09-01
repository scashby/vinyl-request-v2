// Fixed Album Detail page - replace the import
// Replace: src/app/browse/album-detail/[id]/page.js

"use client";

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from 'src/lib/supabaseClient';
import AlbumSuggestionBox from 'components/AlbumSuggestionBox'; // Fixed import
import 'styles/internal.css';

function AlbumDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id;
  const eventId = searchParams.get('eventId');

  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requestStatus, setRequestStatus] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const fetchAlbum = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('collection')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        setError(error.message);
      } else {
        setAlbum(data);
      }
    } catch {
      setError('Failed to load album');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchAlbum();
    }
  }, [id, fetchAlbum]);

  const handleAddToQueue = async (side) => {
    if (!eventId) {
      setRequestStatus('No event selected');
      return;
    }

    setSubmittingRequest(true);
    try {
      const { error } = await supabase.from('requests').insert([
        {
          album_id: id,
          artist: album.artist,
          title: album.title,
          side: side,
          event_id: eventId,
          votes: 1,
          status: 'open'
        }
      ]);

      if (error) {
        setRequestStatus(`Error: ${error.message}`);
      } else {
        setRequestStatus(`Added ${album.title} - Side ${side} to queue!`);
      }
    } catch {
      setRequestStatus('Failed to add to queue');
    } finally {
      setSubmittingRequest(false);
    }
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <div style={{ padding: 40, textAlign: 'center' }}>
          <p>Loading album...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper">
        <div style={{ padding: 40, textAlign: 'center', color: 'red' }}>
          <p>Error: {error}</p>
          <AlbumSuggestionBox context="general" />
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="page-wrapper">
        <div style={{ padding: 40, textAlign: 'center' }}>
          <p>Album not found</p>
          <AlbumSuggestionBox context="general" />
        </div>
      </div>
    );
  }

  const imageUrl = album.image_url && album.image_url.toLowerCase() !== 'no' 
    ? album.image_url 
    : '/images/coverplaceholder.png';

  return (
    <div className="page-wrapper">
      <main className="page-body" style={{ padding: 20 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '300px 1fr',
          gap: 40,
          maxWidth: 1200,
          margin: '0 auto'
        }}>
          {/* Album Image */}
          <div>
            <Image
              src={imageUrl}
              alt={`${album.artist} - ${album.title}`}
              width={300}
              height={300}
              style={{ 
                borderRadius: 8, 
                objectFit: 'cover',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
              }}
              unoptimized
            />
          </div>

          {/* Album Info */}
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 8 }}>
              {album.title}
            </h1>
            <h2 style={{ fontSize: 24, color: '#666', marginBottom: 16 }}>
              {album.artist}
            </h2>
            
            <div style={{ marginBottom: 20 }}>
              {album.year && (
                <p><strong>Year:</strong> {album.year}</p>
              )}
              {album.format && (
                <p><strong>Format:</strong> {album.format}</p>
              )}
              {album.folder && (
                <p><strong>Category:</strong> {album.folder}</p>
              )}
              {album.media_condition && (
                <p><strong>Condition:</strong> {album.media_condition}</p>
              )}
            </div>

            {album.notes && (
              <div style={{ marginBottom: 20 }}>
                <h3>Notes:</h3>
                <p style={{ 
                  background: '#f5f5f5', 
                  padding: 12, 
                  borderRadius: 6,
                  fontStyle: 'italic'
                }}>
                  {album.notes}
                </p>
              </div>
            )}

            {/* Queue Actions */}
            {eventId && (
              <div style={{ marginBottom: 30 }}>
                <h3 style={{ marginBottom: 12 }}>Add to Event Queue:</h3>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <button
                    onClick={() => handleAddToQueue('A')}
                    disabled={submittingRequest}
                    style={{
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      padding: '10px 20px',
                      cursor: submittingRequest ? 'not-allowed' : 'pointer',
                      fontSize: 16,
                      fontWeight: 'bold'
                    }}
                  >
                    Side A
                  </button>
                  <button
                    onClick={() => handleAddToQueue('B')}
                    disabled={submittingRequest}
                    style={{
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      padding: '10px 20px',
                      cursor: submittingRequest ? 'not-allowed' : 'pointer',
                      fontSize: 16,
                      fontWeight: 'bold'
                    }}
                  >
                    Side B
                  </button>
                </div>
                
                {requestStatus && (
                  <p style={{ 
                    color: requestStatus.includes('Error') ? 'red' : 'green',
                    fontWeight: 'bold' 
                  }}>
                    {requestStatus}
                  </p>
                )}
              </div>
            )}

            {/* Album Suggestion */}
            <div style={{ marginTop: 40 }}>
              <h3 style={{ marginBottom: 16 }}>Don&apos;t see what you&apos;re looking for?</h3>
              <AlbumSuggestionBox context="general" compact={false} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AlbumDetailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AlbumDetailContent />
    </Suspense>
  );
}