// src/app/admin/staff-picks/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { supabase } from 'src/lib/supabaseClient';
import Image from 'next/image';

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
  is_active: boolean;
  // Joined from collection
  artist?: string;
  title?: string;
  year?: string;
  image_url?: string;
  folder?: string;
}

interface Album {
  id: number;
  artist: string;
  title: string;
  year: string;
  image_url?: string;
  folder: string;
}

export default function AdminStaffPicksPage() {
  const [staffPicks, setStaffPicks] = useState<StaffPick[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPick, setEditingPick] = useState<StaffPick | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    staff_name: '',
    staff_title: '',
    staff_photo_url: '',
    staff_bio: '',
    collection_id: '',
    pick_order: 1,
    reason: '',
    favorite_track: '',
    listening_context: '',
    is_active: true
  });

  useEffect(() => {
    loadStaffPicks();
    loadAlbums();
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
      setStatus(`Error loading staff picks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const loadAlbums = async () => {
    try {
      const { data, error } = await supabase
        .from('collection')
        .select('id, artist, title, year, image_url, folder')
        .order('artist')
        .order('title');

      if (error) throw error;
      setAlbums(data || []);
    } catch (error) {
      console.error('Error loading albums:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      staff_name: '',
      staff_title: '',
      staff_photo_url: '',
      staff_bio: '',
      collection_id: '',
      pick_order: 1,
      reason: '',
      favorite_track: '',
      listening_context: '',
      is_active: true
    });
    setEditingPick(null);
    setShowAddForm(false);
  };

  const handleEdit = (pick: StaffPick) => {
    setFormData({
      staff_name: pick.staff_name,
      staff_title: pick.staff_title || '',
      staff_photo_url: pick.staff_photo_url || '',
      staff_bio: pick.staff_bio || '',
      collection_id: pick.collection_id.toString(),
      pick_order: pick.pick_order,
      reason: pick.reason,
      favorite_track: pick.favorite_track || '',
      listening_context: pick.listening_context || '',
      is_active: pick.is_active
    });
    setEditingPick(pick);
    setShowAddForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        staff_name: formData.staff_name.trim(),
        staff_title: formData.staff_title.trim() || null,
        staff_photo_url: formData.staff_photo_url.trim() || null,
        staff_bio: formData.staff_bio.trim() || null,
        collection_id: parseInt(formData.collection_id),
        pick_order: formData.pick_order,
        reason: formData.reason.trim(),
        favorite_track: formData.favorite_track.trim() || null,
        listening_context: formData.listening_context.trim() || null,
        is_active: formData.is_active,
        updated_at: new Date().toISOString()
      };

      if (editingPick) {
        // Update existing pick
        const { error } = await supabase
          .from('staff_picks')
          .update(payload)
          .eq('id', editingPick.id);

        if (error) throw error;
        setStatus('✅ Staff pick updated successfully!');
      } else {
        // Create new pick
        const { error } = await supabase
          .from('staff_picks')
          .insert([payload]);

        if (error) throw error;
        setStatus('✅ New staff pick added successfully!');
      }

      resetForm();
      await loadStaffPicks();
    } catch (error: unknown) {
      console.error('Error saving staff pick:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('duplicate')) {
        setStatus('❌ Error: This staff member already has a pick at this position or for this album.');
      } else {
        setStatus(`❌ Error saving: ${errorMessage}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pickId: number) => {
    if (!confirm('Are you sure you want to delete this staff pick?')) return;

    try {
      const { error } = await supabase
        .from('staff_picks')
        .delete()
        .eq('id', pickId);

      if (error) throw error;

      setStatus('✅ Staff pick deleted successfully!');
      await loadStaffPicks();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`❌ Error deleting: ${errorMessage}`);
    }
  };

  const toggleActive = async (pick: StaffPick) => {
    try {
      const { error } = await supabase
        .from('staff_picks')
        .update({ is_active: !pick.is_active })
        .eq('id', pick.id);

      if (error) throw error;

      setStatus(`✅ Staff pick ${!pick.is_active ? 'activated' : 'deactivated'}!`);
      await loadStaffPicks();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`❌ Error updating: ${errorMessage}`);
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

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <h1>Loading Staff Picks...</h1>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: '#fff', color: '#222', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 8 }}>
          🎵 Staff Picks Management
        </h1>
        <p style={{ color: '#666', fontSize: 16, marginBottom: 16 }}>
          Manage Devils Purse staff album recommendations and personal stories
        </p>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              background: showAddForm ? '#dc2626' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '12px 24px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {showAddForm ? '❌ Cancel' : '➕ Add Staff Pick'}
          </button>

          <div style={{
            background: '#f0f9ff',
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid #0369a1',
            fontSize: 14,
            color: '#0c4a6e'
          }}>
            📊 {Object.keys(staffGroups).length} staff members • {staffPicks.length} total picks
          </div>
        </div>
      </div>

      {status && (
        <div style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 8,
          background: status.includes('❌') ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${status.includes('❌') ? '#fca5a5' : '#22c55e'}`,
          color: status.includes('❌') ? '#dc2626' : '#059669',
          fontWeight: 'bold'
        }}>
          {status}
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 24,
          marginBottom: 32
        }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: 20, fontWeight: 'bold' }}>
            {editingPick ? '✏️ Edit Staff Pick' : '➕ Add New Staff Pick'}
          </h3>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>
                  Staff Name *
                </label>
                <input
                  type="text"
                  value={formData.staff_name}
                  onChange={e => setFormData(prev => ({ ...prev, staff_name: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14
                  }}
                  placeholder="e.g., Mike Thompson"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>
                  Job Title
                </label>
                <input
                  type="text"
                  value={formData.staff_title}
                  onChange={e => setFormData(prev => ({ ...prev, staff_title: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14
                  }}
                  placeholder="e.g., Head Bartender, Chef, Manager"
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>
                Staff Bio
              </label>
              <textarea
                value={formData.staff_bio}
                onChange={e => setFormData(prev => ({ ...prev, staff_bio: e.target.value }))}
                rows={2}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  resize: 'vertical'
                }}
                placeholder="Short bio about the staff member..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>
                  Album *
                </label>
                <select
                  value={formData.collection_id}
                  onChange={e => setFormData(prev => ({ ...prev, collection_id: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14
                  }}
                >
                  <option value="">Select an album...</option>
                  {albums.map(album => (
                    <option key={album.id} value={album.id}>
                      {album.artist} - {album.title} ({album.year})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>
                  Pick Order (1-5) *
                </label>
                <select
                  value={formData.pick_order}
                  onChange={e => setFormData(prev => ({ ...prev, pick_order: parseInt(e.target.value) }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14
                  }}
                >
                  {[1, 2, 3, 4, 5].map(num => (
                    <option key={num} value={num}>#{num}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>
                Why They Chose This Album *
              </label>
              <textarea
                value={formData.reason}
                onChange={e => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                required
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  resize: 'vertical'
                }}
                placeholder="Personal explanation for why they selected this album..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>
                  Favorite Track
                </label>
                <input
                  type="text"
                  value={formData.favorite_track}
                  onChange={e => setFormData(prev => ({ ...prev, favorite_track: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14
                  }}
                  placeholder="e.g., Blue in Green"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontWeight: 'bold' }}>Active:</label>
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  style={{ transform: 'scale(1.2)' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>
                Listening Context
              </label>
              <textarea
                value={formData.listening_context}
                onChange={e => setFormData(prev => ({ ...prev, listening_context: e.target.value }))}
                rows={2}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  resize: 'vertical'
                }}
                placeholder="When/where they like to listen to this album..."
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  background: saving ? '#9ca3af' : '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 20px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {saving ? '⏳ Saving...' : (editingPick ? '💾 Update Pick' : '➕ Add Pick')}
              </button>

              <button
                type="button"
                onClick={resetForm}
                style={{
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 20px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Staff Picks Display */}
      <div style={{ display: 'grid', gap: 32 }}>
        {Object.entries(staffGroups).map(([staffName, picks]) => {
          const staffInfo = picks[0]; // Get staff info from first pick
          return (
            <div key={staffName} style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              padding: 24,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              {/* Staff Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginBottom: 20,
                paddingBottom: 16,
                borderBottom: '1px solid #f3f4f6'
              }}>
                {staffInfo.staff_photo_url ? (
                  <Image
                    src={staffInfo.staff_photo_url}
                    alt={staffName}
                    width={60}
                    height={60}
                    style={{ borderRadius: '50%', objectFit: 'cover' }}
                    unoptimized
                  />
                ) : (
                  <div style={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: '#e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24
                  }}>
                    👤
                  </div>
                )}

                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 'bold', color: '#1f2937' }}>
                    {staffName}
                  </h3>
                  {staffInfo.staff_title && (
                    <div style={{ fontSize: 14, color: '#2563eb', fontWeight: 600, marginBottom: 4 }}>
                      {staffInfo.staff_title}
                    </div>
                  )}
                  {staffInfo.staff_bio && (
                    <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.4 }}>
                      {staffInfo.staff_bio}
                    </div>
                  )}
                </div>

                <div style={{ fontSize: 12, color: '#9ca3af' }}>
                  {picks.length} pick{picks.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Staff's Picks */}
              <div style={{ display: 'grid', gap: 16 }}>
                {picks.sort((a, b) => a.pick_order - b.pick_order).map(pick => (
                  <div key={pick.id} style={{
                    display: 'flex',
                    gap: 16,
                    padding: 16,
                    background: pick.is_active ? '#f9fafb' : '#f3f4f6',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    opacity: pick.is_active ? 1 : 0.6
                  }}>
                    <div style={{
                      background: '#3b82f6',
                      color: 'white',
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 'bold',
                      flexShrink: 0
                    }}>
                      {pick.pick_order}
                    </div>

                    {pick.image_url && (
                      <Image
                        src={pick.image_url}
                        alt={`${pick.artist} - ${pick.title}`}
                        width={60}
                        height={60}
                        style={{ borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                        unoptimized
                      />
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>
                        {pick.artist} - {pick.title}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                        {pick.year} • {pick.folder}
                        {pick.favorite_track && ` • Favorite: &ldquo;${pick.favorite_track}&rdquo;`}
                      </div>
                      <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, marginBottom: 8 }}>
                        {pick.reason}
                      </div>
                      {pick.listening_context && (
                        <div style={{ fontSize: 13, color: '#6b7280', fontStyle: 'italic' }}>
                          🎧 {pick.listening_context}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                      <button
                        onClick={() => handleEdit(pick)}
                        style={{
                          background: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 8px',
                          fontSize: 12,
                          cursor: 'pointer'
                        }}
                      >
                        ✏️ Edit
                      </button>

                      <button
                        onClick={() => toggleActive(pick)}
                        style={{
                          background: pick.is_active ? '#6b7280' : '#059669',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 8px',
                          fontSize: 12,
                          cursor: 'pointer'
                        }}
                      >
                        {pick.is_active ? '👁️ Hide' : '👁️ Show'}
                      </button>

                      <button
                        onClick={() => handleDelete(pick.id)}
                        style={{
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 8px',
                          fontSize: 12,
                          cursor: 'pointer'
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {Object.keys(staffGroups).length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: 60,
            background: '#f9fafb',
            borderRadius: 12,
            border: '2px dashed #d1d5db'
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎵</div>
            <h3 style={{ fontSize: 20, marginBottom: 8, color: '#374151' }}>
              No Staff Picks Yet
            </h3>
            <p style={{ color: '#6b7280', marginBottom: 20 }}>
              Add the first staff pick to get started with your team&apos;s music recommendations.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              style={{
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ➕ Add First Staff Pick
            </button>
          </div>
        )}
      </div>
    </div>
  );
}