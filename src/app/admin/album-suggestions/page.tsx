// Fixed Admin Album Suggestions Management Page - Only ESLint fix applied
// Replace: src/app/admin/album-suggestions/page.tsx

"use client";

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface AlbumSuggestion {
  id: number;
  artist: string;
  album: string;
  reason: string | null;
  contribution_amount: string | null;
  contributor_name: string | null;
  contributor_email: string | null;
  context: string;
  status: 'pending' | 'approved' | 'purchased' | 'declined';
  admin_notes: string | null;
  created_at: string;
  updated_at: string | null;
  estimated_cost: number | null;
  venmo_transaction_id: string | null;
  priority_score: number | null;
}

export default function AdminAlbumSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<AlbumSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'purchased' | 'declined'>('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'priority_score' | 'contribution_amount'>('created_at');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      params.set('limit', '100');

      const response = await fetch(`/api/album-suggestions?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.data || []);
      } else {
        console.error('Failed to load suggestions');
      }
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const updateSuggestionStatus = async (id: number, status: string, adminNotes?: string) => {
    setUpdatingId(id);
    setError('');
    setSuccessMessage('');
    
    try {
      const response = await fetch('/api/album-suggestions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status,
          admin_notes: adminNotes
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccessMessage(`Successfully updated suggestion to ${status}`);
        setTimeout(() => setSuccessMessage(''), 3000);
        // Refresh suggestions
        loadSuggestions();
      } else {
        throw new Error(data.error || 'Failed to update suggestion');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Failed to update suggestion: ${errorMsg}`);
      setTimeout(() => setError(''), 5000);
      console.error('Error updating suggestion:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteSuggestion = async (id: number) => {
    if (!confirm('Are you sure you want to delete this suggestion? This cannot be undone.')) {
      return;
    }
    
    setUpdatingId(id);
    setError('');
    setSuccessMessage('');
    
    try {
      const response = await fetch('/api/album-suggestions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccessMessage('Successfully deleted suggestion');
        setTimeout(() => setSuccessMessage(''), 3000);
        // Refresh suggestions
        loadSuggestions();
      } else {
        throw new Error(data.error || 'Failed to delete suggestion');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Failed to delete suggestion: ${errorMsg}`);
      setTimeout(() => setError(''), 5000);
      console.error('Error deleting suggestion:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const sortedSuggestions = [...suggestions].sort((a, b) => {
    switch (sortBy) {
      case 'priority_score':
        return (b.priority_score || 0) - (a.priority_score || 0);
      case 'contribution_amount':
        const aAmount = a.contribution_amount ? parseFloat(a.contribution_amount) : 0;
        const bAmount = b.contribution_amount ? parseFloat(b.contribution_amount) : 0;
        return bAmount - aAmount;
      case 'created_at':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: { bg: '#fef3c7', color: '#d97706', border: '#f59e0b' },
      approved: { bg: '#dcfce7', color: '#16a34a', border: '#22c55e' },
      purchased: { bg: '#dbeafe', color: '#2563eb', border: '#3b82f6' },
      declined: { bg: '#fee2e2', color: '#dc2626', border: '#ef4444' }
    };
    
    const style = styles[status as keyof typeof styles] || styles.pending;
    
    return (
      <span style={{
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        padding: '4px 8px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase'
      }}>
        {status}
      </span>
    );
  };

  const getVenmoUrl = () => {
    // Just link to your Venmo profile - customers will see the suggestion info and can pay you
    return `https://venmo.com/u/deadwaxdialogues`;
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <h1>Loading Album Suggestions...</h1>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: '#fff', color: '#222', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 'bold', margin: '0 0 8px 0' }}>
            💡 Album Suggestions
          </h1>
          <p style={{ color: '#6b7280', fontSize: 16, margin: 0 }}>
            Manage user-submitted album suggestions for the collection
          </p>
        </div>
        <Link
          href="/admin/admin-dashboard"
          style={{
            background: '#6b7280',
            color: 'white',
            padding: '8px 16px',
            borderRadius: 8,
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600
          }}
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        <div style={{ background: '#f0f9ff', padding: 16, borderRadius: 8, border: '1px solid #0369a1' }}>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#0c4a6e' }}>
            {suggestions.length}
          </div>
          <div style={{ fontSize: 12, color: '#0369a1' }}>Total Suggestions</div>
        </div>
        <div style={{ background: '#fef3c7', padding: 16, borderRadius: 8, border: '1px solid #f59e0b' }}>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#92400e' }}>
            {suggestions.filter(s => s.status === 'pending').length}
          </div>
          <div style={{ fontSize: 12, color: '#d97706' }}>Pending Review</div>
        </div>
        <div style={{ background: '#dcfce7', padding: 16, borderRadius: 8, border: '1px solid #22c55e' }}>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#15803d' }}>
            {suggestions.filter(s => s.status === 'purchased').length}
          </div>
          <div style={{ fontSize: 12, color: '#16a34a' }}>Purchased</div>
        </div>
        <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 8, border: '1px solid #10b981' }}>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#047857' }}>
            ${suggestions.reduce((sum, s) => {
              const amount = s.contribution_amount ? parseFloat(s.contribution_amount) : 0;
              return sum + amount;
            }, 0).toFixed(2)}
          </div>
          <div style={{ fontSize: 12, color: '#059669' }}>Total Contributions</div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div style={{
          background: '#dcfce7',
          border: '1px solid #22c55e',
          color: '#15803d',
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
          fontSize: 14,
          fontWeight: 600
        }}>
          ✅ {successMessage}
        </div>
      )}

      {error && (
        <div style={{
          background: '#fee2e2',
          border: '1px solid #ef4444',
          color: '#dc2626',
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
          fontSize: 14,
          fontWeight: 600
        }}>
          ❌ {error}
        </div>
      )}

      {/* Filters and Sort */}
      <div style={{
        background: '#f8fafc',
        padding: 16,
        borderRadius: 8,
        marginBottom: 24,
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 600 }}>Filter:</label>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as typeof filter)}
            style={{
              padding: '6px 10px',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              fontSize: 14
            }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="purchased">Purchased</option>
            <option value="declined">Declined</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 600 }}>Sort by:</label>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            style={{
              padding: '6px 10px',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              fontSize: 14
            }}
          >
            <option value="created_at">Newest First</option>
            <option value="priority_score">Priority Score</option>
            <option value="contribution_amount">Contribution Amount</option>
          </select>
        </div>

        <button
          onClick={loadSuggestions}
          style={{
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            padding: '6px 12px',
            fontSize: 14,
            cursor: 'pointer'
          }}
        >
          Refresh
        </button>
      </div>

      {/* Suggestions Table */}
      <div style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        overflow: 'hidden'
      }}>
        <div style={{
          background: '#f9fafb',
          padding: '12px 16px',
          borderBottom: '1px solid #e5e7eb',
          fontWeight: 600,
          fontSize: 14,
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 120px 100px 150px',
          gap: 16
        }}>
          <div>Album</div>
          <div>Contributor</div>
          <div>Contribution</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        <div style={{ maxHeight: 600, overflowY: 'auto' }}>
          {sortedSuggestions.map((item, index) => (
            <div key={item.id}>
              <div style={{
                padding: '16px',
                borderBottom: index < sortedSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 120px 100px 150px',
                gap: 16,
                alignItems: 'center',
                fontSize: 14
              }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>
                    {item.artist} - {item.album}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {item.context} • {new Date(item.created_at).toLocaleDateString()}
                  </div>
                  {item.reason && (
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                      {item.reason.substring(0, 100)}{item.reason.length > 100 ? '...' : ''}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontWeight: 500 }}>{item.contributor_name || 'Anonymous'}</div>
                  {item.contributor_email && (
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      {item.contributor_email}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'center' }}>
                  {item.contribution_amount ? (
                    <div>
                      <div style={{ fontWeight: 600, color: '#059669' }}>
                        ${item.contribution_amount}
                      </div>
                      <a
                        href={getVenmoUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 10,
                          color: '#3b82f6',
                          textDecoration: 'none'
                        }}
                      >
                        💸 Venmo
                      </a>
                    </div>
                  ) : (
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>
                  )}
                </div>

                <div style={{ textAlign: 'center' }}>
                  {getStatusBadge(item.status)}
                </div>

                <div style={{ display: 'flex', gap: 4, fontSize: 12, flexWrap: 'wrap' }}>
                  {item.status === 'pending' && (
                    <>
                      <button
                        onClick={() => updateSuggestionStatus(item.id, 'approved')}
                        disabled={updatingId === item.id}
                        style={{
                          background: '#22c55e',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 8px',
                          cursor: updatingId === item.id ? 'not-allowed' : 'pointer',
                          fontSize: 11,
                          opacity: updatingId === item.id ? 0.5 : 1
                        }}
                      >
                        {updatingId === item.id ? '...' : '✓'}
                      </button>
                      <button
                        onClick={() => updateSuggestionStatus(item.id, 'declined')}
                        disabled={updatingId === item.id}
                        style={{
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 8px',
                          cursor: updatingId === item.id ? 'not-allowed' : 'pointer',
                          fontSize: 11,
                          opacity: updatingId === item.id ? 0.5 : 1
                        }}
                      >
                        {updatingId === item.id ? '...' : '✕'}
                      </button>
                    </>
                  )}
                  {item.status === 'approved' && (
                    <button
                      onClick={() => updateSuggestionStatus(item.id, 'purchased', 'Album purchased and added to collection')}
                      disabled={updatingId === item.id}
                      style={{
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px 8px',
                        cursor: updatingId === item.id ? 'not-allowed' : 'pointer',
                        fontSize: 11,
                        opacity: updatingId === item.id ? 0.5 : 1
                      }}
                    >
                      {updatingId === item.id ? '...' : '🛒'}
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    style={{
                      background: '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: 11
                    }}
                  >
                    {expandedId === item.id ? '▲' : '▼'}
                  </button>
                  <button
                    onClick={() => deleteSuggestion(item.id)}
                    disabled={updatingId === item.id}
                    style={{
                      background: '#dc2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      padding: '4px 8px',
                      cursor: updatingId === item.id ? 'not-allowed' : 'pointer',
                      fontSize: 11,
                      opacity: updatingId === item.id ? 0.5 : 1
                    }}
                    title="Delete suggestion permanently"
                  >
                    {updatingId === item.id ? '...' : '🗑️'}
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === item.id && (
                <div style={{
                  background: '#f8fafc',
                  padding: 16,
                  borderBottom: '1px solid #e5e7eb',
                  fontSize: 13
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <strong>Full Reason:</strong>
                      <div style={{ marginTop: 4, color: '#6b7280' }}>
                        {item.reason || 'No additional reason provided'}
                      </div>
                    </div>
                    <div>
                      <strong>Admin Notes:</strong>
                      <div style={{ marginTop: 4, color: '#6b7280' }}>
                        {item.admin_notes || 'No admin notes'}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 12, color: '#9ca3af' }}>
                    Created: {new Date(item.created_at).toLocaleString()}
                    {item.updated_at && ` • Updated: ${new Date(item.updated_at).toLocaleString()}`}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {sortedSuggestions.length === 0 && (
          <div style={{
            padding: 40,
            textAlign: 'center',
            color: '#6b7280'
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>💡</div>
            <div style={{ fontSize: 16 }}>
              {filter === 'all' ? 'No album suggestions yet' : `No ${filter} suggestions`}
            </div>
            <div style={{ fontSize: 14, marginTop: 4 }}>
              Suggestions will appear here when users submit them through the website
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {suggestions.filter(s => s.status === 'pending').length > 0 && (
        <div style={{
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: 8,
          padding: 16,
          marginTop: 24,
          textAlign: 'center'
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: '#92400e' }}>
            Quick Actions for Pending Suggestions
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                const pendingSuggestions = suggestions.filter(s => s.status === 'pending');
                pendingSuggestions.forEach(s => updateSuggestionStatus(s.id, 'approved'));
              }}
              style={{
                background: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600
              }}
            >
              ✓ Approve All Pending
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
// AUDIT: inspected, no changes.
