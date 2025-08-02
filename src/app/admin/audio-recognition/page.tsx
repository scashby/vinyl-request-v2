// src/app/admin/audio-recognition/page.tsx
// TEMPORARY FIX for Phase 1 - Full simple interface in Phase 3

'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface RecognitionResult {
  success: boolean;
  result?: {
    artist: string;
    title: string;
    album: string;
    confidence: number;
    service: string;
  };
  error?: string;
  processingTime: number;
  mode: string;
}

export default function TemporaryAudioRecognitionPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [status, setStatus] = useState('Phase 1 Cleanup Mode - Limited Functionality');

  const testRecognition = async () => {
    setIsProcessing(true);
    setStatus('Testing temporary recognition...');
    
    try {
      const response = await fetch('/api/audio-recognition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: 'temporary_test_data',
          triggeredBy: 'phase1_admin_test',
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        setStatus(`✅ Temporary test successful: ${data.result?.artist} - ${data.result?.title}`);
      } else {
        setStatus(`❌ Test failed: ${data.error}`);
      }
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: 0,
        mode: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const checkAPIStatus = async () => {
    try {
      const response = await fetch('/api/audio-recognition');
      const data = await response.json();
      setStatus(`API Status: ${data.message || 'Unknown'}`);
    } catch (error) {
      setStatus(`❌ API Status Check Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Audio Recognition System</h1>
              <p className="text-orange-600 font-medium">⚠️ Phase 1 Cleanup Mode - Limited Functionality</p>
            </div>
            <div className="flex gap-4">
              <Link 
                href="/admin/audio-recognition/collection"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                🔍 Collection Match
              </Link>
              <Link 
                href="/now-playing-tv"
                target="_blank"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                📺 TV Display
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Status Display */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
        <div className={`p-4 rounded-lg border ${
          status.includes('❌') ? 'bg-red-50 border-red-200 text-red-800' :
          status.includes('✅') ? 'bg-green-50 border-green-200 text-green-800' :
          'bg-orange-50 border-orange-200 text-orange-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="font-medium">{status}</span>
            {isProcessing && (
              <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Temporary Controls */}
          <div className="bg-white rounded-lg shadow border p-6">
            <h2 className="text-lg font-semibold mb-4">Phase 1 Cleanup - Temporary Controls</h2>
            
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h3 className="font-medium text-orange-800 mb-2">🚧 System Status</h3>
                <p className="text-sm text-orange-700 mb-3">
                  The audio recognition system is currently in Phase 1 cleanup mode. 
                  Complex audio processing has been temporarily disabled while we simplify the system.
                </p>
                <ul className="text-sm text-orange-700 space-y-1">
                  <li>• ✅ Collection matching still works</li>
                  <li>• ✅ Manual recognition still works</li>
                  <li>• ✅ TV display still works</li>
                  <li>• ⚠️ Audio capture temporarily disabled</li>
                  <li>• ⚠️ External APIs using basic simulation</li>
                </ul>
              </div>

              <button
                onClick={testRecognition}
                disabled={isProcessing}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? '🔄 Testing...' : '🧪 Test Temporary Recognition'}
              </button>
              
              <button
                onClick={checkAPIStatus}
                className="w-full py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                📋 Check API Status
              </button>
            </div>
          </div>

          {/* Test Results */}
          <div className="bg-white rounded-lg shadow border p-6">
            <h3 className="text-lg font-semibold mb-4">Test Results</h3>
            
            {!result ? (
              <div className="text-gray-500 text-center py-8">
                Click &ldquo;Test Temporary Recognition&rdquo; to verify the system is working
              </div>
            ) : (
              <div className={`p-4 rounded-lg border ${
                result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                {result.success && result.result ? (
                  <div>
                    <div className="font-medium text-green-800 mb-2">
                      ✅ Recognition Successful
                    </div>
                    <div className="space-y-1 text-sm text-green-700">
                      <div><strong>Artist:</strong> {result.result.artist}</div>
                      <div><strong>Title:</strong> {result.result.title}</div>
                      <div><strong>Album:</strong> {result.result.album}</div>
                      <div><strong>Confidence:</strong> {Math.round(result.result.confidence * 100)}%</div>
                      <div><strong>Service:</strong> {result.result.service}</div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="font-medium text-red-800 mb-2">
                      ❌ Recognition Failed
                    </div>
                    <div className="text-sm text-red-700">
                      {result.error}
                    </div>
                  </div>
                )}
                <div className="text-xs text-gray-600 mt-3">
                  Mode: {result.mode} • Processing time: {result.processingTime}ms
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Phase Progress */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">🚀 Simplification Progress</h3>
          <div className="space-y-3">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 rounded-full mr-3"></div>
              <span className="text-blue-800"><strong>Phase 1:</strong> Cleanup (In Progress) - Removing 70% of complex codebase</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-gray-300 rounded-full mr-3"></div>
              <span className="text-blue-800"><strong>Phase 2:</strong> API Modifications - Multi-source recognition with auto-selection</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-gray-300 rounded-full mr-3"></div>
              <span className="text-blue-800"><strong>Phase 3:</strong> Simple Interface - Shazam-like auto-recognition</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-gray-300 rounded-full mr-3"></div>
              <span className="text-blue-800"><strong>Phase 4:</strong> Audio Capture - Native MediaRecorder implementation</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-gray-300 rounded-full mr-3"></div>
              <span className="text-blue-800"><strong>Phase 5:</strong> Testing & Refinement - Final optimization</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 mb-3">Quick Actions During Cleanup</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/admin/audio-recognition/collection"
              className="block p-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-center"
            >
              <div className="text-2xl mb-2">🔍</div>
              <div className="font-medium">Collection Match</div>
              <div className="text-sm opacity-90">Search your vinyl collection</div>
            </Link>
            
            <Link
              href="/now-playing-tv"
              target="_blank"
              className="block p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-center"
            >
              <div className="text-2xl mb-2">📺</div>
              <div className="font-medium">TV Display</div>
              <div className="text-sm opacity-90">View the live display</div>
            </Link>
            
            <button
              onClick={() => window.location.reload()}
              className="block w-full p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center"
            >
              <div className="text-2xl mb-2">🔄</div>
              <div className="font-medium">Refresh Page</div>
              <div className="text-sm opacity-90">Reload the interface</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}