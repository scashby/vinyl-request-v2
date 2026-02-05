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
  inventory_id: number;
  pick_order: number;
  reason: string;
  favorite_track?: string;
  listening_context?: string;
  // Joined from inventory -> release -> master
  artist?: string;
  title?: string;
  year?: string | null;
  image_url?: string;
  location?: string | null;
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
          inventory:inventory_id (
            id,
            location,
            release:releases (
              release_year,
              master:masters (
                title,
                original_release_year,
                cover_image_url,
                artist:artists ( name )
              )
            )
          )
        `)
        .eq('is_active', true)
        .order('staff_name')
        .order('pick_order');

      if (error) throw error;

      // Flatten the data structure
      const picks = data?.map(pick => ({
        ...pick,
        artist: pick.inventory?.release?.master?.artist?.name,
        title: pick.inventory?.release?.master?.title,
        year: pick.inventory?.release?.release_year
          ? String(pick.inventory.release.release_year)
          : pick.inventory?.release?.master?.original_release_year
            ? String(pick.inventory.release.master.original_release_year)
            : null,
        image_url: pick.inventory?.release?.master?.cover_image_url,
        location: pick.inventory?.location ?? null
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
      <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-700 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-2xl mb-4">🎵 Loading Staff Picks...</div>
          <div className="text-base opacity-80">Discovering our team&apos;s favorite albums</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-700 p-5">
      <div className="max-w-6xl mx-auto text-white">
        {/* Header */}
        <div className="text-center mb-10 bg-white/10 rounded-2xl p-10 backdrop-blur-md">
          <h1 className="text-5xl font-bold mb-4">
            🎵 Staff Picks
          </h1>
          <p className="text-xl mb-5 opacity-90">
            Discover the albums that inspire our Devils Purse team
          </p>
          <p className="text-base opacity-70">
            Each staff member shares their top 5 albums with personal stories and listening recommendations
          </p>
        </div>

        {/* Staff Navigation */}
        {staffNames.length > 1 && (
          <div className="bg-white/10 rounded-2xl p-6 mb-10 backdrop-blur-md">
            <h3 className="text-lg font-bold mb-4">
              Meet Our Team
            </h3>
            <div className="flex gap-3 flex-wrap justify-center">
              <button
                onClick={() => setSelectedStaff(null)}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                  selectedStaff === null ? 'bg-blue-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                All Staff
              </button>
              {staffNames.map(staffName => (
                <button
                  key={staffName}
                  onClick={() => setSelectedStaff(staffName)}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                    selectedStaff === staffName ? 'bg-blue-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  {staffName}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Staff Picks Display */}
        <div className="grid gap-10">
          {Object.entries(staffGroups)
            .filter(([staffName]) => selectedStaff === null || selectedStaff === staffName)
            .map(([staffName, picks]) => {
              const staffInfo = picks[0];
              return (
                <div key={staffName} className="bg-white/10 rounded-2xl p-8 backdrop-blur-md border border-white/20">
                  {/* Staff Header */}
                  <div className="flex flex-col md:flex-row items-center gap-5 mb-8 pb-5 border-b border-white/20 text-center md:text-left">
                    {staffInfo.staff_photo_url ? (
                      <Image
                        src={staffInfo.staff_photo_url}
                        alt={staffName}
                        width={80}
                        height={80}
                        className="rounded-full object-cover border-[3px] border-white/30 shrink-0"
                        unoptimized
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl border-[3px] border-white/30 shrink-0">
                        👤
                      </div>
                    )}

                    <div>
                      <h2 className="text-3xl font-bold m-0">
                        {staffName}
                      </h2>
                      {staffInfo.staff_title && (
                        <div className="text-base font-semibold text-amber-400 mt-1 mb-2">
                          {staffInfo.staff_title}
                        </div>
                      )}
                      {staffInfo.staff_bio && (
                        <div className="text-base opacity-90 leading-relaxed max-w-xl">
                          {staffInfo.staff_bio}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Staff's Top 5 Albums */}
                  <div className="grid gap-6">
                    <h3 className="text-2xl font-bold text-center text-amber-400 m-0">
                      🏆 Top 5 Albums
                    </h3>

                    {picks.sort((a, b) => a.pick_order - b.pick_order).map(pick => (
                      <div key={pick.id} className="flex flex-col md:flex-row gap-5 p-5 bg-white/10 rounded-xl backdrop-blur-md border border-white/20 transition-all duration-300 hover:bg-white/20 group">
                        {/* Rank Badge */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0 shadow-lg ${
                          pick.pick_order <= 3 ? 'bg-gradient-to-br from-amber-400 to-amber-500' : 'bg-gradient-to-br from-gray-500 to-slate-600'
                        }`}>
                          {pick.pick_order}
                        </div>

                        {/* Album Cover */}
                        <Link
                          href={`/browse/album-detail/${pick.inventory_id}`}
                          className="shrink-0 group-hover:scale-105 transition-transform duration-200 ease-out mx-auto md:mx-0"
                        >
                          {pick.image_url ? (
                            <Image
                              src={pick.image_url}
                              alt={`${pick.artist} - ${pick.title}`}
                              width={100}
                              height={100}
                              className="rounded-lg object-cover border-2 border-white/30"
                              unoptimized
                            />
                          ) : (
                            <div className="w-[100px] h-[100px] rounded-lg bg-white/20 flex items-center justify-center text-xs text-gray-400 border-2 border-white/30">
                              No Image
                            </div>
                          )}
                        </Link>

                        {/* Album Info & Story */}
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/browse/album-detail/${pick.inventory_id}`}
                            className="no-underline text-inherit block"
                          >
                            <div className="text-xl font-bold mb-1.5 transition-colors duration-200 hover:text-amber-400 text-center md:text-left">
                              {pick.artist} - {pick.title}
                            </div>
                          </Link>
                          
                          <div className="text-sm opacity-80 mb-3 flex gap-4 flex-wrap justify-center md:justify-start">
                            <span>🗓️ {pick.year}</span>
                            <span>💿 {pick.location}</span>
                            {pick.favorite_track && (
                              <span>⭐ Favorite: &ldquo;{pick.favorite_track}&rdquo;</span>
                            )}
                          </div>

                          <div className="text-base leading-relaxed mb-3 p-4 bg-black/20 rounded-lg border border-white/10">
                            <div className="text-sm opacity-70 mb-1.5 font-semibold">
                              Why {staffName} chose this:
                            </div>
                            &ldquo;{pick.reason}&rdquo;
                          </div>

                          {pick.listening_context && (
                            <div className="text-sm opacity-80 italic p-3 bg-amber-400/10 rounded-md border border-amber-400/20">
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
          <div className="text-center p-20 bg-white/10 rounded-2xl backdrop-blur-md">
            <div className="text-6xl mb-5">🎵</div>
            <h3 className="text-2xl mb-3">
              Staff Picks Coming Soon!
            </h3>
            <p className="text-base opacity-80">
              Our team is currently selecting their favorite albums to share with you.
              Check back soon for personal recommendations and stories behind the music.
            </p>
          </div>
        )}

        {/* Call to Action */}
        <div className="bg-white/10 rounded-2xl p-8 mt-10 text-center backdrop-blur-md">
          <h3 className="text-2xl font-bold mb-4">
            Explore More Music
          </h3>
          <p className="text-base opacity-90 mb-6">
            Discover more albums from our collection and see what the community loves
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/browse/browse-albums"
              className="bg-gradient-to-br from-blue-500 to-blue-700 text-white px-6 py-3 rounded-lg font-semibold text-base hover:shadow-lg transition-all duration-200"
            >
              📚 Browse Full Collection
            </Link>
            <Link
              href="/inner-circle-voting"
              className="bg-gradient-to-br from-violet-600 to-violet-800 text-white px-6 py-3 rounded-lg font-semibold text-base hover:shadow-lg transition-all duration-200"
            >
              💎 Inner Circle Voting
            </Link>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-10 p-5 text-sm opacity-60">
          Staff picks are curated by the Devils Purse team • Updated regularly with new recommendations
        </div>
      </div>
    </div>
  );
}
// AUDIT: inspected, no changes.
