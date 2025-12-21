// src/app/edit-collection/crates/ManageCratesModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from 'lib/supabaseClient';
import type { Crate } from 'types/crate';

interface ManageCratesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCratesChanged: () => void;
}

export function ManageCratesModal({ isOpen, onClose, onCratesChanged }: ManageCratesModalProps) {
  const [crates, setCrates] = useState<Crate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCrates();
    }
  }, [isOpen]);

  const loadCrates = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('crates')
        .select('*')
        .order('sort_order', { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setCrates(data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load crates');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (crateId: number, crateName: string) => {
    if (!confirm(`Are you sure you want to delete "${crateName}"? This cannot be undone.`)) {
      return;
    }

    setDeletingId(crateId);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('crates')
        .delete()
        .eq('id', crateId);

      if (deleteError) {
        setError(deleteError.message);
        setDeletingId(null);
        return;
      }

      // Remove from local state
      setCrates(crates.filter((c) => c.id !== crateId));
      onCratesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete crate');
    } finally {
      setDeletingId(null);
    }
  };

  const handleReorder = async (crateId: number, direction: 'up' | 'down') => {
    const currentIndex = crates.findIndex((c) => c.id === crateId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= crates.length) return;

    // Optimistically update UI
    const newCrates = [...crates];
    const [movedCrate] = newCrates.splice(currentIndex, 1);
    newCrates.splice(newIndex, 0, movedCrate);
    setCrates(newCrates);

    // Update sort_order in database
    try {
      const updates = newCrates.map((crate, index) => ({
        id: crate.id,
        sort_order: index,
      }));

      for (const update of updates) {
        await supabase
          .from('crates')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
      }

      onCratesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder crates');
      // Reload to fix state
      loadCrates();
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 30001,
      }}
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          width: '600px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111827' }}>
            Manage Crates
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '0',
              lineHeight: '1',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {error && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px',
                background: '#fee2e2',
                border: '1px solid #ef4444',
                borderRadius: '6px',
                color: '#991b1b',
                fontSize: '14px',
              }}
            >
              {error}
            </div>
          )}

          {loading ? (
            <div
              style={{
                padding: '40px',
                textAlign: 'center',
                color: '#6b7280',
                fontSize: '14px',
              }}
            >
              Loading crates...
            </div>
          ) : crates.length === 0 ? (
            <div
              style={{
                padding: '40px',
                textAlign: 'center',
                color: '#6b7280',
                fontSize: '14px',
              }}
            >
              No crates yet. Create your first crate!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {crates.map((crate, index) => (
                <div
                  key={crate.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    background: '#f9fafb',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  {/* Reorder Buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button
                      onClick={() => handleReorder(crate.id, 'up')}
                      disabled={index === 0}
                      style={{
                        width: '24px',
                        height: '20px',
                        background: index === 0 ? '#f3f4f6' : 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '3px',
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: index === 0 ? '#d1d5db' : '#374151',
                      }}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleReorder(crate.id, 'down')}
                      disabled={index === crates.length - 1}
                      style={{
                        width: '24px',
                        height: '20px',
                        background: index === crates.length - 1 ? '#f3f4f6' : 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '3px',
                        cursor: index === crates.length - 1 ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: index === crates.length - 1 ? '#d1d5db' : '#374151',
                      }}
                    >
                      ▼
                    </button>
                  </div>

                  {/* Icon and Info */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        fontSize: '28px',
                        lineHeight: '1',
                      }}
                    >
                      {crate.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#111827',
                          marginBottom: '2px',
                        }}
                      >
                        {crate.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {crate.is_smart ? (
                          <>
                            Smart Crate • {crate.smart_rules?.rules?.length || 0} rule(s) •{' '}
                            {crate.match_rules === 'all' ? 'Match All' : 'Match Any'}
                            {crate.live_update && ' • Live Update'}
                          </>
                        ) : (
                          'Manual Crate'
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {/* Edit button - placeholder for future */}
                    <button
                      disabled
                      style={{
                        padding: '6px 12px',
                        background: '#f3f4f6',
                        color: '#9ca3af',
                        border: '1px solid #e5e7eb',
                        borderRadius: '4px',
                        fontSize: '13px',
                        cursor: 'not-allowed',
                      }}
                      title="Edit feature coming soon"
                    >
                      Edit
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(crate.id, crate.name)}
                      disabled={deletingId === crate.id}
                      style={{
                        padding: '6px 12px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '13px',
                        cursor: deletingId === crate.id ? 'not-allowed' : 'pointer',
                        opacity: deletingId === crate.id ? 0.5 : 1,
                      }}
                    >
                      {deletingId === crate.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={handleClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}