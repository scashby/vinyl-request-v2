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
  const isMissingResolutionTable = (err?: { message?: string; code?: string } | null) => {
    if (!err) return false;
    if (err.code === '42P01') return true;
    return err.message?.includes('import_conflict_resolutions') ?? false;
  };

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

  const handleResolutionChange = (conflictId: string, resolution: 'current' | 'new' | 'merge'): void => {
    setResolutions(prev => new Map(prev).set(conflictId, resolution));
  };

  const mapToResolutionStrategy = (uiResolution: 'current' | 'new' | 'merge'): 'keep_current' | 'use_new' | 'merge' => {
    if (uiResolution === 'current') return 'keep_current';
    if (uiResolution === 'new') return 'use_new';
    return 'merge';
  };

  const handleApplyConflict = async (conflict: FieldConflict): Promise<void> => {
    const conflictId = getConflictId(conflict);
    const resolution = resolutions.get(conflictId) || 'current';
    const strategyResolution = mapToResolutionStrategy(resolution);
    
    setIsProcessing(true);
    
    try {
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

      if (resolutionError && !isMissingResolutionTable(resolutionError)) {
        throw resolutionError;
      }
      
      setAppliedConflicts(prev => new Set([...prev, conflictId]));
    } catch (error) {
      console.error('Error applying conflict resolution:', error);
      alert('Error applying resolution. Please try again.');
    } finally {
      setIsProcessing(false);
    }
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
    <div className="fixed inset-0 bg-white z-[30000] flex flex-col overflow-hidden">
      <div className="bg-[#2C2C2C] h-[50px] px-5 flex items-center gap-4 shrink-0">
        <button onClick={onCancel} className="bg-transparent border-none text-white text-sm cursor-pointer p-2 flex items-center hover:opacity-80">
          ◀ Back
        </button>
        <h1 className="text-base font-semibold text-white leading-none m-0 p-0">Resolve Import Conflicts</h1>
      </div>

      <div className="bg-[#2C2C2C] text-white h-[56px] px-5 flex items-center gap-3 shrink-0 border-b border-[#444]">
        <div className="text-sm text-white whitespace-nowrap">
          {conflicts.length} conflicts found across {Object.keys(groupedConflicts).length} albums
        </div>
        <div className="flex-1" />
        <button onClick={onComplete} className="bg-[#4FC3F7] text-white border-none px-4 py-1.5 text-sm font-medium cursor-pointer rounded hover:bg-[#29B6F6]">
          Complete
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-white relative">
        <div className="p-0">
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              {Object.entries(groupedConflicts).map(([albumKey, albumConflicts], groupIdx) => {
                const isExpanded = expandedGroups.has(albumKey);
                const firstConflict = albumConflicts[0];

                return (
                  <React.Fragment key={albumKey}>
                    {/* Album Group Header */}
                    <tr className="bg-[#e5e7eb]">
                      <td colSpan={8} className="p-0">
                        <div className="flex items-center justify-between px-3 py-2.5">
                          <button
                            onClick={() => toggleGroupExpanded(albumKey)}
                            className="bg-transparent border-none text-[#666] text-xs cursor-pointer p-1 flex items-center justify-center w-5 h-5 shrink-0 hover:text-black"
                          >
                            {isExpanded ? '−' : '+'}
                          </button>
                          <div className="font-bold text-black flex-1 ml-1">{albumKey}</div>
                          <div className="text-sm text-gray-600">
                            {albumConflicts.length} field{albumConflicts.length !== 1 ? 's' : ''} in conflict
                          </div>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <>
                        {/* Identifying Data Header Row */}
                        <tr className="bg-[#f3f4f6]">
                          <th className="px-3 py-2.5 text-left font-bold text-black border-x border-l-black border-r-black border-b border-b-gray-200">Artist</th>
                          <th className="px-3 py-2.5 text-left font-bold text-black border-x border-l-black border-r-black border-b border-b-gray-200">Title</th>
                          <th className="px-3 py-2.5 text-left font-bold text-black border-x border-l-black border-r-black border-b border-b-gray-200">Format</th>
                          <th className="px-3 py-2.5 text-left font-bold text-black border-x border-l-black border-r-black border-b border-b-gray-200">Barcode</th>
                          <th className="px-3 py-2.5 text-left font-bold text-black border-x border-l-black border-r-black border-b border-b-gray-200">Cat No</th>
                          <th className="px-3 py-2.5 text-left font-bold text-black border-x border-l-black border-r-black border-b border-b-gray-200">Country</th>
                          <th className="px-3 py-2.5 text-left font-bold text-black border-x border-l-black border-r-black border-b border-b-gray-200">Year</th>
                          <th className="px-3 py-2.5 text-left font-bold text-black border-x border-l-black border-r-black border-b border-b-gray-200">Labels</th>
                        </tr>

                        {/* Identifying Data Values Row */}
                        <tr className="bg-white">
                          <td className="px-3 py-2 border border-black text-black bg-white align-top">{firstConflict.artist}</td>
                          <td className="px-3 py-2 border border-black text-black bg-white align-top">{firstConflict.title}</td>
                          <td className="px-3 py-2 border border-black text-black bg-white align-top">{firstConflict.format}</td>
                          <td className="px-3 py-2 border border-black text-black bg-white align-top">{firstConflict.barcode || '—'}</td>
                          <td className="px-3 py-2 border border-black text-black bg-white align-top">{firstConflict.cat_no || '—'}</td>
                          <td className="px-3 py-2 border border-black text-black bg-white align-top">{firstConflict.country || '—'}</td>
                          <td className="px-3 py-2 border border-black text-black bg-white align-top">{firstConflict.year || '—'}</td>
                          <td className="px-3 py-2 border border-black text-black bg-white align-top">
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
                              <tr className="bg-white">
                                <td colSpan={8} className="px-3 py-2 border border-black text-black bg-white align-top">
                                  <strong>Field: {getFieldDisplayName(conflict.field_name)}</strong>
                                </td>
                              </tr>

                              {/* Content Comparison Row */}
                              <tr className="bg-white">
                                <td colSpan={4} className="px-3 py-2 border border-black text-black bg-white align-top">
                                  <div className="font-semibold mb-2 text-gray-700">
                                    Current Database Value
                                  </div>
                                  <div className="p-2 bg-gray-50 rounded">
                                    {renderValue(conflict.current_value)}
                                  </div>
                                </td>
                                <td colSpan={4} className="px-3 py-2 border border-black text-black bg-white align-top">
                                  <div className="font-semibold mb-2 text-gray-700">
                                    New {source === 'clz' ? 'CLZ' : 'Discogs'} Value
                                  </div>
                                  <div className="p-2 bg-gray-50 rounded">
                                    {renderValue(conflict.new_value)}
                                  </div>
                                </td>
                              </tr>

                              {/* Decision Row */}
                              <tr className="bg-white">
                                <td colSpan={8} className="px-3 py-2 border border-black text-black bg-white align-top">
                                  <div className="flex gap-3 items-center py-2">
                                    <button
                                      onClick={() => handleResolutionChange(conflictId, 'current')}
                                      disabled={isApplied}
                                      className={`px-4 py-2 border border-black rounded text-sm cursor-pointer transition-opacity ${
                                        resolution === 'current' ? 'bg-[#E3F2FD] font-semibold' : 'bg-white font-normal'
                                      } ${isApplied ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                      Keep Existing
                                    </button>
                                    <button
                                      onClick={() => handleResolutionChange(conflictId, 'new')}
                                      disabled={isApplied}
                                      className={`px-4 py-2 border border-black rounded text-sm cursor-pointer transition-opacity ${
                                        resolution === 'new' ? 'bg-[#E3F2FD] font-semibold' : 'bg-white font-normal'
                                      } ${isApplied ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                      Replace with New
                                    </button>
                                    {canMerge && (
                                      <button
                                        onClick={() => handleResolutionChange(conflictId, 'merge')}
                                        disabled={isApplied}
                                        className={`px-4 py-2 border border-black rounded text-sm cursor-pointer transition-opacity ${
                                          resolution === 'merge' ? 'bg-[#E3F2FD] font-semibold' : 'bg-white font-normal'
                                        } ${isApplied ? 'opacity-50 cursor-not-allowed' : ''}`}
                                      >
                                        Merge Data
                                      </button>
                                    )}
                                    <div className="ml-auto">
                                      <button
                                        onClick={() => handleApplyConflict(conflict)}
                                        disabled={isApplied || isProcessing}
                                        className="bg-[#4FC3F7] text-white border-none px-3 py-1.5 text-[13px] font-medium cursor-pointer rounded hover:bg-[#29B6F6] disabled:opacity-60 disabled:cursor-not-allowed"
                                      >
                                        {isApplied ? 'Applied' : 'Apply'}
                                      </button>
                                    </div>
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
                      <tr className="h-2 bg-[#f3f4f6]">
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
