// src/app/staff-picks/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { supabase } from 'src/lib/supabaseClient';
import Image from 'next/image';
import Link from 'next/link';

interface StaffPick {
  id: number;
  staff_name: string;
  staff_title: string;
  staff_photo_url?: string;
  staff_bio?: string;
  collection_id: number;
  pick_order: number;
  reason: string;
  favorite_track?: string;
  listening_context?: string;
  // Joined from collection
  artist?: string;
  title?: string;
  year?: string;
  image_url?: string;
  folder?: string;
}

export default function StaffPicksPage() {
  const [staffPicks, setStaffPicks] = useState<StaffPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);

  useEffect(() => {
    loadStaffPicks();
  }, []);

  const loadStaffPicks = async () => {
    try {
      const { data, error } = await supabase
        .from('staff_picks')
        .select(`
          *,
          collection:collection_id (
            artist,
            title,
            year,
            image_url,
            folder
          )
        `)
        .eq('is_active', true)
        .order('staff_name')
        .order('pick_order');

      if (error) throw error;

      // Flatten the data structure
      const picks = data?.map(pick => ({
        ...pick,
        artist: pick.collection?.artist,
        title: pick.collection?.title,
        year: pick.collection?.year,
        image_url: pick.collection?.image_url,
        folder: pick.collection?.folder
      })) || [];

      setStaffPicks(picks);
    } catch (error) {
      console.error('Error loading staff picks:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group picks by staff member
  const staffGroups = staffPicks.reduce((acc, pick) => {
    if (!acc[pick.staff_name]) {
      acc[pick.staff_name] = [];
    }
    acc[pick.staff_name].push(pick);
    return acc;
  }, {} as Record<string, StaffPick[]>);

  const staffNames = Object.keys(staffGroups);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 16 }}>🎵 Loading Staff Picks...</div>
          <div style={{ fontSize: 16, opacity: 0.8 }}>Discovering our team&apos;s favorite albums</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
      padding: 20
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', color: 'white' }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: 40,
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          padding: 40,
          backdropFilter: 'blur(10px)'
        }}>
          <h1 style={{ fontSize: 48, margin: '0 0 16px 0', fontWeight: 'bold' }}>
            🎵 Staff Picks
          </h1>
          <p style={{ fontSize: 20, margin: '0 0 20px 0', opacity: 0.9 }}>
            Discover the albums that inspire our Devils Purse team
          </p>
          <p style={{ fontSize: 16, opacity: 0.7 }}>
            Each staff member shares their top 5 albums with personal stories and listening recommendations
          </p>
        </div>

        {/* Staff Navigation */}
        {staffNames.length > 1 && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            padding: 24,
            marginBottom: 40,
            backdropFilter: 'blur(10px)'
          }}>
            <h3 style={{ fontSize: 18, margin: '0 0 16px 0', fontWeight: 'bold' }}>
              Meet Our Team
            </h3>
            <div style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => setSelectedStaff(null)}
                style={{
                  background: selectedStaff === null ? '#3b82f6' : 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  transition: 'all 0.2s ease'
                }}
              >
                All Staff
              </button>
              {staffNames.map(staffName => (
                <button
                  key={staffName}
                  onClick={() => setSelectedStaff(staffName)}
                  style={{
                    background: selectedStaff === staffName ? '#3b82f6' : 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {staffName}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Staff Picks Display */}
        <div style={{ display: 'grid', gap: 40 }}>
          {Object.entries(staffGroups)
            .filter(([staffName]) => selectedStaff === null || selectedStaff === staffName)
            .map(([staffName, picks]) => {
              const staffInfo = picks[0];
              return (
                <div key={staffName} style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: 16,
                  padding: 32,
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                  {/* Staff Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 20,
                    marginBottom: 32,
                    paddingBottom: 20,
                    borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
                  }}>
                    {staffInfo.staff_photo_url ? (
                      <Image
                        src={staffInfo.staff_photo_url}
                        alt={staffName}
                        width={80}
                        height={80}
                        style={{
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '3px solid rgba(255, 255, 255, 0.3)'
                        }}
                        unoptimized
                      />
                    ) : (
                      <div style={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 32,
                        border: '3px solid rgba(255, 255, 255, 0.3)'
                      }}>
                        👤
                      </div>
                    )}

                    <div>
                      <h2 style={{ margin: 0, fontSize: 28, fontWeight: 'bold' }}>
                        {staffName}
                      </h2>
                      {staffInfo.staff_title && (
                        <div style={{
                          fontSize: 16,
                          color: '#fbbf24',
                          fontWeight: 600,
                          marginBottom: 8,
                          marginTop: 4
                        }}>
                          {staffInfo.staff_title}
                        </div>
                      )}
                      {staffInfo.staff_bio && (
                        <div style={{
                          fontSize: 16,
                          opacity: 0.9,
                          lineHeight: 1.5,
                          maxWidth: 600
                        }}>
                          {staffInfo.staff_bio}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Staff's Top 5 Albums */}
                  <div style={{ display: 'grid', gap: 24 }}>
                    <h3 style={{
                      fontSize: 22,
                      margin: 0,
                      fontWeight: 'bold',
                      textAlign: 'center',
                      color: '#fbbf24'
                    }}>
                      🏆 Top 5 Albums
                    </h3>

                    {picks.sort((a, b) => a.pick_order - b.pick_order).map(pick => (
                      <div key={pick.id} style={{
                        display: 'flex',
                        gap: 20,
                        padding: 20,
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: 12,
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        transition: 'all 0.3s ease'
                      }}>
                        {/* Rank Badge */}
                        <div style={{
                          background: pick.pick_order <= 3 ? 
                            'linear-gradient(135deg, #fbbf24, #f59e0b)' :
                            'linear-gradient(135deg, #6b7280, #4b5563)',
                          color: 'white',
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 18,
                          fontWeight: 'bold',
                          flexShrink: 0,
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                        }}>
                          {pick.pick_order}
                        </div>

                        {/* Album Cover */}
                        <Link
                          href={`/browse/album/${pick.collection_id}`}
                          style={{ textDecoration: 'none', flexShrink: 0 }}
                        >
                          {pick.image_url ? (
                            <Image
                              src={pick.image_url}
                              alt={`${pick.artist} - ${pick.title}`}
                              width={100}
                              height={100}
                              style={{
                                borderRadius: 8,
                                objectFit: 'cover',
                                cursor: 'pointer',
                                transition: 'transform 0.2s ease',
                                border: '2px solid rgba(255, 255, 255, 0.3)'
                              }}
                              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                              unoptimized
                            />
                          ) : (
                            <div style={{
                              width: 100,
                              height: 100,
                              borderRadius: 8,
                              background: 'rgba(255, 255, 255, 0.2)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              color: '#9ca3af',
                              border: '2px solid rgba(255, 255, 255, 0.3)'
                            }}>
                              No Image
                            </div>
                          )}
                        </Link>

                        {/* Album Info & Story */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Link
                            href={`/browse/album/${pick.collection_id}`}
                            style={{ textDecoration: 'none', color: 'inherit' }}
                          >
                            <div style={{
                              fontSize: 20,
                              fontWeight: 'bold',
                              marginBottom: 6,
                              cursor: 'pointer',
                              transition: 'color 0.2s ease'
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = '#fbbf24'}
                            onMouseLeave={e => e.currentTarget.style.color = 'white'}
                            >
                              {pick.artist} - {pick.title}
                            </div>
                          </Link>
                          
                          <div style={{
                            fontSize: 14,
                            opacity: 0.8,
                            marginBottom: 12,
                            display: 'flex',
                            gap: 16,
                            flexWrap: 'wrap'
                          }}>
                            <span>🗓️ {pick.year}</span>
                            <span>💿 {pick.folder}</span>
                            {pick.favorite_track && (
                              <span>⭐ Favorite: &ldquo;{pick.favorite_track}&rdquo;</span>
                            )}
                          </div>

                          <div style={{
                            fontSize: 16,
                            lineHeight: 1.6,
                            marginBottom: 12,
                            padding: 16,
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: 8,
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                          }}>
                            <div style={{
                              fontSize: 14,
                              opacity: 0.7,
                              marginBottom: 6,
                              fontWeight: 600
                            }}>
                              Why {staffName} chose this:
                            </div>
                            &ldquo;{pick.reason}&rdquo;
                          </div>

                          {pick.listening_context && (
                            <div style={{
                              fontSize: 14,
                              opacity: 0.8,
                              fontStyle: 'italic',
                              padding: 12,
                              background: 'rgba(251, 191, 36, 0.1)',
                              borderRadius: 6,
                              border: '1px solid rgba(251, 191, 36, 0.2)'
                            }}>
                              🎧 <strong>Best enjoyed:</strong> {pick.listening_context}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>

        {/* No staff picks message */}
        {staffNames.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: 80,
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>🎵</div>
            <h3 style={{ fontSize: 24, marginBottom: 12 }}>
              Staff Picks Coming Soon!
            </h3>
            <p style={{ fontSize: 16, opacity: 0.8 }}>
              Our team is currently selecting their favorite albums to share with you.
              Check back soon for personal recommendations and stories behind the music.
            </p>
          </div>
        )}

        {/* Call to Action */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          padding: 32,
          marginTop: 40,
          textAlign: 'center',
          backdropFilter: 'blur(10px)'
        }}>
          <h3 style={{ fontSize: 24, margin: '0 0 16px 0', fontWeight: 'bold' }}>
            Explore More Music
          </h3>
          <p style={{ fontSize: 16, margin: '0 0 24px 0', opacity: 0.9 }}>
            Discover more albums from our collection and see what the community loves
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/browse/browse-albums"
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                color: 'white',
                padding: '12px 24px',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 16,
                transition: 'all 0.2s ease'
              }}
            >
              📚 Browse Full Collection
            </Link>
            <Link
              href="/inner-circle-voting"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                color: 'white',
                padding: '12px 24px',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 16,
                transition: 'all 0.2s ease'
              }}
            >
              💎 Inner Circle Voting
            </Link>
          </div>
        </div>

        {/* Footer Note */}
        <div style={{
          textAlign: 'center',
          marginTop: 40,
          padding: 20,
          fontSize: 14,
          opacity: 0.6
        }}>
          Staff picks are curated by the Devils Purse team • Updated regularly with new recommendations
        </div>
      </div>
    </div>
  );
}