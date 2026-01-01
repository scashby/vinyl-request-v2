import React, { useState, useEffect } from 'react';
import { compareTrackArrays, type Track, type TrackDiff, type FieldConflict, canMergeField } from 'lib/conflictDetection';

interface ConflictResolutionModalProps {
  conflicts: FieldConflict[];
  source: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function ConflictResolutionModal({
  conflicts,
  onCancel,
}: ConflictResolutionModalProps) {
  const [appliedConflicts, setAppliedConflicts] = useState<Set<string>>(new Set());
  const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(new Set());
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [resolutions, setResolutions] = useState<Map<string, 'current' | 'new' | 'merge'>>(new Map());

  // Helper to generate unique ID for conflict
  const getConflictId = (conflict: FieldConflict) => `${conflict.album_id}-${conflict.field_name}`;
  
  // Helper to get display name for field
  const getFieldDisplayName = (fieldName: string): string => {
    const nameMap: Record<string, string> = {
      tracks: 'Tracks',
      disc_metadata: 'Disc Metadata',
      musicians: 'Musicians',
      producers: 'Producers',
      engineers: 'Engineers',
      songwriters: 'Songwriters',
      packaging: 'Packaging',
      sound: 'Sound',
      image_url: 'Cover Image',
      back_image_url: 'Back Cover Image',
      discogs_genres: 'Genres',
      discogs_styles: 'Styles',
      notes: 'Notes',
    };
    return nameMap[fieldName] || fieldName;
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  const applyConflict = (conflict: FieldConflict) => {
    const conflictId = getConflictId(conflict);
    setAppliedConflicts(prev => new Set([...prev, conflictId]));
  };

  const toggleConflictExpanded = (conflictId: string) => {
    setExpandedConflicts(prev => {
      const next = new Set(prev);
      if (next.has(conflictId)) {
        next.delete(conflictId);
      } else {
        next.add(conflictId);
      }
      return next;
    });
  };

  const toggleFieldExpanded = (conflictId: string) => {
    setExpandedFields(prev => {
      const next = new Set(prev);
      if (next.has(conflictId)) {
        next.delete(conflictId);
      } else {
        next.add(conflictId);
      }
      return next;
    });
  };

  const groupedConflicts = conflicts.reduce((acc, conflict) => {
    const key = `${conflict.artist} - ${conflict.title}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(conflict);
    return acc;
  }, {} as Record<string, FieldConflict[]>);

  const renderValue = (value: unknown, isExpanded: boolean = false): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>null</span>;
    }

    if (typeof value === 'boolean') {
      return <span style={{ color: '#8b5cf6' }}>{value.toString()}</span>;
    }

    if (typeof value === 'number') {
      return <span style={{ color: '#06b6d4' }}>{value}</span>;
    }

    if (typeof value === 'string') {
      return <span style={{ color: '#10b981' }}>&quot;{value}&quot;</span>;
    }

    if (Array.isArray(value)) {
      if (!isExpanded) {
        return (
          <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>
            [{value.length} items]
          </span>
        );
      }
      return (
        <pre style={{ 
          margin: 0, 
          padding: '8px', 
          background: '#1f2937', 
          borderRadius: '4px',
          fontSize: '12px',
          maxHeight: '200px',
          overflow: 'auto'
        }}>
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }

    if (typeof value === 'object') {
      if (!isExpanded) {
        return (
          <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>
            {'{'}...{'}'}
          </span>
        );
      }
      return (
        <pre style={{ 
          margin: 0, 
          padding: '8px', 
          background: '#1f2937', 
          borderRadius: '4px',
          fontSize: '12px',
          maxHeight: '200px',
          overflow: 'auto'
        }}>
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }

    return String(value);
  };

  const renderTrackComparison = (
    currentTracks: Track[] | undefined,
    newTracks: Track[] | undefined
  ): React.ReactNode => {
    if (!currentTracks && !newTracks) {
      return <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>No track data</div>;
    }

    const diffs: TrackDiff[] = compareTrackArrays(currentTracks || [], newTracks || []);

    return (
      <div style={{ marginTop: '12px' }}>
        <div style={{ 
          fontWeight: 600, 
          marginBottom: '8px',
          color: '#e5e7eb'
        }}>
          Track Comparison ({diffs.length} differences)
        </div>
        <div style={{ 
          maxHeight: '400px', 
          overflow: 'auto',
          border: '1px solid #374151',
          borderRadius: '4px'
        }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '13px'
          }}>
            <thead style={{ 
              position: 'sticky', 
              top: 0, 
              background: '#1f2937',
              borderBottom: '2px solid #374151'
            }}>
              <tr>
                <th style={{ padding: '8px', textAlign: 'left', color: '#9ca3af', width: '40px' }}>#</th>
                <th style={{ padding: '8px', textAlign: 'left', color: '#9ca3af', width: '80px' }}>Status</th>
                <th style={{ padding: '8px', textAlign: 'left', color: '#9ca3af' }}>Current DB</th>
                <th style={{ padding: '8px', textAlign: 'left', color: '#9ca3af' }}>New CLZ</th>
                <th style={{ padding: '8px', textAlign: 'left', color: '#9ca3af' }}>Changes</th>
              </tr>
            </thead>
            <tbody>
              {diffs.map((diff, idx) => {
                const bgColor = 
                  diff.status === 'added' ? '#f0fdf4' : 
                  diff.status === 'removed' ? '#fef2f2' : 
                  diff.status === 'changed' ? '#fef3c7' : 
                  'transparent';
                
                const statusColor =
                  diff.status === 'added' ? '#10b981' :
                  diff.status === 'removed' ? '#ef4444' :
                  diff.status === 'changed' ? '#f59e0b' :
                  '#9ca3af';

                const statusText =
                  diff.status === 'added' ? '🟢 Added' :
                  diff.status === 'removed' ? '🔴 Removed' :
                  diff.status === 'changed' ? '🟡 Changed' :
                  '⚪ Same';

                return (
                  <tr key={idx} style={{ 
                    background: bgColor,
                    borderBottom: '1px solid #374151'
                  }}>
                    <td style={{ padding: '8px', color: '#9ca3af' }}>
                      {diff.position}
                    </td>
                    <td style={{ padding: '8px', color: statusColor, fontWeight: 500 }}>
                      {statusText}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {diff.current ? (
                        <div>
                          <div style={{ fontWeight: 500, color: '#e5e7eb' }}>
                            {diff.current.title}
                          </div>
                          {diff.current.artist && (
                            <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                              {diff.current.artist}
                            </div>
                          )}
                          {diff.current.duration && (
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>
                              {diff.current.duration}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {diff.new ? (
                        <div>
                          <div style={{ fontWeight: 500, color: '#e5e7eb' }}>
                            {diff.new.title}
                          </div>
                          {diff.new.artist && (
                            <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                              {diff.new.artist}
                            </div>
                          )}
                          {diff.new.duration && (
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>
                              {diff.new.duration}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '8px', fontSize: '12px', color: '#9ca3af' }}>
                      {diff.changes && diff.changes.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: '16px' }}>
                          {diff.changes.map((change, cIdx) => (
                            <li key={cIdx}>{change}</li>
                          ))}
                        </ul>
                      ) : (
                        <span style={{ fontStyle: 'italic' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#111827',
          borderRadius: '8px',
          maxWidth: '1400px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            position: 'sticky',
            top: 0,
            background: '#111827',
            borderBottom: '1px solid #374151',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#f3f4f6' }}>
              Resolve Import Conflicts
            </h2>
            <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: '14px' }}>
              {conflicts.length} conflicts found across {Object.keys(groupedConflicts).length} albums
            </p>
          </div>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#9ca3af',
              padding: '4px 8px',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {Object.entries(groupedConflicts).map(([albumKey, albumConflicts]) => {
            const isExpanded = expandedConflicts.has(albumKey);

            return (
              <div
                key={albumKey}
                style={{
                  background: '#1f2937',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '16px',
                    borderBottom: isExpanded ? '1px solid #374151' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onClick={() => toggleConflictExpanded(albumKey)}
                >
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#f3f4f6' }}>
                      {albumKey}
                    </div>
                    <div style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>
                      {albumConflicts.length} field{albumConflicts.length !== 1 ? 's' : ''} in conflict
                    </div>
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '20px' }}>
                    {isExpanded ? '−' : '+'}
                  </div>
                </div>

                {isExpanded && albumConflicts.map((conflict) => {
                  const conflictId = getConflictId(conflict);
                  const isApplied = appliedConflicts.has(conflictId);
                  const fieldName = conflict.field_name;
                  const fieldDisplayName = getFieldDisplayName(fieldName);
                  const currentValue = conflict.current_value;
                  const newValue = conflict.new_value;
                  const canMerge = canMergeField(currentValue) && canMergeField(newValue);

                  const isComplexField = 
                    (Array.isArray(currentValue) && (currentValue as unknown[]).length > 0) ||
                    (Array.isArray(newValue) && (newValue as unknown[]).length > 0) ||
                    (typeof currentValue === 'object' && currentValue !== null) ||
                    (typeof newValue === 'object' && newValue !== null);

                  const isFieldExpanded = expandedFields.has(conflictId);

                  return (
                    <div
                      key={conflictId}
                      style={{
                        padding: '16px',
                        borderBottom: '1px solid #374151',
                        background: isApplied ? '#0f1419' : 'transparent',
                      }}
                    >
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'flex-start',
                        marginBottom: '12px'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            fontSize: '14px', 
                            fontWeight: 600, 
                            color: '#f3f4f6',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <span>{fieldDisplayName}</span>
                            {canMerge && (
                              <span style={{
                                background: '#065f46',
                                color: '#d1fae5',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 500
                              }}>
                                MERGEABLE
                              </span>
                            )}
                            {isComplexField && (
                              <button
                                onClick={() => toggleFieldExpanded(conflictId)}
                                style={{
                                  background: '#374151',
                                  border: 'none',
                                  color: '#9ca3af',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  fontWeight: 500
                                }}
                              >
                                {isFieldExpanded ? 'Collapse' : 'Expand'}
                              </button>
                            )}
                          </div>

                          {fieldName === 'tracks' ? (
                            renderTrackComparison(
                              currentValue as Track[] | undefined,
                              newValue as Track[] | undefined
                            )
                          ) : (
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: '1fr 1fr', 
                              gap: '12px' 
                            }}>
                              <div>
                                <div style={{ 
                                  fontSize: '12px', 
                                  color: '#9ca3af', 
                                  marginBottom: '4px',
                                  fontWeight: 500
                                }}>
                                  Current DB Value:
                                </div>
                                <div style={{ 
                                  padding: '8px', 
                                  background: '#0f1419', 
                                  borderRadius: '4px',
                                  border: '1px solid #374151',
                                  fontFamily: 'monospace',
                                  fontSize: '13px',
                                  color: '#e5e7eb',
                                  wordBreak: 'break-word'
                                }}>
                                  {renderValue(currentValue, isFieldExpanded)}
                                </div>
                              </div>
                              <div>
                                <div style={{ 
                                  fontSize: '12px', 
                                  color: '#9ca3af', 
                                  marginBottom: '4px',
                                  fontWeight: 500
                                }}>
                                  New CLZ Value:
                                </div>
                                <div style={{ 
                                  padding: '8px', 
                                  background: '#0f1419', 
                                  borderRadius: '4px',
                                  border: '1px solid #374151',
                                  fontFamily: 'monospace',
                                  fontSize: '13px',
                                  color: '#e5e7eb',
                                  wordBreak: 'break-word'
                                }}>
                                  {renderValue(newValue, isFieldExpanded)}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <select
                            value={resolutions.get(conflictId) || 'current'}
                            onChange={(e) => {
                              setResolutions(prev => new Map(prev).set(conflictId, e.target.value as 'current' | 'new' | 'merge'));
                            }}
                            disabled={isApplied}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              background: '#374151',
                              border: '1px solid #4b5563',
                              borderRadius: '4px',
                              color: '#f3f4f6',
                              fontSize: '13px',
                              cursor: isApplied ? 'not-allowed' : 'pointer',
                              opacity: isApplied ? 0.5 : 1,
                            }}
                          >
                            <option value="current">Keep Current DB Value</option>
                            <option value="new">Use New CLZ Value</option>
                            {canMerge && <option value="merge">Smart Merge (preserves enrichment)</option>}
                          </select>
                        </div>
                        <div>
                          <button
                            onClick={() => applyConflict(conflict)}
                            disabled={isApplied}
                            style={{
                              background: isApplied ? '#d1d5db' : '#4FC3F7',
                              color: 'white',
                              border: 'none',
                              padding: '6px 16px',
                              fontSize: '13px',
                              fontWeight: 500,
                              cursor: isApplied ? 'not-allowed' : 'pointer',
                              borderRadius: '4px',
                            }}
                          >
                            {isApplied ? 'Applied' : 'Apply'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}