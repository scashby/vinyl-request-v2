// src/app/admin/audio-debug/page.tsx
"use client";

import AudioRecognitionDebugger from 'components/AudioRecognitionDebugger';

export default function AudioDebugPage() {
  return (
    <div style={{
      background: '#fff',
      color: '#222',
      minHeight: '100vh',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 'bold',
          marginBottom: '16px',
          color: '#1f2937'
        }}>
          🔧 Audio Recognition Debug Panel
        </h1>
        
        <p style={{
          fontSize: '16px',
          color: '#6b7280',
          marginBottom: '24px'
        }}>
          Use this tool to debug audio recognition issues step by step. 
          Check the console logs and debug output to identify problems with the Shazam API integration.
        </p>

        <AudioRecognitionDebugger />
        
        <div style={{
          marginTop: '32px',
          padding: '20px',
          background: '#f3f4f6',
          borderRadius: '8px',
          border: '1px solid #d1d5db'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            marginBottom: '12px',
            color: '#374151'
          }}>
            📝 Common Issues to Check:
          </h3>
          
          <ul style={{
            fontSize: '14px',
            color: '#4b5563',
            lineHeight: '1.6',
            paddingLeft: '20px'
          }}>
            <li><strong>API Key:</strong> Verify SHAZAM_RAPID_API_KEY in environment variables</li>
            <li><strong>Audio Quality:</strong> Ensure clear audio input without background noise</li>
            <li><strong>File Size:</strong> Check if audio samples are reasonable size (not too small/large)</li>
            <li><strong>Response Format:</strong> Look for unexpected API response structure changes</li>
            <li><strong>Rate Limits:</strong> Check if you&apos;re hitting API usage limits</li>
            <li><strong>Network Issues:</strong> Verify connectivity to RapidAPI servers</li>
          </ul>
        </div>
      </div>
    </div>
  );
}