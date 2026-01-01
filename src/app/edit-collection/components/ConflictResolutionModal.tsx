// src/app/edit-collection/components/ConflictResolutionModal.tsx
'use client';

import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import {
  type FieldConflict,
  type ResolutionStrategy,
  type ImportSource,
  type Track,
  type TrackDiff,
  applyResolution,
  getRejectedValue,
  getFieldDisplayName,
  canMergeField,
  smartMergeTracks,
  compareTrackArrays,
} from '../../../lib/conflictDetection';
import styles from '../EditCollection.module.css';

interface ConflictResolutionModalProps {
  conflicts: FieldConflict[];
  source: ImportSource;
  onComplete: () => void;
  onCancel: () => void;
}

interface AlbumConflictGroup {
  album_id: number;
  artist: string;
  title: string;
  format: string;
  cat_no: string | null;
  barcode: string | null;
  country: string | null;
  year: string | null;
  labels: string[];
  conflicts: FieldConflict[];
}

export default function ConflictResolutionModal({
  conflicts,
  source,
  onComplete,
  onCancel,
}: ConflictResolutionModalProps) {
  // Group conflicts by album
  const conflictsByAlbum = conflicts.reduce<Map<number, AlbumConflictGroup>>((acc, conflict) => {
    if (!acc.has(conflict.album_id)) {
      acc.set(conflict.album_id, {
        album_id: conflict.album_id,
        artist: conflict.artist,
        title: conflict.title,
        format: conflict.format,
        cat_no: conflict.cat_no,
        barcode: conflict.barcode,
        country: conflict.country,
        year: conflict.year,
        labels: conflict.labels,
        conflicts: [],
      });
    }
    
    acc.get(conflict.album_id)!.conflicts.push(conflict);
    return acc;
  }, new Map());

  const albumGroups = Array.from(conflictsByAlbum.values());

  // Track resolutions for each conflict (key: "albumId-fieldName")
  const [resolutions, setResolutions] = useState<Record<string, ResolutionStrategy>>(() => {
    const initial: Record<string, ResolutionStrategy> = {};
    conflicts.forEach(c => {
      const key = `${c.album_id}-${c.field_name}`;
      // Default to 'use_new' for most fields
      initial[key] = 'use_new';
    });
    return initial;
  });

  // Track which conflicts are collapsed
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  // Track expanded conflicts (to show full data)
  const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(new Set());

  // Track which conflicts have been applied
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const [isProcessing, setIsProcessing] = useState(false);

  const toggleCollapse = (albumId: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(albumId)) {
        next.delete(albumId);
      } else {
        next.add(albumId);
      }
      return next;
    });
  };

  const toggleExpanded = (key: string) => {
    setExpandedConflicts(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  /**
   * Render a value with proper React-safe formatting
   */
  const renderValue = (value: unknown, conflictKey: string, isExpanded: boolean) => {
    if (value === null || value === undefined) {
      return <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>(empty)</span>;
    }

    // Arrays
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>(empty array)</span>;
      }

      // String arrays
      if (typeof value[0] === 'string') {
        if (isExpanded || value.length <= 3) {
          return (
            <div>
              {value.map((item, idx) => (
                <div key={idx} style={{ marginLeft: '8px' }}>• {String(item)}</div>
              ))}
            </div>
          );
        }
        return (
          <div>
            <div>{value.slice(0, 2).join(', ')}...</div>
            <button
              onClick={() => toggleExpanded(conflictKey)}
              style={{
                background: 'none',
                border: 'none',
                color: '#4FC3F7',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '4px 0',
                textDecoration: 'underline',
              }}
            >
              Show all {value.length} items
            </button>
          </div>
        );
      }

      // Object arrays (like tracks) - don't render directly, show count
      return (
        <div>
          <div>[{value.length} items]</div>
          <button
            onClick={() => toggleExpanded(conflictKey)}
            style={{
              background: 'none',
              border: 'none',
              color: '#4FC3F7',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '4px 0',
              textDecoration: 'underline',
            }}
          >
            {isExpanded ? 'Hide' : 'Show'} details
          </button>
        </div>
      );
    }

    // Objects - stringify safely
    if (typeof value === 'object') {
      const jsonStr = JSON.stringify(value, null, 2);
      
      if (isExpanded) {
        return (
          <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid #e5e7eb', padding: '8px', borderRadius: '4px' }}>
            <pre style={{ margin: 0, fontSize: '12px', whiteSpace: 'pre-wrap' }}>
              {jsonStr}
            </pre>
            <button
              onClick={() => toggleExpanded(conflictKey)}
              style={{
                background: 'none',
                border: 'none',
                color: '#4FC3F7',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '4px 0',
                marginTop: '4px',
                textDecoration: 'underline',
              }}
            >
              Collapse
            </button>
          </div>
        );
      }
      return (
        <div>
          <div>[Object with {Object.keys(value).length} properties]</div>
          <button
            onClick={() => toggleExpanded(conflictKey)}
            style={{
              background: 'none',
              border: 'none',
              color: '#4FC3F7',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '4px 0',
              textDecoration: 'underline',
            }}
          >
            Show details
          </button>
        </div>
      );
    }

    // Primitives
    if (typeof value === 'boolean') {
      return <span>{value ? 'Yes' : 'No'}</span>;
    }

    return <span>{String(value)}</span>;
  };

  /**
   * Specialized renderer for track arrays
   */
  const renderTrackComparison = (
    currentTracks: Track[] | null,
    newTracks: Track[] | null,
    conflictKey: string,
    isExpanded: boolean
  ) => {
    if (!isExpanded) {
      const currentCount = currentTracks?.length || 0;
      const newCount = newTracks?.length || 0;
      
      return (
        <div>
          <div style={{ marginBottom: '8px' }}>
            <strong>Current:</strong> {currentCount} tracks | <strong>New:</strong> {newCount} tracks
          </div>
          <button
            onClick={() => toggleExpanded(conflictKey)}
            style={{
              background: '#4FC3F7',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              fontSize: '13px',
              cursor: 'pointer',
              borderRadius: '4px',
            }}
          >
            Compare Tracks
          </button>
        </div>
      );
    }

    // Get track differences
    const diffs: TrackDiff[] = compareTrackArrays(currentTracks || [], newTracks || []);

    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ 
          background: '#f9fafb', 
          padding: '8px 12px', 
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Track Comparison</div>
          <button
            onClick={() => toggleExpanded(conflictKey)}
            style={{
              background: 'none',
              border: 'none',
              color: '#4FC3F7',
              cursor: 'pointer',
              fontSize: '12px',
              textDecoration: 'underline',
            }}
          >
            Hide
          </button>
        </div>
        
        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
              <tr>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Pos</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Current DB</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>New {source.toUpperCase()}</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {diffs.map((diff, idx) => {
                let bgColor = 'white';
                let statusColor = '#6b7280';
                let statusText = 'Same';
                
                if (diff.status === 'added') {
                  bgColor = '#f0fdf4';
                  statusColor = '#059669';
                  statusText = 'New';
                } else if (diff.status === 'removed') {
                  bgColor = '#fef2f2';
                  statusColor = '#dc2626';
                  statusText = 'Removed';
                } else if (diff.status === 'changed') {
                  bgColor = '#fef3c7';
                  statusColor = '#d97706';
                  statusText = 'Changed';
                }

                return (
                  <tr key={idx} style={{ background: bgColor, borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{diff.position}</td>
                    <td style={{ padding: '8px' }}>
                      {diff.current ? (
                        <div>
                          <div style={{ fontWeight: 500 }}>{diff.current.title}</div>
                          {diff.current.artist && (
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>{diff.current.artist}</div>
                          )}
                          {diff.current.duration && (
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>{diff.current.duration}</div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {diff.new ? (
                        <div>
                          <div style={{ fontWeight: 500 }}>{diff.new.title}</div>
                          {diff.new.artist && (
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>{diff.new.artist}</div>
                          )}
                          {diff.new.duration && (
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>{diff.new.duration}</div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <div style={{ color: statusColor, fontWeight: 600, fontSize: '11px' }}>
                        {statusText}
                      </div>
                      {diff.changes && diff.changes.length > 0 && (
                        <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                          {diff.changes.join(', ')}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div style={{ 
          background: '#f9fafb', 
          padding: '8px 12px', 
          borderTop: '1px solid #e5e7eb',
          fontSize: '11px',
          color: '#6b7280'
        }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div><span style={{ color: '#059669' }}>●</span> New tracks will be added</div>
            <div><span style={{ color: '#dc2626' }}>●</span> Missing tracks will be removed</div>
            <div><span style={{ color: '#d97706' }}>●</span> Changed tracks will be updated</div>
          </div>
        </div>
      </div>
    );
  };

  const updateResolution = (albumId: number, fieldName: string, resolution: ResolutionStrategy) => {
    const key = `${albumId}-${fieldName}`;
    setResolutions(prev => ({ ...prev, [key]: resolution }));
  };

  const applyConflict = async (conflict: FieldConflict) => {
    const key = `${conflict.album_id}-${conflict.field_name}`;
    const resolution = resolutions[key];

    try {
      // Calculate final value (with smart merge for tracks)
      let finalValue;
      
      if (conflict.field_name === 'tracks' && resolution === 'merge') {
        // Use smart track merging
        finalValue = smartMergeTracks(
          conflict.current_value as Track[] | null,
          conflict.new_value as Track[] | null
        );
      } else {
        finalValue = applyResolution(
          conflict.current_value,
          conflict.new_value,
          resolution
        );
      }

      // Update album in database
      const { error: updateError } = await supabase
        .from('collection')
        .update({ [conflict.field_name]: finalValue })
        .eq('id', conflict.album_id);

      if (updateError) throw updateError;

      // Save resolution to history
      const keptValue = resolution === 'keep_current' ? conflict.current_value : finalValue;
      const rejectedValue = getRejectedValue(conflict.current_value, conflict.new_value, resolution);

      const { error: resolutionError } = await supabase
        .from('import_conflict_resolutions')
        .upsert({
          album_id: conflict.album_id,
          field_name: conflict.field_name,
          kept_value: keptValue,
          rejected_value: rejectedValue,
          resolution,
          source,
        }, {
          onConflict: 'album_id,field_name,source',
        });

      if (resolutionError) throw resolutionError;

      // Mark as applied
      setApplied(prev => new Set([...prev, key]));
    } catch (err) {
      console.error('Error applying conflict resolution:', err);
      alert(`Failed to apply resolution: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const acceptAllForAlbum = async (albumId: number) => {
    const group = conflictsByAlbum.get(albumId);
    if (!group) return;

    setIsProcessing(true);

    try {
      for (const conflict of group.conflicts) {
        const key = `${conflict.album_id}-${conflict.field_name}`;
        
        // Skip if already applied
        if (applied.has(key)) continue;

        await applyConflict(conflict);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const applyAllResolutions = async () => {
    setIsProcessing(true);

    try {
      for (const conflict of conflicts) {
        const key = `${conflict.album_id}-${conflict.field_name}`;
        
        // Skip if already applied
        if (applied.has(key)) continue;

        await applyConflict(conflict);
      }

      // All done
      onComplete();
    } catch (err) {
      console.error('Error applying all resolutions:', err);
      alert('Some resolutions failed to apply. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const pendingCount = conflicts.length - applied.size;
  const allApplied = applied.size === conflicts.length;

  return (
    <div className={styles.duplicatesWrapper}>
      {/* Header */}
      <div className={styles.duplicatesNav}>
        <button
          onClick={onCancel}
          className={styles.duplicatesBackButton}
          disabled={isProcessing}
        >
          ◀ Back
        </button>
        <h1 className={styles.duplicatesTitle}>Resolve Import Conflicts</h1>
        <div style={{ width: '60px' }}></div>
      </div>

      {/* Toolbar */}
      <div className={styles.duplicatesToolbar}>
        <div className={styles.duplicatesToolbarLabel}>
          Import Complete - {pendingCount} Conflicts Pending
        </div>
        <div className={styles.duplicatesToolbarSpacer}></div>
        <div className={styles.duplicatesCount}>
          {applied.size} / {conflicts.length} Applied
        </div>
        <button
          onClick={applyAllResolutions}
          disabled={isProcessing || allApplied}
          className={styles.duplicatesFindButton}
        >
          {isProcessing ? 'Applying...' : allApplied ? 'All Applied' : 'Apply All Resolutions'}
        </button>
      </div>

      {/* Content */}
      <div className={styles.duplicatesContent}>
        {albumGroups.map(group => {
          const isCollapsed = collapsed.has(group.album_id);
          const albumPendingCount = group.conflicts.filter(c => 
            !applied.has(`${c.album_id}-${c.field_name}`)
          ).length;
          
          return (
            <div key={group.album_id} style={{ marginBottom: '8px' }}>
              {/* Album Header */}
              <div style={{
                background: '#f3f4f6',
                padding: '12px 16px',
                borderBottom: '1px solid #e5e7eb',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={() => toggleCollapse(group.album_id)}
                    className={styles.duplicatesCollapseButton}
                  >
                    {isCollapsed ? '▶' : '▼'}
                  </button>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827', marginBottom: '4px' }}>
                      {group.artist} - {group.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <span>Format: {group.format}</span>
                      {group.cat_no && <span>Cat: {group.cat_no}</span>}
                      {group.barcode && <span>Barcode: {group.barcode}</span>}
                      {group.country && <span>Country: {group.country}</span>}
                      {group.year && <span>Year: {group.year}</span>}
                      {group.labels.length > 0 && <span>Labels: {group.labels.join(', ')}</span>}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>
                      {albumPendingCount} pending
                    </span>
                    <button
                      onClick={() => acceptAllForAlbum(group.album_id)}
                      disabled={isProcessing || albumPendingCount === 0}
                      style={{
                        background: albumPendingCount === 0 ? '#d1d5db' : '#4FC3F7',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: albumPendingCount === 0 ? 'not-allowed' : 'pointer',
                        borderRadius: '4px',
                      }}
                    >
                      {albumPendingCount === 0 ? 'All Applied' : 'Accept All for This Album'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Conflicts List */}
              {!isCollapsed && (
                <div style={{ background: 'white' }}>
                  {group.conflicts.map(conflict => {
                    const key = `${conflict.album_id}-${conflict.field_name}`;
                    const isApplied = applied.has(key);
                    const currentResolution = resolutions[key];
                    const isMergeable = canMergeField(conflict.current_value) && canMergeField(conflict.new_value);
                    const isTracksField = conflict.field_name === 'tracks';
                    const isExpanded = expandedConflicts.has(key);

                    return (
                      <div
                        key={conflict.field_name}
                        style={{
                          padding: '16px',
                          borderBottom: '1px solid #f3f4f6',
                          background: isApplied ? '#f0fdf4' : 'white',
                        }}
                      >
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: '#111827', marginBottom: '8px' }}>
                            {getFieldDisplayName(conflict.field_name)}
                            {isApplied && (
                              <span style={{ marginLeft: '8px', color: '#059669', fontSize: '12px' }}>
                                ✓ Applied
                              </span>
                            )}
                          </div>
                          
                          {/* Specialized track comparison */}
                          {isTracksField ? (
                            renderTrackComparison(
                              conflict.current_value as Track[] | null,
                              conflict.new_value as Track[] | null,
                              key,
                              isExpanded
                            )
                          ) : (
                            <>
                              <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                                <div style={{ color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>Current DB:</div>
                                <div style={{ color: '#111827', marginLeft: '8px' }}>
                                  {renderValue(conflict.current_value, `${key}-current`, expandedConflicts.has(`${key}-current`))}
                                </div>
                              </div>
                              
                              <div style={{ fontSize: '13px', marginBottom: '12px' }}>
                                <div style={{ color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>New {source.toUpperCase()}:</div>
                                <div style={{ color: '#111827', marginLeft: '8px' }}>
                                  {renderValue(conflict.new_value, `${key}-new`, expandedConflicts.has(`${key}-new`))}
                                </div>
                              </div>
                            </>
                          )}

                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px' }}>
                            <select
                              value={currentResolution}
                              onChange={(e) => updateResolution(
                                conflict.album_id,
                                conflict.field_name,
                                e.target.value as ResolutionStrategy
                              )}
                              disabled={isApplied || isProcessing}
                              style={{
                                padding: '6px 12px',
                                fontSize: '13px',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                background: isApplied ? '#f3f4f6' : 'white',
                                cursor: isApplied ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <option value="keep_current">Keep Current</option>
                              <option value="use_new">Use New</option>
                              {isMergeable && <option value="merge">Smart Merge</option>}
                            </select>

                            <button
                              onClick={() => applyConflict(conflict)}
                              disabled={isApplied || isProcessing}
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}