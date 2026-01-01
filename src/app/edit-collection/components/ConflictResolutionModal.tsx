// src/app/edit-collection/components/ConflictResolutionModal.tsx
import React, { useState } from 'react';
import { 
  type FieldConflict, 
  getFieldDisplayName, 
  formatValueForDisplay, 
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [resolutions, setResolutions] = useState<Map<string, 'current' | 'new' | 'merge'>>(new Map());
  const [appliedConflicts, setAppliedConflicts] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  // Generate unique ID for conflict
  const getConflictId = (conflict: FieldConflict): string => {
    return `${conflict.album_id}-${conflict.field_name}`;
  };

  // Group conflicts by album
  const groupedConflicts = conflicts.reduce((acc, conflict) => {
    const key = `${conflict.artist} - ${conflict.title}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(conflict);
    return acc;
  }, {} as Record<string, FieldConflict[]>);

  // Toggle group expansion
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

  // Handle resolution selection
  const handleResolutionChange = (conflictId: string, resolution: 'current' | 'new' | 'merge'): void => {
    setResolutions(prev => new Map(prev).set(conflictId, resolution));
  };

  // Map UI resolution to library ResolutionStrategy
  const mapToResolutionStrategy = (uiResolution: 'current' | 'new' | 'merge'): 'keep_current' | 'use_new' | 'merge' => {
    if (uiResolution === 'current') return 'keep_current';
    if (uiResolution === 'new') return 'use_new';
    return 'merge';
  };

  // Apply conflict resolution to database
  const handleApplyConflict = async (conflict: FieldConflict): Promise<void> => {
    const conflictId = getConflictId(conflict);
    const resolution = resolutions.get(conflictId) || 'current';
    const strategyResolution = mapToResolutionStrategy(resolution);
    
    setIsProcessing(true);
    
    try {
      // Determine final value
      let finalValue: unknown;
      
      if (strategyResolution === 'merge' && conflict.field_name === 'tracks') {
        // Special handling for track merging
        finalValue = smartMergeTracks(
          conflict.current_value as Track[] | null,
          conflict.new_value as Track[] | null
        );
      } else {
        finalValue = applyResolution(conflict.current_value, conflict.new_value, strategyResolution);
      }
      
      // Update album in database
      const { error: updateError } = await supabase
        .from('collection')
        .update({ [conflict.field_name]: finalValue })
        .eq('id', conflict.album_id);
      
      if (updateError) throw updateError;
      
      // Save resolution to history
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
      
      // Mark as applied in UI
      setAppliedConflicts(prev => new Set([...prev, conflictId]));
    } catch (error) {
      console.error('Error applying conflict resolution:', error);
      alert('Error applying resolution. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Format value for display
  const formatValue = (value: unknown): string => {
    return formatValueForDisplay(value);
  };

  return (
    <div className={styles.duplicatesWrapper}>
      {/* Header */}
      <div className={styles.duplicatesNav}>
        <button onClick={onCancel} className={styles.duplicatesBackButton}>
          ◀ Back
        </button>
        <h1 className={styles.duplicatesTitle}>Resolve Import Conflicts</h1>
      </div>

      {/* Toolbar */}
      <div className={styles.duplicatesToolbar}>
        <div className={styles.duplicatesToolbarLabel}>
          {conflicts.length} conflicts found across {Object.keys(groupedConflicts).length} albums
        </div>
        <div className={styles.duplicatesToolbarSpacer} />
        <button onClick={onComplete} className={styles.duplicatesFindButton}>
          Complete
        </button>
      </div>

      {/* Content */}
      <div className={styles.duplicatesContent}>
        <div className={styles.duplicatesTableWrapper}>
          <table className={styles.duplicatesTable}>
            <thead>
              <tr className={styles.duplicatesTableHeaderRow}>
                <th className={styles.duplicatesTableHeaderCell}>Artist</th>
                <th className={styles.duplicatesTableHeaderCell}>Title</th>
                <th className={styles.duplicatesTableHeaderCell}>Format</th>
                <th className={styles.duplicatesTableHeaderCell}>Barcode</th>
                <th className={styles.duplicatesTableHeaderCell}>Cat No</th>
                <th className={styles.duplicatesTableHeaderCell}>Country</th>
                <th className={styles.duplicatesTableHeaderCell}>Year</th>
                <th className={styles.duplicatesTableHeaderCell}>Labels</th>
                <th className={styles.duplicatesTableHeaderCell}>Field</th>
                <th className={styles.duplicatesTableHeaderCell}>Current Value</th>
                <th className={styles.duplicatesTableHeaderCell}>New Value</th>
                <th className={styles.duplicatesTableHeaderCell}>Resolution</th>
                <th className={styles.duplicatesTableHeaderCell}>Action</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedConflicts).map(([albumKey, albumConflicts]) => {
                const isExpanded = expandedGroups.has(albumKey);
                
                return (
                  <React.Fragment key={albumKey}>
                    {/* Group Header */}
                    <tr className={styles.duplicatesGroupRow}>
                      <td colSpan={13} className={styles.duplicatesGroupCell}>
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

                    {/* Conflict Rows */}
                    {isExpanded && albumConflicts.map((conflict) => {
                      const conflictId = getConflictId(conflict);
                      const isApplied = appliedConflicts.has(conflictId);
                      const resolution = resolutions.get(conflictId) || 'current';
                      const canMerge = canMergeField(conflict.current_value) && canMergeField(conflict.new_value);

                      return (
                        <tr key={conflictId} className={styles.duplicatesAlbumRow}>
                          <td className={styles.duplicatesTableCell}>{conflict.artist}</td>
                          <td className={styles.duplicatesTableCell}>{conflict.title}</td>
                          <td className={styles.duplicatesTableCell}>{conflict.format}</td>
                          <td className={styles.duplicatesTableCell}>{conflict.barcode || '—'}</td>
                          <td className={styles.duplicatesTableCell}>{conflict.cat_no || '—'}</td>
                          <td className={styles.duplicatesTableCell}>{conflict.country || '—'}</td>
                          <td className={styles.duplicatesTableCell}>{conflict.year || '—'}</td>
                          <td className={styles.duplicatesTableCell}>
                            {conflict.labels.length > 0 ? conflict.labels.join(', ') : '—'}
                          </td>
                          <td className={styles.duplicatesTableCell}>
                            {getFieldDisplayName(conflict.field_name)}
                          </td>
                          <td className={styles.duplicatesTableCell}>
                            {formatValue(conflict.current_value)}
                          </td>
                          <td className={styles.duplicatesTableCell}>
                            {formatValue(conflict.new_value)}
                          </td>
                          <td className={styles.duplicatesTableCell}>
                            <select
                              value={resolution}
                              onChange={(e) => handleResolutionChange(conflictId, e.target.value as 'current' | 'new' | 'merge')}
                              disabled={isApplied}
                            >
                              <option value="current">Keep Current</option>
                              <option value="new">Use New</option>
                              {canMerge && <option value="merge">Merge</option>}
                            </select>
                          </td>
                          <td className={styles.duplicatesTableCell}>
                            <button
                              onClick={() => handleApplyConflict(conflict)}
                              disabled={isApplied || isProcessing}
                              className={styles.duplicatesKeepButton}
                            >
                              {isApplied ? 'Applied' : 'Apply'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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