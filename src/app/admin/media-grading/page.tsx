// src/app/admin/media-grading/page.tsx
"use client";

import { useState } from 'react';
import Link from 'next/link';

interface GradingCriteria {
  visualWear: number;
  playbackQuality: number;
  surfaceMarks: number;
  labelCondition: number;
  overallAppearance: number;
}

interface GradingResult {
  grade: string;
  confidence: number;
  description: string;
  marketValue: string;
}

export default function MediaGradingPage() {
  const [mediaType, setMediaType] = useState<'vinyl' | 'cassette' | 'cd'>('vinyl');
  const [criteria, setCriteria] = useState<GradingCriteria>({
    visualWear: 5,
    playbackQuality: 5,
    surfaceMarks: 5,
    labelCondition: 5,
    overallAppearance: 5
  });
  const [result, setResult] = useState<GradingResult | null>(null);
  const [notes, setNotes] = useState('');

  const gradeItem = () => {
    const average = Object.values(criteria).reduce((sum, val) => sum + val, 0) / 5;
    const variance = Object.values(criteria).reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / 5;
    const confidence = Math.max(0, 100 - (variance * 20));

    let grade: string;
    let description: string;
    let marketValue: string;

    if (average >= 9.5) {
      grade = 'M (Mint)';
      description = 'Perfect condition, like new';
      marketValue = '100% of catalog value';
    } else if (average >= 8.5) {
      grade = 'NM (Near Mint)';
      description = 'Excellent condition with minimal signs of use';
      marketValue = '75-90% of catalog value';
    } else if (average >= 7) {
      grade = 'VG+ (Very Good Plus)';
      description = 'Good condition with minor wear that doesn&apos;t affect play';
      marketValue = '50-75% of catalog value';
    } else if (average >= 5.5) {
      grade = 'VG (Very Good)';
      description = 'Shows wear but plays well';
      marketValue = '25-50% of catalog value';
    } else if (average >= 4) {
      grade = 'G+ (Good Plus)';
      description = 'Significant wear with some play issues';
      marketValue = '10-25% of catalog value';
    } else if (average >= 2.5) {
      grade = 'G (Good)';
      description = 'Heavy wear, plays but with noticeable issues';
      marketValue = '5-15% of catalog value';
    } else {
      grade = 'P (Poor)';
      description = 'Extensive damage, may not play properly';
      marketValue = '0-10% of catalog value';
    }

    setResult({
      grade,
      confidence: Math.round(confidence),
      description,
      marketValue
    });
  };

  const resetGrading = () => {
    setCriteria({
      visualWear: 5,
      playbackQuality: 5,
      surfaceMarks: 5,
      labelCondition: 5,
      overallAppearance: 5
    });
    setResult(null);
    setNotes('');
  };

  const criteriaLabels = {
    vinyl: {
      visualWear: 'Vinyl Surface Condition',
      playbackQuality: 'Playback Quality',
      surfaceMarks: 'Scratches & Scuffs',
      labelCondition: 'Label Condition',
      overallAppearance: 'Sleeve Condition'
    },
    cassette: {
      visualWear: 'Tape Condition',
      playbackQuality: 'Audio Quality',
      surfaceMarks: 'Case Condition',
      labelCondition: 'Label/Insert Condition',
      overallAppearance: 'Overall Appearance'
    },
    cd: {
      visualWear: 'Disc Surface',
      playbackQuality: 'Playback Quality',
      surfaceMarks: 'Scratches & Marks',
      labelCondition: 'Booklet/Insert Condition',
      overallAppearance: 'Case Condition'
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 8) return '#22c55e';
    if (score >= 6) return '#eab308';
    if (score >= 4) return '#f97316';
    return '#ef4444';
  };

  const getGradeColor = (grade: string): string => {
    if (grade.includes('M')) return '#22c55e';
    if (grade.includes('NM')) return '#65a30d';
    if (grade.includes('VG+')) return '#eab308';
    if (grade.includes('VG')) return '#f97316';
    if (grade.includes('G')) return '#ef4444';
    return '#dc2626';
  };

  return (
    <div style={{ padding: 24, background: '#fff', color: '#222', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 'bold', margin: '0 0 8px 0' }}>
            🎵 Music Media Grading Tool
          </h1>
          <p style={{ color: '#666', fontSize: 16, margin: 0 }}>
            Professional media condition assessment for Dead Wax Dialogues collection
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'flex-start' }}>
        
        {/* Left Column - Input */}
        <div>
          {/* Media Type Selection */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: 24,
            marginBottom: 24
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
              Media Type
            </h3>
            <div style={{ display: 'flex', gap: 12 }}>
              {(['vinyl', 'cassette', 'cd'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setMediaType(type)}
                  style={{
                    background: mediaType === type ? '#2563eb' : '#e5e7eb',
                    color: mediaType === type ? 'white' : '#374151',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 16px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {type === 'vinyl' ? '🎵 Vinyl' : type === 'cassette' ? '📼 Cassette' : '💿 CD'}
                </button>
              ))}
            </div>
          </div>

          {/* Grading Criteria */}
          <div style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 24,
            marginBottom: 24
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>
              Condition Assessment
            </h3>
            
            {Object.entries(criteria).map(([key, value]) => {
              const label = criteriaLabels[mediaType][key as keyof GradingCriteria];
              return (
                <div key={key} style={{ marginBottom: 20 }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: 8
                  }}>
                    <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
                      {label}
                    </label>
                    <div style={{
                      background: getScoreColor(value),
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 'bold'
                    }}>
                      {value}/10
                    </div>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={value}
                    onChange={(e) => setCriteria(prev => ({
                      ...prev,
                      [key]: parseFloat(e.target.value)
                    }))}
                    style={{
                      width: '100%',
                      height: 8,
                      borderRadius: 4,
                      background: '#e5e7eb',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  />
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    fontSize: 10, 
                    color: '#9ca3af',
                    marginTop: 4
                  }}>
                    <span>Poor</span>
                    <span>Excellent</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Notes */}
          <div style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 24,
            marginBottom: 24
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
              Additional Notes
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record any specific defects, special characteristics, or additional observations..."
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 14,
                resize: 'vertical',
                minHeight: 80,
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={gradeItem}
              style={{
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                flex: 1
              }}
            >
              🎯 Calculate Grade
            </button>
            <button
              onClick={resetGrading}
              style={{
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              🔄 Reset
            </button>
          </div>
        </div>

        {/* Right Column - Results */}
        <div>
          {result ? (
            <div style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
              border: '2px solid #cbd5e1',
              borderRadius: 16,
              padding: 32,
              textAlign: 'center'
            }}>
              <div style={{
                background: getGradeColor(result.grade),
                color: 'white',
                padding: '16px 24px',
                borderRadius: 12,
                fontSize: 24,
                fontWeight: 'bold',
                marginBottom: 20,
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}>
                {result.grade}
              </div>
              
              <div style={{
                fontSize: 16,
                color: '#374151',
                marginBottom: 20,
                lineHeight: 1.5
              }}>
                {result.description}
              </div>
              
              <div style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: 16,
                marginBottom: 20
              }}>
                <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>
                  Market Value Range
                </div>
                <div style={{ fontSize: 18, fontWeight: 'bold', color: '#059669' }}>
                  {result.marketValue}
                </div>
              </div>
              
              <div style={{
                background: '#f0f9ff',
                border: '1px solid #0369a1',
                borderRadius: 8,
                padding: 12,
                fontSize: 12,
                color: '#0c4a6e'
              }}>
                <strong>Confidence:</strong> {result.confidence}%
                <div style={{ marginTop: 4, fontSize: 11 }}>
                  Based on consistency of ratings across criteria
                </div>
              </div>

              {notes && (
                <div style={{
                  background: '#fefce8',
                  border: '1px solid #eab308',
                  borderRadius: 8,
                  padding: 16,
                  marginTop: 20,
                  textAlign: 'left'
                }}>
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: '#92400e', marginBottom: 8 }}>
                    Additional Notes:
                  </div>
                  <div style={{ fontSize: 14, color: '#a16207' }}>
                    {notes}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{
              background: '#f9fafb',
              border: '2px dashed #d1d5db',
              borderRadius: 16,
              padding: 48,
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎵</div>
              <h3 style={{ fontSize: 20, marginBottom: 8, color: '#374151' }}>
                Ready to Grade
              </h3>
              <p style={{ margin: 0, fontSize: 14 }}>
                Adjust the condition sliders above and click &ldquo;Calculate Grade&rdquo; to get your assessment.
              </p>
            </div>
          )}

          {/* Grading Reference */}
          <div style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 20,
            marginTop: 24,
            fontSize: 12
          }}>
            <h4 style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 12, color: '#374151' }}>
              📖 Grading Reference
            </h4>
            <div style={{ display: 'grid', gap: 8 }}>
              {[
                { grade: 'M (Mint)', desc: 'Perfect, unplayed condition' },
                { grade: 'NM (Near Mint)', desc: 'Excellent with minimal wear' },
                { grade: 'VG+ (Very Good Plus)', desc: 'Minor wear, plays well' },
                { grade: 'VG (Very Good)', desc: 'Shows wear but functional' },
                { grade: 'G+ (Good Plus)', desc: 'Significant wear, some issues' },
                { grade: 'G (Good)', desc: 'Heavy wear, noticeable problems' },
                { grade: 'P (Poor)', desc: 'Extensive damage' }
              ].map(({ grade, desc }) => (
                <div key={grade} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  padding: '4px 0',
                  borderBottom: '1px solid #f3f4f6'
                }}>
                  <span style={{ fontWeight: 'bold', color: getGradeColor(grade) }}>
                    {grade}
                  </span>
                  <span style={{ color: '#6b7280' }}>
                    {desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}