// src/app/admin/staff-picks/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { supabase } from 'src/lib/supabaseClient';
import Image from 'next/image';
import Link from 'next/link';

interface StaffSubmission {
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
  created_at: string;
  // Joined from collection
  artist?: string;
  title?: string;
  year?: string;
  image_url?: string;
  location?: string;
}

interface StaffSummary {
  staffName: string;
  totalPicks: number;
  activePicks: number;
  submittedAt: string;
  isApproved: boolean;
}

interface LocationSettings {
  [location: string]: boolean;
}

export default function AdminStaffPicksPage() {
  const [submissions, setSubmissions] = useState<StaffSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'summary' | 'detailed' | 'settings'>('summary');
  const [locationSettings, setLocationSettings] = useState<LocationSettings>({
    'Vinyl': true,
    'Cassettes': true,
    'CDs': false,
    '45s': false,
    'Digital': false,
    'Test Pressings': false,
    'Bootlegs': false
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    loadStaffSubmissions();
    loadLocationSettings();
  }, []);

  const loadStaffSubmissions = async () => {
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
            location
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
        location: pick.collection?.location
      })) || [];

      setSubmissions(picks);
    } catch (error) {
      console.error('Error loading staff submissions:', error);
      setStatus(`Error loading submissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadLocationSettings = async () => {
    try {
      // Try to load from a settings table, or use defaults
      const { data } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'staff_picks_folders')
        .single();

      if (data?.value) {
        setLocationSettings(JSON.parse(data.value));
      }
    } catch {
      // If no settings exist, use defaults
      console.log('Using default location settings');
    }
  };

  const saveLocationSettings = async () => {
    setSavingSettings(true);
    try {
      // Save to admin_settings table (create if doesn't exist)
      const { error } = await supabase
        .from('admin_settings')
        .upsert({
          key: 'staff_picks_folders',
          value: JSON.stringify(locationSettings),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setStatus('✅ Location settings saved! These will be used for future staff picks selections.');
      setTimeout(() => setStatus(''), 5000);
    } catch (error) {
      console.error('Error saving location settings:', error);
      setStatus(`❌ Error saving settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const togglePickActive = async (pickId: number, currentState: boolean) => {
    setUpdating(pickId);
    try {
      const { error } = await supabase
        .from('staff_picks')
        .update({ is_active: !currentState })
        .eq('id', pickId);

      if (error) throw error;

      // Update local state
      setSubmissions(prev => prev.map(submission => 
        submission.id === pickId 
          ? { ...submission, is_active: !currentState }
          : submission
      ));

      setStatus(`${!currentState ? 'Approved' : 'Hidden'} staff pick successfully!`);
      setTimeout(() => setStatus(''), 3000);

    } catch (error: unknown) {
      console.error('Error updating pick status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Error updating pick: ${errorMessage}`);
    } finally {
      setUpdating(null);
    }
  };

  const deleteSubmission = async (pickId: number) => {
    if (!confirm('Are you sure you want to delete this staff pick? This action cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('staff_picks')
        .delete()
        .eq('id', pickId);

      if (error) throw error;

      setSubmissions(prev => prev.filter(s => s.id !== pickId));
      setStatus('✅ Staff pick deleted successfully!');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`❌ Error deleting: ${errorMessage}`);
    }
  };

  const approveAllFromStaff = async (staffName: string) => {
    if (!confirm(`Approve all picks from ${staffName}?`)) return;

    try {
      const { error } = await supabase
        .from('staff_picks')
        .update({ is_active: true })
        .eq('staff_name', staffName);

      if (error) throw error;

      setSubmissions(prev => prev.map(submission => 
        submission.staff_name === staffName 
          ? { ...submission, is_active: true }
          : submission
      ));

      setStatus(`✅ Approved all picks from ${staffName}!`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`❌ Error approving picks: ${errorMessage}`);
    }
  };

  // Group submissions by staff member
  const staffGroups = submissions.reduce((acc, submission) => {
    if (!acc[submission.staff_name]) {
      acc[submission.staff_name] = [];
    }
    acc[submission.staff_name].push(submission);
    return acc;
  }, {} as Record<string, StaffSubmission[]>);

  // Generate staff summary
  const staffSummary: StaffSummary[] = Object.entries(staffGroups).map(([staffName, picks]) => ({
    staffName,
    totalPicks: picks.length,
    activePicks: picks.filter(p => p.is_active).length,
    submittedAt: picks[0]?.created_at || '',
    isApproved: picks.every(p => p.is_active)
  }));

  const enabledLocations = Object.entries(locationSettings)
    .filter(([, enabled]) => enabled)
    .map(([location]) => location);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <h1>Loading Staff Submissions...</h1>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: '#fff', color: '#222', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 8 }}>
          📋 Staff Picks Management
        </h1>
        <p style={{ color: '#666', fontSize: 16, marginBottom: 16 }}>
          Review and manage staff submissions from the voting interface
        </p>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/staff-voting"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#3b82f6',
              color: 'white',
              padding: '10px 20px',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 'bold',
              fontSize: 14
            }}
          >
            🗳️ Staff Voting Page
          </Link>

          <Link
            href="/staff-picks"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#059669',
              color: 'white',
              padding: '10px 20px',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 'bold',
              fontSize: 14
            }}
          >
            👀 Public Staff Picks
          </Link>

          <div style={{
            display: 'flex',
            gap: 8,
            background: '#f3f4f6',
            borderRadius: 8,
            padding: 4
          }}>
            <button
              onClick={() => setViewMode('summary')}
              style={{
                background: viewMode === 'summary' ? '#2563eb' : 'transparent',
                color: viewMode === 'summary' ? 'white' : '#6b7280',
                border: 'none',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              📊 Summary
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              style={{
                background: viewMode === 'detailed' ? '#2563eb' : 'transparent',
                color: viewMode === 'detailed' ? 'white' : '#6b7280',
                border: 'none',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              📝 Detailed
            </button>
            <button
              onClick={() => setViewMode('settings')}
              style={{
                background: viewMode === 'settings' ? '#2563eb' : 'transparent',
                color: viewMode === 'settings' ? 'white' : '#6b7280',
                border: 'none',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              ⚙️ Settings
            </button>
          </div>

          <div style={{
            background: '#f0f9ff',
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid #0369a1',
            fontSize: 14,
            color: '#0c4a6e'
          }}>
            📊 {Object.keys(staffGroups).length} staff • {submissions.length} total picks • {submissions.filter(s => s.is_active).length} approved
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

      {/* Settings View */}
      {viewMode === 'settings' && (
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: 32
        }}>
          <div style={{
            background: '#f8fafc',
            padding: 20,
            borderBottom: '1px solid #e5e7eb'
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 20, fontWeight: 'bold' }}>
              ⚙️ Collection Location Settings
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
              Choose which locations staff can select from when making their picks. 
              Currently enabled: <strong>{enabledLocations.join(', ')}</strong>
            </p>
          </div>

          <div style={{ padding: 24 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
              marginBottom: 24
            }}>
              {Object.entries(locationSettings).map(([location, enabled]) => (
                <label key={location} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 16,
                  background: enabled ? '#f0fdf4' : '#f9fafb',
                  border: `2px solid ${enabled ? '#22c55e' : '#e5e7eb'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={e => setLocationSettings(prev => ({
                      ...prev,
                      [location]: e.target.checked
                    }))}
                    style={{
                      transform: 'scale(1.2)',
                      marginRight: 4
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: 16 }}>
                      {location}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      {enabled ? 'Available for staff picks' : 'Hidden from staff picks'}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div style={{
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: 8,
              padding: 16,
              marginBottom: 20
            }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 'bold', color: '#92400e' }}>
                💡 How This Works:
              </h4>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: '#92400e', lineHeight: 1.5 }}>
                <li>Staff will only see albums from enabled locations when making their picks</li>
                <li>Default is Vinyl + Cassettes (most popular physical formats)</li>
                <li>Enable CDs, 45s, or other locations as needed for your collection</li>
                <li>Changes only affect new staff pick submissions</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                onClick={saveLocationSettings}
                disabled={savingSettings}
                style={{
                  background: savingSettings ? '#9ca3af' : '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontSize: 16,
                  fontWeight: 'bold',
                  cursor: savingSettings ? 'not-allowed' : 'pointer'
                }}
              >
                {savingSettings ? '⏳ Saving...' : '💾 Save Location Settings'}
              </button>

              <div style={{ fontSize: 14, color: '#6b7280' }}>
                {enabledLocations.length} of {Object.keys(locationSettings).length} locations enabled
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary View */}
      {viewMode === 'summary' && (
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: 32
        }}>
          <div style={{
            background: '#f8fafc',
            padding: 16,
            borderBottom: '1px solid #e5e7eb'
          }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 'bold' }}>
              📋 Staff Submission Summary
            </h3>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', fontSize: 14 }}>Staff Member</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold', fontSize: 14 }}>Picks</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold', fontSize: 14 }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold', fontSize: 14 }}>Submitted</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold', fontSize: 14 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staffSummary.map((staff) => (
                <tr key={staff.staffName} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: 16 }}>
                      {staff.staffName}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      {staffGroups[staff.staffName][0]?.staff_title || 'No title provided'}
                    </div>
                  </td>
                  
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{
                      background: '#dbeafe',
                      color: '#1d4ed8',
                      padding: '4px 8px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 'bold',
                      display: 'inline-block'
                    }}>
                      {staff.activePicks} / {staff.totalPicks}
                    </div>
                  </td>
                  
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{
                      background: staff.isApproved ? '#dcfce7' : '#fef3c7',
                      color: staff.isApproved ? '#166534' : '#92400e',
                      padding: '4px 8px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 'bold',
                      display: 'inline-block'
                    }}>
                      {staff.isApproved ? '✅ Approved' : '⏳ Pending'}
                    </div>
                  </td>
                  
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: '#6b7280' }}>
                    {new Date(staff.submittedAt).toLocaleDateString()}
                  </td>
                  
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button
                        onClick={() => setSelectedStaff(staff.staffName)}
                        style={{
                          background: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 8px',
                          fontSize: 12,
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        👁️ View
                      </button>
                      
                      {!staff.isApproved && (
                        <button
                          onClick={() => approveAllFromStaff(staff.staffName)}
                          style={{
                            background: '#059669',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            padding: '4px 8px',
                            fontSize: 12,
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          ✅ Approve All
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detailed View */}
      {viewMode === 'detailed' && (
        <div>
          {/* Staff Filter */}
          {Object.keys(staffGroups).length > 1 && (
            <div style={{
              background: '#f8fafc',
              padding: 16,
              borderRadius: 8,
              marginBottom: 24,
              border: '1px solid #e2e8f0'
            }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 'bold' }}>
                Filter by Staff Member:
              </h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setSelectedStaff(null)}
                  style={{
                    background: selectedStaff === null ? '#2563eb' : '#e5e7eb',
                    color: selectedStaff === null ? 'white' : '#374151',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  All Staff
                </button>
                {Object.keys(staffGroups).map(staffName => (
                  <button
                    key={staffName}
                    onClick={() => setSelectedStaff(staffName)}
                    style={{
                      background: selectedStaff === staffName ? '#2563eb' : '#e5e7eb',
                      color: selectedStaff === staffName ? 'white' : '#374151',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    {staffName} ({staffGroups[staffName].length})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Submissions */}
          <div style={{ display: 'grid', gap: 32 }}>
            {Object.entries(staffGroups)
              .filter(([staffName]) => selectedStaff === null || selectedStaff === staffName)
              .map(([staffName, picks]) => {
                const staffInfo = picks[0];
                const approvedCount = picks.filter(p => p.is_active).length;
                
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
                      justifyContent: 'space-between',
                      marginBottom: 20,
                      paddingBottom: 16,
                      borderBottom: '1px solid #f3f4f6'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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

                        <div>
                          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 'bold', color: '#1f2937' }}>
                            {staffName}
                          </h3>
                          {staffInfo.staff_title && (
                            <div style={{ fontSize: 14, color: '#2563eb', fontWeight: 600, marginBottom: 4 }}>
                              {staffInfo.staff_title}
                            </div>
                          )}
                          {staffInfo.staff_bio && (
                            <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.4, maxWidth: 400 }}>
                              {staffInfo.staff_bio}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          background: approvedCount === picks.length ? '#dcfce7' : '#fef3c7',
                          color: approvedCount === picks.length ? '#166534' : '#92400e',
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 'bold',
                          marginBottom: 8
                        }}>
                          {approvedCount} / {picks.length} Approved
                        </div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>
                          Submitted: {new Date(staffInfo.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Staff's Picks */}
                    <div style={{ display: 'grid', gap: 16 }}>
                      {picks.sort((a, b) => a.pick_order - b.pick_order).map(pick => (
                        <div key={pick.id} style={{
                          display: 'flex',
                          gap: 16,
                          padding: 16,
                          background: pick.is_active ? '#f0fdf4' : '#fef2f2',
                          borderRadius: 8,
                          border: `1px solid ${pick.is_active ? '#22c55e' : '#fca5a5'}`,
                          opacity: pick.is_active ? 1 : 0.7
                        }}>
                          <div style={{
                            background: pick.pick_order <= 3 ? '#fbbf24' : '#6b7280',
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
                            #{pick.pick_order}
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
                              {pick.year} • {pick.location}
                              {pick.favorite_track && ` • Favorite: ${pick.favorite_track}`}
                            </div>
                            <div style={{
                              fontSize: 14,
                              color: '#374151',
                              lineHeight: 1.5,
                              marginBottom: 8,
                              padding: 12,
                              background: 'rgba(255, 255, 255, 0.7)',
                              borderRadius: 6
                            }}>
                              <strong>Why they chose this:</strong><br />
                              {pick.reason}
                            </div>
                            {pick.listening_context && (
                              <div style={{ fontSize: 13, color: '#6b7280', fontStyle: 'italic' }}>
                                🎧 Best enjoyed: {pick.listening_context}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                            <button
                              onClick={() => togglePickActive(pick.id, pick.is_active)}
                              disabled={updating === pick.id}
                              style={{
                                background: updating === pick.id ? '#9ca3af' : 
                                           pick.is_active ? '#dc2626' : '#059669',
                                color: 'white',
                                border: 'none',
                                borderRadius: 4,
                                padding: '6px 12px',
                                fontSize: 12,
                                cursor: updating === pick.id ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold'
                              }}
                            >
                              {updating === pick.id ? '⏳' : 
                               pick.is_active ? '❌ Hide' : '✅ Approve'}
                            </button>

                            <button
                              onClick={() => deleteSubmission(pick.id)}
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
          </div>
        </div>
      )}

      {/* No submissions message */}
      {Object.keys(staffGroups).length === 0 && viewMode !== 'settings' && (
        <div style={{
          textAlign: 'center',
          padding: 60,
          background: '#f9fafb',
          borderRadius: 12,
          border: '2px dashed #d1d5db'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <h3 style={{ fontSize: 20, marginBottom: 8, color: '#374151' }}>
            No Staff Submissions Yet
          </h3>
          <p style={{ color: '#6b7280', marginBottom: 20 }}>
            Staff have not submitted any picks yet. Share the voting link with your team to get started.
          </p>
          <Link
            href="/staff-voting"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#2563eb',
              color: 'white',
              padding: '12px 24px',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 'bold'
            }}
          >
            🗳️ Open Staff Voting Page
          </Link>
        </div>
      )}
    </div>
  );
}
