// src/app/edit-collection/components/ConflictResolutionModal.tsx
import React, { useState } from 'react';
import { 
  type FieldConflict, 
  getFieldDisplayName, 
  canMergeField,
  applyResolution,
  getRejectedValue,
  smartMergeTracks,
  type Track,
} from 'lib/conflictDetection';
import { supabase } from 'lib/supabaseClient';
import styles from '../EditCollection.module.css';

interface ConflictResolutionModalProps {
  conflicts: FieldConflict[];
  source: 'clz' | 'discogs';
  onComplete: () => void;
  onCancel: () => void;
}

export default function ConflictResolutionModal({
  conflicts,
  source,
  onComplete,
  onCancel,
}: ConflictResolutionModalProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(
    Object.keys(conflicts.reduce((acc, conflict) => {
      const key = `${conflict.artist} - ${conflict.title}`;
      acc[key] = true;
      return acc;
    }, {} as Record<string, boolean>))
  ));
  const [resolutions, setResolutions] = useState<Map<string, 'current' | 'new' | 'merge'>>(new Map());
  const [appliedConflicts, setAppliedConflicts] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const getConflictId = (conflict: FieldConflict): string => {
    return `${conflict.album_id}-${conflict.field_name}`;
  };

  const groupedConflicts = conflicts.reduce((acc, conflict) => {
    const key = `${conflict.artist} - ${conflict.title}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(conflict);
    return acc;
  }, {} as Record<string, FieldConflict[]>);

  const toggleGroupExpanded = (albumKey: string): void => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(albumKey)) {
        next.delete(albumKey);
      } else {
        next.add(albumKey);
      }
      return next;
    });
  };

  const handleApplyResolution = async (conflict: FieldConflict, resolution: 'current' | 'new' | 'merge'): Promise<void> => {
    const conflictId = getConflictId(conflict);
    
    // Set the resolution state for visual feedback
    setResolutions(prev => new Map(prev).set(conflictId, resolution));
    setIsProcessing(true);
    
    try {
      const strategyResolution = mapToResolutionStrategy(resolution);
      let finalValue: unknown;
      
      if (strategyResolution === 'merge' && conflict.field_name === 'tracks') {
        finalValue = smartMergeTracks(
          conflict.current_value as Track[] | null,
          conflict.new_value as Track[] | null
        );
      } else {
        finalValue = applyResolution(conflict.current_value, conflict.new_value, strategyResolution);
      }
      
      const { error: updateError } = await supabase
        .from('collection')
        .update({ [conflict.field_name]: finalValue })
        .eq('id', conflict.album_id);
      
      if (updateError) throw updateError;
      
      const rejectedValue = getRejectedValue(conflict.current_value, conflict.new_value, strategyResolution);
      
      const { error: resolutionError } = await supabase
        .from('import_conflict_resolutions')
        .insert({
          album_id: conflict.album_id,
          field_name: conflict.field_name,
          kept_value: finalValue,
          rejected_value: rejectedValue,
          resolution: strategyResolution,
          source: source,
        });
      
      if (resolutionError) throw resolutionError;
      
      setAppliedConflicts(prev => new Set([...prev, conflictId]));
    } catch (error) {
      console.error('Error applying conflict resolution:', error);
      alert('Error applying resolution. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const mapToResolutionStrategy = (uiResolution: 'current' | 'new' | 'merge'): 'keep_current' | 'use_new' | 'merge' => {
    if (uiResolution === 'current') return 'keep_current';
    if (uiResolution === 'new') return 'use_new';
    return 'merge';
  };

  const renderValue = (value: unknown): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>None</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Empty</span>;
      }

      const firstItem = value[0];
      if (typeof firstItem === 'object' && firstItem !== null && 'position' in firstItem && 'title' in firstItem) {
        return (
          <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
            {value.map((track: unknown, idx: number) => {
              const t = track as Record<string, unknown>;
              return (
                <div key={idx} style={{ marginBottom: '4px' }}>
                  {String(t.position)}. {String(t.title)}
                  {t.artist && <span style={{ color: '#666' }}> - {String(t.artist)}</span>}
                  {t.duration && <span style={{ color: '#999' }}> ({String(t.duration)})</span>}
                </div>
              );
            })}
          </div>
        );
      }

      if (typeof firstItem === 'string') {
        return (
          <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
            {value.map((item: string, idx: number) => (
              <div key={idx}>{item}</div>
            ))}
          </div>
        );
      }

      return <pre style={{ fontSize: '12px', margin: 0 }}>{JSON.stringify(value, null, 2)}</pre>;
    }

    if (typeof value === 'object') {
      return <pre style={{ fontSize: '12px', margin: 0 }}>{JSON.stringify(value, null, 2)}</pre>;
    }

    if (typeof value === 'boolean') {
      return <span>{value ? 'Yes' : 'No'}</span>;
    }

    return <span>{String(value)}</span>;
  };

  return (
    <div className={styles.duplicatesWrapper}>
      <div className={styles.duplicatesNav}>
        <button onClick={onCancel} className={styles.duplicatesBackButton}>
          ◀ Back
        </button>
        <h1 className={styles.duplicatesTitle}>Resolve Import Conflicts</h1>
      </div>

      <div className={styles.duplicatesToolbar}>
        <div className={styles.duplicatesToolbarLabel}>
          {conflicts.length} conflicts found across {Object.keys(groupedConflicts).length} albums
        </div>
        <div className={styles.duplicatesToolbarSpacer} />
        <button onClick={onComplete} className={styles.duplicatesFindButton}>
          Complete
        </button>
      </div>

      <div className={styles.duplicatesContent}>
        <div className={styles.duplicatesTableWrapper}>
          <table className={styles.duplicatesTable}>
            <tbody>
              {Object.entries(groupedConflicts).map(([albumKey, albumConflicts], groupIdx) => {
                const isExpanded = expandedGroups.has(albumKey);
                const firstConflict = albumConflicts[0];

                return (
                  <React.Fragment key={albumKey}>
                    {/* Album Group Header */}
                    <tr className={styles.duplicatesGroupRow}>
                      <td colSpan={8} className={styles.duplicatesGroupCell}>
                        <div className={styles.duplicatesGroupHeader}>
                          <button
                            onClick={() => toggleGroupExpanded(albumKey)}
                            className={styles.duplicatesCollapseButton}
                          >
                            {isExpanded ? '−' : '+'}
                          </button>
                          <div className={styles.duplicatesGroupName}>{albumKey}</div>
                          <div className={styles.duplicatesGroupActions}>
                            {albumConflicts.length} field{albumConflicts.length !== 1 ? 's' : ''} in conflict
                          </div>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <>
                        {/* Identifying Data Header Row */}
                        <tr className={styles.duplicatesTableHeaderRow}>
                          <th className={styles.duplicatesTableHeaderCell}>Artist</th>
                          <th className={styles.duplicatesTableHeaderCell}>Title</th>
                          <th className={styles.duplicatesTableHeaderCell}>Format</th>
                          <th className={styles.duplicatesTableHeaderCell}>Barcode</th>
                          <th className={styles.duplicatesTableHeaderCell}>Cat No</th>
                          <th className={styles.duplicatesTableHeaderCell}>Country</th>
                          <th className={styles.duplicatesTableHeaderCell}>Year</th>
                          <th className={styles.duplicatesTableHeaderCell}>Labels</th>
                        </tr>

                        {/* Identifying Data Values Row */}
                        <tr className={styles.duplicatesAlbumRow}>
                          <td className={styles.duplicatesTableCell}>{firstConflict.artist}</td>
                          <td className={styles.duplicatesTableCell}>{firstConflict.title}</td>
                          <td className={styles.duplicatesTableCell}>{firstConflict.format}</td>
                          <td className={styles.duplicatesTableCell}>{firstConflict.barcode || '—'}</td>
                          <td className={styles.duplicatesTableCell}>{firstConflict.cat_no || '—'}</td>
                          <td className={styles.duplicatesTableCell}>{firstConflict.country || '—'}</td>
                          <td className={styles.duplicatesTableCell}>{firstConflict.year || '—'}</td>
                          <td className={styles.duplicatesTableCell}>
                            {firstConflict.labels.length > 0 ? firstConflict.labels.join(', ') : '—'}
                          </td>
                        </tr>

                        {/* Each Conflict */}
                        {albumConflicts.map((conflict) => {
                          const conflictId = getConflictId(conflict);
                          const isApplied = appliedConflicts.has(conflictId);
                          const resolution = resolutions.get(conflictId) || 'current';
                          const canMerge = canMergeField(conflict.current_value) && canMergeField(conflict.new_value);

                          return (
                            <React.Fragment key={conflictId}>
                              {/* Field Name Row */}
                              <tr className={styles.duplicatesAlbumRow}>
                                <td colSpan={8} className={styles.duplicatesTableCell}>
                                  <strong>Field: {getFieldDisplayName(conflict.field_name)}</strong>
                                </td>
                              </tr>

                              {/* Content Comparison Row */}
                              <tr className={styles.duplicatesAlbumRow}>
                                <td colSpan={4} className={styles.duplicatesTableCell}>
                                  <div style={{ fontWeight: 600, marginBottom: '8px', color: '#374151' }}>
                                    Current Database Value
                                  </div>
                                  <div style={{ padding: '8px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
                                    {renderValue(conflict.current_value)}
                                  </div>
                                </td>
                                <td colSpan={4} className={styles.duplicatesTableCell}>
                                  <div style={{ fontWeight: 600, marginBottom: '8px', color: '#374151' }}>
                                    New {source === 'clz' ? 'CLZ' : 'Discogs'} Value
                                  </div>
                                  <div style={{ padding: '8px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
                                    {renderValue(conflict.new_value)}
                                  </div>
                                </td>
                              </tr>

                              {/* Decision Row */}
                              <tr className={styles.duplicatesAlbumRow}>
                                <td colSpan={8} className={styles.duplicatesTableCell}>
                                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '8px 0' }}>
                                    <button
                                      onClick={() => handleApplyResolution(conflict, 'current')}
                                      disabled={isApplied || isProcessing}
                                      style={{
                                        padding: '8px 16px',
                                        backgroundColor: resolution === 'current' ? '#4CAF50' : 'white',
                                        color: resolution === 'current' ? 'white' : '#000',
                                        border: '1px solid #000',
                                        borderRadius: '4px',
                                        cursor: (isApplied || isProcessing) ? 'not-allowed' : 'pointer',
                                        fontWeight: resolution === 'current' ? 600 : 400,
                                        opacity: (isApplied || isProcessing) ? 0.5 : 1,
                                      }}
                                    >
                                      {isApplied && resolution === 'current' ? '✓ Kept' : 'Keep Existing'}
                                    </button>
                                    <button
                                      onClick={() => handleApplyResolution(conflict, 'new')}
                                      disabled={isApplied || isProcessing}
                                      style={{
                                        padding: '8px 16px',
                                        backgroundColor: resolution === 'new' ? '#4CAF50' : 'white',
                                        color: resolution === 'new' ? 'white' : '#000',
                                        border: '1px solid #000',
                                        borderRadius: '4px',
                                        cursor: (isApplied || isProcessing) ? 'not-allowed' : 'pointer',
                                        fontWeight: resolution === 'new' ? 600 : 400,
                                        opacity: (isApplied || isProcessing) ? 0.5 : 1,
                                      }}
                                    >
                                      {isApplied && resolution === 'new' ? '✓ Replaced' : 'Replace with New'}
                                    </button>
                                    {canMerge && (
                                      <button
                                        onClick={() => handleApplyResolution(conflict, 'merge')}
                                        disabled={isApplied || isProcessing}
                                        style={{
                                          padding: '8px 16px',
                                          backgroundColor: resolution === 'merge' ? '#4CAF50' : 'white',
                                          color: resolution === 'merge' ? 'white' : '#000',
                                          border: '1px solid #000',
                                          borderRadius: '4px',
                                          cursor: (isApplied || isProcessing) ? 'not-allowed' : 'pointer',
                                          fontWeight: resolution === 'merge' ? 600 : 400,
                                          opacity: (isApplied || isProcessing) ? 0.5 : 1,
                                        }}
                                      >
                                        {isApplied && resolution === 'merge' ? '✓ Merged' : 'Merge Data'}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </>
                    )}

                    {/* Spacer Row */}
                    {groupIdx < Object.keys(groupedConflicts).length - 1 && (
                      <tr className={styles.duplicatesSeparator}>
                        <td colSpan={8}></td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}