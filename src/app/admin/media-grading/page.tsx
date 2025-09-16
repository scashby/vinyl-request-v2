// src/app/admin/media-grading/page.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface MediaItem {
  id: number;
  conditions: Record<string, boolean>;
  severities: Record<string, string>;
  skipSides: string[];
  tracksAffected: number;
}

export default function MediaGradingPage() {
  const [currentMedia, setCurrentMedia] = useState<'vinyl' | 'cassette' | 'cd' | ''>('');
  const [mediaMissing, setMediaMissing] = useState(false);
  const [packageMissing, setPackageMissing] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([{ id: 1, conditions: {}, severities: {}, skipSides: [], tracksAffected: 0 }]);
  const [sleeveConditions, setSleeveConditions] = useState<Record<string, boolean>>({});
  const [sleeveSeverities, setSleeveSeverities] = useState<Record<string, string>>({});
  const [customNotes, setCustomNotes] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState<Record<string, boolean>>({});
  const [albumInfo, setAlbumInfo] = useState({
    artist: '',
    title: '',
    catalog: '',
    year: ''
  });
  const [showResults, setShowResults] = useState(false);
  const [activeSeverities, setActiveSeverities] = useState<Record<string, boolean>>({});

  const selectMedia = (mediaType: 'vinyl' | 'cassette' | 'cd') => {
    setCurrentMedia(mediaType);
    resetForm();
  };

  const resetForm = () => {
    setMediaMissing(false);
    setPackageMissing(false);
    setMediaItems([{ id: 1, conditions: {}, severities: {}, skipSides: [], tracksAffected: 0 }]);
    setSleeveConditions({});
    setSleeveSeverities({});
    setCustomNotes('');
    setAdditionalNotes({});
    setAlbumInfo({ artist: '', title: '', catalog: '', year: '' });
    setShowResults(false);
    setActiveSeverities({});
  };

  const toggleMissingComponents = (type: 'media' | 'package') => {
    if (type === 'media') {
      setMediaMissing(!mediaMissing);
      if (!mediaMissing) setPackageMissing(false);
    } else {
      setPackageMissing(!packageMissing);
      if (!packageMissing) setMediaMissing(false);
    }
  };

  const toggleSeverity = (conditionKey: string, checked: boolean) => {
    setActiveSeverities(prev => ({
      ...prev,
      [conditionKey]: checked
    }));
  };

  const updateMediaCondition = (itemId: number, conditionKey: string, checked: boolean) => {
    setMediaItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, conditions: { ...item.conditions, [conditionKey]: checked } }
        : item
    ));
    
    // Toggle severity options
    const severityKey = `${conditionKey}-severity-${itemId}`;
    toggleSeverity(severityKey, checked);
  };

  const updateMediaSeverity = (itemId: number, severityGroup: string, value: string) => {
    setMediaItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, severities: { ...item.severities, [severityGroup]: value } }
        : item
    ));
  };

  const updateSleeveCondition = (conditionKey: string, checked: boolean) => {
    setSleeveConditions(prev => ({ ...prev, [conditionKey]: checked }));
    toggleSeverity(`${conditionKey}-severity`, checked);
  };

  const updateSleeveSeverity = (severityGroup: string, value: string) => {
    setSleeveSeverities(prev => ({ ...prev, [severityGroup]: value }));
  };

  const addAnotherRecord = () => {
    const newId = Math.max(...mediaItems.map(item => item.id)) + 1;
    setMediaItems(prev => [...prev, { id: newId, conditions: {}, severities: {}, skipSides: [], tracksAffected: 0 }]);
  };

  const removeMediaItem = (itemId: number) => {
    setMediaItems(prev => prev.filter(item => item.id !== itemId));
  };

  const calculateGrades = () => {
    setShowResults(true);
    // Scroll to results
    setTimeout(() => {
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const exportListing = () => {
    alert('Export feature - will copy formatted listing to clipboard');
  };

  const getEvaluationSectionStyle = (disabled: boolean) => ({
    opacity: disabled ? 0.3 : 1,
    pointerEvents: disabled ? 'none' as const : 'auto' as const
  });

  return (
    <div style={{ 
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      lineHeight: 1.6,
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      padding: 20
    }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        background: 'white',
        borderRadius: 20,
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
          color: 'white',
          padding: 30,
          textAlign: 'center'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link
              href="/admin/admin-dashboard"
              style={{
                background: 'rgba(255,255,255,0.2)',
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
            <div>
              <h1 style={{ fontSize: '2.5rem', margin: '0 0 10px 0', textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
                🔍 Systematic Media Grading Tool
              </h1>
              <p style={{ fontSize: '1.1rem', opacity: 0.9, margin: 0 }}>
                Detailed condition assessment with automatic grading calculation
              </p>
            </div>
            <div style={{ width: 120 }}></div>
          </div>
        </div>

        <div style={{ padding: 40 }}>
          {/* Media Selector */}
          <div style={{ marginBottom: 30, textAlign: 'center' }}>
            <h2>Select Media Type</h2>
            <div style={{ display: 'flex', gap: 15, justifyContent: 'center', flexWrap: 'wrap' }}>
              {[
                { type: 'vinyl' as const, label: '🎵 Vinyl Records' },
                { type: 'cassette' as const, label: '📼 Cassette Tapes' },
                { type: 'cd' as const, label: '💿 Compact Discs' }
              ].map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => selectMedia(type)}
                  style={{
                    background: currentMedia === type 
                      ? 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)'
                      : 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '15px 30px',
                    borderRadius: 50,
                    fontSize: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 5px 15px rgba(0,0,0,0.1)'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {currentMedia && (
            <>
              {/* Missing Components Check */}
              <div style={{
                background: '#fff3cd',
                border: '2px solid #ffc107',
                borderRadius: 15,
                padding: 20,
                marginBottom: 30
              }}>
                <h3 style={{ color: '#856404', marginBottom: 15 }}>
                  ⚠️ Missing Components Check (Check First!)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div style={{ background: 'white', padding: 15, borderRadius: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={mediaMissing}
                        onChange={() => toggleMissingComponents('media')}
                        style={{ transform: 'scale(1.1)' }}
                      />
                      <div>
                        <div style={{ fontWeight: 'bold' }}>Media Missing (Cover/Insert Only)</div>
                        <div style={{ fontSize: '0.9rem', color: '#666', marginTop: 5 }}>
                          Only evaluating packaging - no disc/tape/record present
                        </div>
                      </div>
                    </label>
                  </div>
                  <div style={{ background: 'white', padding: 15, borderRadius: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={packageMissing}
                        onChange={() => toggleMissingComponents('package')}
                        style={{ transform: 'scale(1.1)' }}
                      />
                      <div>
                        <div style={{ fontWeight: 'bold' }}>Cover/Insert/J-Card Missing (Media Only)</div>
                        <div style={{ fontSize: '0.9rem', color: '#666', marginTop: 5 }}>
                          Only evaluating media - no packaging present
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Vinyl Assessment */}
              {currentMedia === 'vinyl' && (
                <div>
                  <h2>Vinyl Record Assessment</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, marginBottom: 30 }}>
                    
                    {/* Record Condition Assessment */}
                    <div style={{
                      background: '#f8f9fa',
                      borderRadius: 15,
                      padding: 25,
                      border: '2px solid transparent',
                      transition: 'all 0.3s ease',
                      ...getEvaluationSectionStyle(mediaMissing)
                    }}>
                      <div style={{
                        fontSize: '1.3rem',
                        fontWeight: 'bold',
                        color: '#2c3e50',
                        marginBottom: 20,
                        textAlign: 'center',
                        padding: 10,
                        background: 'white',
                        borderRadius: 10
                      }}>
                        🎵 Record Condition Assessment
                      </div>

                      {mediaItems.map((item, index) => (
                        <div key={item.id} style={{
                          border: '1px solid #dee2e6',
                          borderRadius: 10,
                          padding: 15,
                          marginBottom: 15
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h4 style={{ color: '#495057', margin: 0 }}>Record #{item.id}</h4>
                            {index > 0 && (
                              <button
                                onClick={() => removeMediaItem(item.id)}
                                style={{
                                  background: '#dc3545',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: 5,
                                  padding: '4px 8px',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem'
                                }}
                              >
                                ✕ Remove
                              </button>
                            )}
                          </div>

                          {/* Visual Appearance */}
                          <div style={{ marginBottom: 20 }}>
                            <h4 style={{ color: '#495057', marginBottom: 10, fontSize: '1rem', borderBottom: '2px solid #dee2e6', paddingBottom: 5 }}>
                              Visual Appearance
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              
                              <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '10px 15px',
                                background: 'white',
                                borderRadius: 8,
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                border: '1px solid #e9ecef'
                              }}>
                                <input
                                  type="checkbox"
                                  checked={item.conditions[`vinyl-glossy-${item.id}`] || false}
                                  onChange={(e) => updateMediaCondition(item.id, `vinyl-glossy-${item.id}`, e.target.checked)}
                                  style={{ marginRight: 12, transform: 'scale(1.1)' }}
                                />
                                Record has glossy, like-new appearance
                              </label>

                              <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '10px 15px',
                                background: 'white',
                                borderRadius: 8,
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                border: '1px solid #e9ecef'
                              }}>
                                <input
                                  type="checkbox"
                                  checked={item.conditions[`vinyl-scuffs-${item.id}`] || false}
                                  onChange={(e) => updateMediaCondition(item.id, `vinyl-scuffs-${item.id}`, e.target.checked)}
                                  style={{ marginRight: 12, transform: 'scale(1.1)' }}
                                />
                                Light scuffs visible
                              </label>

                              {activeSeverities[`vinyl-scuffs-${item.id}-severity`] && (
                                <div style={{ marginLeft: 30, marginTop: 8 }}>
                                  {['Very light, barely visible', 'Visible but not deep', 'Obvious, multiple scuffs'].map((option, idx) => (
                                    <label key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                                      <input
                                        type="radio"
                                        name={`vinyl-scuffs-level-${item.id}`}
                                        value={['light', 'moderate', 'heavy'][idx]}
                                        onChange={(e) => updateMediaSeverity(item.id, `vinyl-scuffs-level-${item.id}`, e.target.value)}
                                        style={{ marginRight: 8 }}
                                      />
                                      <span style={{ fontSize: '0.85rem', color: '#666' }}>{option}</span>
                                    </label>
                                  ))}
                                </div>
                              )}

                              <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '10px 15px',
                                background: 'white',
                                borderRadius: 8,
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                border: '1px solid #e9ecef'
                              }}>
                                <input
                                  type="checkbox"
                                  checked={item.conditions[`vinyl-scratches-${item.id}`] || false}
                                  onChange={(e) => updateMediaCondition(item.id, `vinyl-scratches-${item.id}`, e.target.checked)}
                                  style={{ marginRight: 12, transform: 'scale(1.1)' }}
                                />
                                Scratches present
                              </label>

                              {activeSeverities[`vinyl-scratches-${item.id}-severity`] && (
                                <div style={{ marginLeft: 30, marginTop: 8 }}>
                                  {['Hairline scratches only', 'Can feel with fingernail', 'Deep, visible grooves'].map((option, idx) => (
                                    <label key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                                      <input
                                        type="radio"
                                        name={`vinyl-scratches-level-${item.id}`}
                                        value={['hairline', 'feelable', 'deep'][idx]}
                                        onChange={(e) => updateMediaSeverity(item.id, `vinyl-scratches-level-${item.id}`, e.target.value)}
                                        style={{ marginRight: 8 }}
                                      />
                                      <span style={{ fontSize: '0.85rem', color: '#666' }}>{option}</span>
                                    </label>
                                  ))}
                                </div>
                              )}

                              <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '10px 15px',
                                background: 'white',
                                borderRadius: 8,
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                border: '1px solid #e9ecef'
                              }}>
                                <input
                                  type="checkbox"
                                  checked={item.conditions[`vinyl-groove-wear-${item.id}`] || false}
                                  onChange={(e) => updateMediaCondition(item.id, `vinyl-groove-wear-${item.id}`, e.target.checked)}
                                  style={{ marginRight: 12, transform: 'scale(1.1)' }}
                                />
                                Groove wear visible
                              </label>

                              {activeSeverities[`vinyl-groove-wear-${item.id}-severity`] && (
                                <div style={{ marginLeft: 30, marginTop: 8 }}>
                                  {['Slight loss of gloss', 'Evident on sight', 'Heavy wear, matte finish'].map((option, idx) => (
                                    <label key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                                      <input
                                        type="radio"
                                        name={`vinyl-groove-level-${item.id}`}
                                        value={['slight', 'evident', 'heavy'][idx]}
                                        onChange={(e) => updateMediaSeverity(item.id, `vinyl-groove-level-${item.id}`, e.target.value)}
                                        style={{ marginRight: 8 }}
                                      />
                                      <span style={{ fontSize: '0.85rem', color: '#666' }}>{option}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Audio Performance */}
                          <div style={{ marginBottom: 20 }}>
                            <h4 style={{ color: '#495057', marginBottom: 10, fontSize: '1rem', borderBottom: '2px solid #dee2e6', paddingBottom: 5 }}>
                              Audio Performance
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              
                              <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '10px 15px',
                                background: 'white',
                                borderRadius: 8,
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                border: '1px solid #e9ecef'
                              }}>
                                <input
                                  type="checkbox"
                                  checked={item.conditions[`vinyl-silent-${item.id}`] || false}
                                  onChange={(e) => updateMediaCondition(item.id, `vinyl-silent-${item.id}`, e.target.checked)}
                                  style={{ marginRight: 12, transform: 'scale(1.1)' }}
                                />
                                Plays with no surface noise
                              </label>

                              <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '10px 15px',
                                background: 'white',
                                borderRadius: 8,
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                border: '1px solid #e9ecef'
                              }}>
                                <input
                                  type="checkbox"
                                  checked={item.conditions[`vinyl-surface-noise-${item.id}`] || false}
                                  onChange={(e) => updateMediaCondition(item.id, `vinyl-surface-noise-${item.id}`, e.target.checked)}
                                  style={{ marginRight: 12, transform: 'scale(1.1)' }}
                                />
                                Surface noise when played
                              </label>

                              {activeSeverities[`vinyl-surface-noise-${item.id}-severity`] && (
                                <div style={{ marginLeft: 30, marginTop: 8 }}>
                                  {['Minimal, in quiet passages only', 'Noticeable but doesn\'t overpower music', 'Significant throughout'].map((option, idx) => (
                                    <label key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                                      <input
                                        type="radio"
                                        name={`vinyl-noise-level-${item.id}`}
                                        value={['minimal', 'noticeable', 'significant'][idx]}
                                        onChange={(e) => updateMediaSeverity(item.id, `vinyl-noise-level-${item.id}`, e.target.value)}
                                        style={{ marginRight: 8 }}
                                      />
                                      <span style={{ fontSize: '0.85rem', color: '#666' }}>{option}</span>
                                    </label>
                                  ))}
                                </div>
                              )}

                              <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '10px 15px',
                                background: 'white',
                                borderRadius: 8,
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                border: '1px solid #e9ecef'
                              }}>
                                <input
                                  type="checkbox"
                                  checked={item.conditions[`vinyl-pops-${item.id}`] || false}
                                  onChange={(e) => updateMediaCondition(item.id, `vinyl-pops-${item.id}`, e.target.checked)}
                                  style={{ marginRight: 12, transform: 'scale(1.1)' }}
                                />
                                Occasional pops or clicks
                              </label>

                              <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '10px 15px',
                                background: 'white',
                                borderRadius: 8,
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                border: '1px solid #e9ecef'
                              }}>
                                <input
                                  type="checkbox"
                                  checked={item.conditions[`vinyl-skips-${item.id}`] || false}
                                  onChange={(e) => updateMediaCondition(item.id, `vinyl-skips-${item.id}`, e.target.checked)}
                                  style={{ marginRight: 12, transform: 'scale(1.1)' }}
                                />
                                Skipping or repeating
                              </label>

                              {activeSeverities[`vinyl-skips-${item.id}-severity`] && (
                                <div style={{ marginLeft: 30, marginTop: 8, background: '#fff8dc', padding: 10, borderRadius: 5 }}>
                                  <div style={{ marginBottom: 10 }}>
                                    <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Which side(s) affected:</label>
                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 5 }}>
                                      {['A', 'B', 'C', 'D'].map(side => (
                                        <label key={side} style={{ display: 'flex', alignItems: 'center' }}>
                                          <input type="checkbox" value={side} style={{ marginRight: 4 }} />
                                          Side {side}
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                  <div style={{ marginBottom: 10 }}>
                                    <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Tracks affected:</label>
                                    <input
                                      type="number"
                                      min="1"
                                      max="20"
                                      placeholder="Number of tracks"
                                      style={{ width: 100, padding: 4, marginLeft: 10, border: '1px solid #ccc', borderRadius: 3 }}
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Severity:</label>
                                    <div style={{ marginTop: 5 }}>
                                      {['Occasional skips', 'Frequent skipping', 'Constant skipping'].map((option, idx) => (
                                        <label key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                                          <input
                                            type="radio"
                                            name={`vinyl-skip-severity-${item.id}`}
                                            value={['occasional', 'frequent', 'constant'][idx]}
                                            style={{ marginRight: 8 }}
                                          />
                                          <span style={{ fontSize: '0.85rem', color: '#666' }}>{option}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Label & Center */}
                          <div style={{ marginBottom: 20 }}>
                            <h4 style={{ color: '#495057', marginBottom: 10, fontSize: '1rem', borderBottom: '2px solid #dee2e6', paddingBottom: 5 }}>
                              Label & Center
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              
                              {[
                                { key: 'vinyl-label-clean', label: 'Label is clean and bright' },
                                { key: 'vinyl-spindle-marks', label: 'Spindle marks present' },
                                { key: 'vinyl-label-writing', label: 'Writing on label' },
                                { key: 'vinyl-label-stickers', label: 'Stickers or tape on label' }
                              ].map(({ key, label }) => (
                                <label key={key} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '10px 15px',
                                  background: 'white',
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  transition: 'all 0.3s ease',
                                  border: '1px solid #e9ecef'
                                }}>
                                  <input
                                    type="checkbox"
                                    checked={item.conditions[`${key}-${item.id}`] || false}
                                    onChange={(e) => updateMediaCondition(item.id, `${key}-${item.id}`, e.target.checked)}
                                    style={{ marginRight: 12, transform: 'scale(1.1)' }}
                                  />
                                  {label}
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}

                      <button
                        onClick={addAnotherRecord}
                        style={{
                          width: '100%',
                          marginTop: 15,
                          padding: 10,
                          background: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: 8,
                          cursor: 'pointer',
                          fontSize: '1rem',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        ➕ Add Another Record
                      </button>
                    </div>

                    {/* Sleeve Condition Assessment */}
                    <div style={{
                      background: '#f8f9fa',
                      borderRadius: 15,
                      padding: 25,
                      border: '2px solid transparent',
                      transition: 'all 0.3s ease',
                      ...getEvaluationSectionStyle(packageMissing)
                    }}>
                      <div style={{
                        fontSize: '1.3rem',
                        fontWeight: 'bold',
                        color: '#2c3e50',
                        marginBottom: 20,
                        textAlign: 'center',
                        padding: 10,
                        background: 'white',
                        borderRadius: 10
                      }}>
                        📦 Sleeve Condition Assessment
                      </div>

                      {/* Overall Appearance */}
                      <div style={{ marginBottom: 20 }}>
                        <h4 style={{ color: '#495057', marginBottom: 10, fontSize: '1rem', borderBottom: '2px solid #dee2e6', paddingBottom: 5 }}>
                          Overall Appearance
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          
                          {[
                            { key: 'sleeve-perfect', label: 'Looks like new, no flaws' },
                            { key: 'sleeve-minor-wear', label: 'Minor shelf wear only' }
                          ].map(({ key, label }) => (
                            <label key={key} style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '10px 15px',
                              background: 'white',
                              borderRadius: 8,
                              cursor: 'pointer',
                              transition: 'all 0.3s ease',
                              border: '1px solid #e9ecef'
                            }}>
                              <input
                                type="checkbox"
                                checked={sleeveConditions[key] || false}
                                onChange={(e) => updateSleeveCondition(key, e.target.checked)}
                                style={{ marginRight: 12, transform: 'scale(1.1)' }}
                              />
                              {label}
                            </label>
                          ))}

                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px 15px',
                            background: 'white',
                            borderRadius: 8,
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            border: '1px solid #e9ecef'
                          }}>
                            <input
                              type="checkbox"
                              checked={sleeveConditions['sleeve-corner-wear'] || false}
                              onChange={(e) => updateSleeveCondition('sleeve-corner-wear', e.target.checked)}
                              style={{ marginRight: 12, transform: 'scale(1.1)' }}
                            />
                            Corner wear present
                          </label>

                          {activeSeverities['sleeve-corner-wear-severity'] && (
                            <div style={{ marginLeft: 30, marginTop: 8 }}>
                              {['Slight bumping', 'Creased or frayed', 'Cut or heavily damaged'].map((option, idx) => (
                                <label key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                                  <input
                                    type="radio"
                                    name="sleeve-corner-level"
                                    value={['slight', 'creased', 'cut'][idx]}
                                    onChange={(e) => updateSleeveSeverity('sleeve-corner-level', e.target.value)}
                                    style={{ marginRight: 8 }}
                                  />
                                  <span style={{ fontSize: '0.85rem', color: '#666' }}>{option}</span>
                                </label>
                              ))}
                            </div>
                          )}

                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px 15px',
                            background: 'white',
                            borderRadius: 8,
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            border: '1px solid #e9ecef'
                          }}>
                            <input
                              type="checkbox"
                              checked={sleeveConditions['sleeve-ring-wear'] || false}
                              onChange={(e) => updateSleeveCondition('sleeve-ring-wear', e.target.checked)}
                              style={{ marginRight: 12, transform: 'scale(1.1)' }}
                            />
                            Ring wear visible
                          </label>

                          {activeSeverities['sleeve-ring-wear-severity'] && (
                            <div style={{ marginLeft: 30, marginTop: 8 }}>
                              {['Light, barely visible', 'Clearly visible', 'Heavy, ink worn off'].map((option, idx) => (
                                <label key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                                  <input
                                    type="radio"
                                    name="sleeve-ring-level"
                                    value={['light', 'evident', 'heavy'][idx]}
                                    onChange={(e) => updateSleeveSeverity('sleeve-ring-level', e.target.value)}
                                    style={{ marginRight: 8 }}
                                  />
                                  <span style={{ fontSize: '0.85rem', color: '#666' }}>{option}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Seams & Structure */}
                      <div style={{ marginBottom: 20 }}>
                        <h4 style={{ color: '#495057', marginBottom: 10, fontSize: '1rem', borderBottom: '2px solid #dee2e6', paddingBottom: 5 }}>
                          Seams & Structure
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px 15px',
                            background: 'white',
                            borderRadius: 8,
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            border: '1px solid #e9ecef'
                          }}>
                            <input
                              type="checkbox"
                              checked={sleeveConditions['sleeve-seams-intact'] || false}
                              onChange={(e) => updateSleeveCondition('sleeve-seams-intact', e.target.checked)}
                              style={{ marginRight: 12, transform: 'scale(1.1)' }}
                            />
                            All seams intact
                          </label>

                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px 15px',
                            background: 'white',
                            borderRadius: 8,
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            border: '1px solid #e9ecef'
                          }}>
                            <input
                              type="checkbox"
                              checked={sleeveConditions['sleeve-seam-splits'] || false}
                              onChange={(e) => updateSleeveCondition('sleeve-seam-splits', e.target.checked)}
                              style={{ marginRight: 12, transform: 'scale(1.1)' }}
                            />
                            Seam splits present
                          </label>

                          {activeSeverities['sleeve-seam-splits-severity'] && (
                            <div style={{ marginLeft: 30, marginTop: 8 }}>
                              {['Small (under 1 inch)', 'Medium (1-3 inches)', 'Large (over 3 inches)'].map((option, idx) => (
                                <label key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                                  <input
                                    type="radio"
                                    name="sleeve-seam-level"
                                    value={['small', 'medium', 'large'][idx]}
                                    onChange={(e) => updateSleeveSeverity('sleeve-seam-level', e.target.value)}
                                    style={{ marginRight: 8 }}
                                  />
                                  <span style={{ fontSize: '0.85rem', color: '#666' }}>{option}</span>
                                </label>
                              ))}
                            </div>
                          )}

                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px 15px',
                            background: 'white',
                            borderRadius: 8,
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            border: '1px solid #e9ecef'
                          }}>
                            <input
                              type="checkbox"
                              checked={sleeveConditions['sleeve-spine-wear'] || false}
                              onChange={(e) => updateSleeveCondition('sleeve-spine-wear', e.target.checked)}
                              style={{ marginRight: 12, transform: 'scale(1.1)' }}
                            />
                            Spine shows wear
                          </label>
                        </div>
                      </div>

                      {/* Damage & Markings */}
                      <div style={{ marginBottom: 20 }}>
                        <h4 style={{ color: '#495057', marginBottom: 10, fontSize: '1rem', borderBottom: '2px solid #dee2e6', paddingBottom: 5 }}>
                          Damage & Markings
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          
                          {[
                            { key: 'sleeve-creases', label: 'Creases present' },
                            { key: 'sleeve-writing', label: 'Writing present' },
                            { key: 'sleeve-stickers', label: 'Stickers or tape' },
                            { key: 'sleeve-water-damage', label: 'Water damage or staining' }
                          ].map(({ key, label }) => (
                            <label key={key} style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '10px 15px',
                              background: 'white',
                              borderRadius: 8,
                              cursor: 'pointer',
                              transition: 'all 0.3s ease',
                              border: '1px solid #e9ecef'
                            }}>
                              <input
                                type="checkbox"
                                checked={sleeveConditions[key] || false}
                                onChange={(e) => updateSleeveCondition(key, e.target.checked)}
                                style={{ marginRight: 12, transform: 'scale(1.1)' }}
                              />
                              {label}
                            </label>
                          ))}

                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px 15px',
                            background: 'white',
                            borderRadius: 8,
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            border: '1px solid #e9ecef'
                          }}>
                            <input
                              type="checkbox"
                              checked={sleeveConditions['sleeve-tears'] || false}
                              onChange={(e) => updateSleeveCondition('sleeve-tears', e.target.checked)}
                              style={{ marginRight: 12, transform: 'scale(1.1)' }}
                            />
                            Tears present
                          </label>

                          {activeSeverities['sleeve-tears-severity'] && (
                            <div style={{ marginLeft: 30, marginTop: 8 }}>
                              {['Small tears', 'Significant tears', 'Major damage'].map((option, idx) => (
                                <label key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                                  <input
                                    type="radio"
                                    name="sleeve-tear-level"
                                    value={['small', 'significant', 'major'][idx]}
                                    onChange={(e) => updateSleeveSeverity('sleeve-tear-level', e.target.value)}
                                    style={{ marginRight: 8 }}
                                  />
                                  <span style={{ fontSize: '0.85rem', color: '#666' }}>{option}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Notes Section */}
              <div style={{
                background: '#f8f9fa',
                borderRadius: 15,
                padding: 25,
                marginBottom: 30
              }}>
                <h3 style={{ color: '#495057', marginBottom: 15 }}>
                  📝 Custom Condition Notes
                </h3>
                <textarea
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Add any additional condition details not covered by the checkboxes above..."
                  style={{
                    width: '100%',
                    height: 80,
                    padding: 10,
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
                <div style={{ fontSize: '0.85rem', color: '#666', marginTop: 8 }}>
                  Examples: &quot;Light warp does not affect play&quot;, &quot;Minor pressing flaw on track 3&quot;, &quot;Includes original poster&quot;, etc.
                </div>
              </div>

              {/* Additional Notes */}
              <div style={{
                background: '#fff3cd',
                borderRadius: 15,
                padding: 25,
                borderLeft: '5px solid #ffc107',
                marginBottom: 30
              }}>
                <h3 style={{ color: '#856404', marginBottom: 15 }}>
                  📋 Additional Notes (Don&apos;t Affect Grade but Important for Disclosure)
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: 15
                }}>
                  {[
                    { key: 'jewel-case-damaged', label: 'Jewel Case Damaged' },
                    { key: 'jewel-case-missing', label: 'Jewel Case Missing' },
                    { key: 'original-shrink', label: 'Original Shrinkwrap' },
                    { key: 'hype-sticker', label: 'Hype Sticker Present' },
                    { key: 'cutout-hole', label: 'Cut-out Hole/Mark' },
                    { key: 'promo-stamp', label: 'Promotional Copy' },
                    { key: 'price-sticker', label: 'Price Sticker/Tag' },
                    { key: 'first-pressing', label: 'First Pressing' },
                    { key: 'colored-vinyl', label: 'Colored Vinyl' },
                    { key: 'limited-edition', label: 'Limited Edition' },
                    { key: 'gatefold', label: 'Gatefold Sleeve' },
                    { key: 'inner-sleeve-original', label: 'Original Inner Sleeve' }
                  ].map(({ key, label }) => (
                    <label key={key} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: 'white',
                      padding: 10,
                      borderRadius: 8,
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={additionalNotes[key] || false}
                        onChange={(e) => setAdditionalNotes(prev => ({ ...prev, [key]: e.target.checked }))}
                        style={{ transform: 'scale(1.1)' }}
                      />
                      <span style={{ color: '#856404' }}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Calculate Button */}
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={calculateGrades}
                  style={{
                    background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '15px 40px',
                    borderRadius: 50,
                    fontSize: '1.1rem',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 5px 15px rgba(40, 167, 69, 0.3)'
                  }}
                >
                  🎯 Calculate Grades
                </button>
              </div>

              {/* Album Info for Export */}
              {showResults && (
                <div style={{
                  marginTop: 20,
                  padding: 20,
                  background: '#f8f9fa',
                  borderRadius: 10
                }}>
                  <h3>📝 Album Information (for export)</h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 15,
                    marginTop: 15
                  }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Artist:</label>
                      <input
                        type="text"
                        value={albumInfo.artist}
                        onChange={(e) => setAlbumInfo(prev => ({ ...prev, artist: e.target.value }))}
                        placeholder="Enter artist name"
                        style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 5 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Album Title:</label>
                      <input
                        type="text"
                        value={albumInfo.title}
                        onChange={(e) => setAlbumInfo(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter album title"
                        style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 5 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Catalog #:</label>
                      <input
                        type="text"
                        value={albumInfo.catalog}
                        onChange={(e) => setAlbumInfo(prev => ({ ...prev, catalog: e.target.value }))}
                        placeholder="e.g. ABC-123"
                        style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 5 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Year:</label>
                      <input
                        type="text"
                        value={albumInfo.year}
                        onChange={(e) => setAlbumInfo(prev => ({ ...prev, year: e.target.value }))}
                        placeholder="e.g. 1975"
                        style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 5 }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Results Section */}
              {showResults && (
                <div id="results" style={{
                  marginTop: 30,
                  padding: 25,
                  background: 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)',
                  borderRadius: 15,
                  border: '2px solid #28a745'
                }}>
                  <h3 style={{ color: '#155724', marginBottom: 20, textAlign: 'center' }}>
                    📊 Calculated Grading Results
                  </h3>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 20,
                    marginBottom: 20
                  }}>
                    <div style={{
                      textAlign: 'center',
                      padding: 20,
                      background: 'white',
                      borderRadius: 10,
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}>
                      <h4 style={{ color: '#2c3e50', marginBottom: 10 }}>Record Grade</h4>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#28a745' }}>VG</div>
                    </div>
                    <div style={{
                      textAlign: 'center',
                      padding: 20,
                      background: 'white',
                      borderRadius: 10,
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}>
                      <h4 style={{ color: '#2c3e50', marginBottom: 10 }}>Sleeve Grade</h4>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#28a745' }}>VG+</div>
                    </div>
                    <div style={{
                      textAlign: 'center',
                      padding: 20,
                      background: 'white',
                      borderRadius: 10,
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}>
                      <h4 style={{ color: '#2c3e50', marginBottom: 10 }}>Overall Grade</h4>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#28a745' }}>VG</div>
                    </div>
                  </div>

                  <div style={{
                    background: 'white',
                    padding: 20,
                    borderRadius: 10,
                    marginBottom: 20
                  }}>
                    <h4 style={{ color: '#2c3e50', marginBottom: 10 }}>Grading Explanation:</h4>
                    <p>Detailed grading calculation based on systematic assessment criteria...</p>
                  </div>

                  <div style={{
                    background: 'white',
                    padding: 20,
                    borderRadius: 10,
                    marginBottom: 20
                  }}>
                    <h4 style={{ color: '#2c3e50', marginBottom: 10 }}>Additional Notes:</h4>
                    <ul>
                      <li>Complete systematic evaluation performed</li>
                      <li>All condition factors considered</li>
                    </ul>
                  </div>

                  <div style={{ textAlign: 'center', marginTop: 20 }}>
                    <button
                      onClick={exportListing}
                      style={{
                        background: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '12px 25px',
                        borderRadius: 25,
                        cursor: 'pointer',
                        fontSize: '1rem',
                        marginRight: 15,
                        transition: 'all 0.3s ease'
                      }}
                    >
                      📋 Copy Sales Listing
                    </button>
                    <button
                      onClick={resetForm}
                      style={{
                        background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '12px 25px',
                        borderRadius: 25,
                        cursor: 'pointer',
                        fontSize: '1rem',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      🔄 Reset Evaluation
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}