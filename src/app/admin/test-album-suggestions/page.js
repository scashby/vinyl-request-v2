// Admin Test Page for Album Suggestions (production appropriate)
// Create as: src/app/admin/test-album-suggestions/page.js

"use client";

import { useState, useEffect } from 'react';
import AlbumSuggestionBox from 'components/AlbumSuggestionBox';
import Link from 'next/link';

export default function AdminTestAlbumSuggestionsPage() {
  const [testResults, setTestResults] = useState([]);
  const [apiStatus, setApiStatus] = useState('checking');

  useEffect(() => {
    const testAPI = async () => {
      try {
        const response = await fetch('/api/album-suggestions', {
          method: 'GET',
        });
        
        if (response.ok) {
          const data = await response.json();
          setApiStatus('working');
          setTestResults(prev => [...prev, `✅ API GET works: ${data.count} suggestions found`]);
        } else {
          setApiStatus('error');
          setTestResults(prev => [...prev, `❌ API GET failed: ${response.status}`]);
        }
      } catch (error) {
        setApiStatus('error');
        setTestResults(prev => [...prev, `❌ API Error: ${error.message}`]);
      }
    };

    testAPI();
  }, []);

  const testSubmission = async () => {
    setTestResults(prev => [...prev, '🧪 Testing submission...']);
    
    try {
      const response = await fetch('/api/album-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: 'Test Artist',
          album: 'Test Album',
          notes: 'Test submission from admin debug page',
          suggestor_name: 'Admin Test',
          context: 'debug',
          search_query: 'test'
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setTestResults(prev => [...prev, `✅ Submission successful: ${data.message}`]);
      } else {
        setTestResults(prev => [...prev, `❌ Submission failed: ${data.error}`]);
      }
    } catch (error) {
      setTestResults(prev => [...prev, `❌ Submission error: ${error.message}`]);
    }
  };

  return (
    <div style={{
      maxWidth: 800,
      margin: '0 auto',
      padding: 20,
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ marginBottom: 20 }}>
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

      <h1 style={{ textAlign: 'center', marginBottom: 30 }}>
        🧪 Album Suggestion System Test
      </h1>

      <div style={{
        background: apiStatus === 'working' ? '#d4edda' : apiStatus === 'error' ? '#f8d7da' : '#fff3cd',
        border: `1px solid ${apiStatus === 'working' ? '#c3e6cb' : apiStatus === 'error' ? '#f5c6cb' : '#ffeaa7'}`,
        borderRadius: 8,
        padding: 16,
        marginBottom: 20
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>API Status: 
          <span style={{ 
            color: apiStatus === 'working' ? '#155724' : apiStatus === 'error' ? '#721c24' : '#856404',
            marginLeft: 8
          }}>
            {apiStatus === 'working' ? '✅ Working' : apiStatus === 'error' ? '❌ Error' : '⏳ Checking'}
          </span>
        </h3>
      </div>

      <div style={{
        background: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: 8,
        padding: 16,
        marginBottom: 20,
        minHeight: 100
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Test Results:</h3>
        <div style={{ 
          fontFamily: 'monospace', 
          fontSize: 12,
          maxHeight: 200,
          overflowY: 'auto'
        }}>
          {testResults.map((result, index) => (
            <div key={index} style={{ marginBottom: 4 }}>
              {new Date().toLocaleTimeString()} - {result}
            </div>
          ))}
        </div>
        
        <button
          onClick={testSubmission}
          style={{
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            padding: '8px 16px',
            cursor: 'pointer',
            marginTop: 10
          }}
        >
          Test API Submission
        </button>
      </div>

      <div style={{ marginBottom: 30 }}>
        <h3>Component Test 1: Default State</h3>
        <AlbumSuggestionBox context="general" />
      </div>

      <div style={{ marginBottom: 30 }}>
        <h3>Component Test 2: Search Context</h3>
        <AlbumSuggestionBox context="search" searchQuery="Tiny Tim" />
      </div>

      <div style={{ marginBottom: 30 }}>
        <h3>Component Test 3: Compact Mode</h3>
        <AlbumSuggestionBox context="general" compact={true} />
      </div>

      <div style={{ marginBottom: 30 }}>
        <h3>Component Test 4: Voting Context</h3>
        <AlbumSuggestionBox context="voting" />
      </div>

      <div style={{
        background: '#e3f2fd',
        border: '1px solid #90caf9',
        borderRadius: 8,
        padding: 16,
        marginTop: 30
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Testing Instructions:</h3>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li>Check if the API status shows &ldquo;✅ Working&rdquo;</li>
          <li>Try the &ldquo;Test API Submission&rdquo; button</li>
          <li>Test each component variation above</li>
          <li>Try submitting suggestions through the forms</li>
          <li>Check the <Link href="/admin/album-suggestions" style={{ color: '#1976d2' }}>album suggestions admin panel</Link> to see submitted suggestions</li>
        </ol>
      </div>
    </div>
  );
}