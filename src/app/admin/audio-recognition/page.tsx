// src/app/admin/audio-recognition/page.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAudioCapture, ProcessingResult } from 'lib/audio';
import AudioRecognitionComponent from 'components/AudioRecognitionComponent';

export default function AudioRecognitionPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  
  const {
    isPermissionGranted,
    hasPermissionError,
    isSupported,
    error,
    requestPermission
  } = useAudioCapture();

  const fetchLogs = useCallback(async () => {
    try {
      // Fetch logs from API or local storage
      const response = await fetch('/api/audio-recognition/logs');
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  }, []);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev, logEntry]);
  }, []);

  const handleRecognitionResult = useCallback((result: ProcessingResult) => {
    setResults(prev => [...prev, result]);
    addLog(`Recognition completed - Success: ${result.success}`);
  }, [addLog]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (isPermissionGranted) {
      fetchLogs();
    }
  }, [isPermissionGranted, fetchLogs]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  if (!isSupported) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <h1 className="text-xl font-bold">Audio Not Supported</h1>
            <p>Your browser does not support the required audio features.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold text-gray-900">Audio Recognition</h1>
          <div className="mt-4 flex flex-wrap gap-4">
            <div className={`px-3 py-1 rounded-full text-sm ${
              isPermissionGranted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              Permission: {isPermissionGranted ? 'Granted' : 'Not Granted'}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Audio Recognition</h2>
            
            {hasPermissionError || error ? (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                <p>Error: {error || 'Permission denied'}</p>
                <button 
                  onClick={requestPermission}
                  className="mt-2 px-4 py-2 bg-red-500 text-white rounded-md"
                >
                  Retry Permission
                </button>
              </div>
            ) : (
              <AudioRecognitionComponent onResult={handleRecognitionResult} />
            )}

            {results.length > 0 && (
              <div className="mt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Results</h3>
                  <button
                    onClick={clearResults}
                    className="px-3 py-1 bg-red-500 text-white rounded-md text-sm"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {results.map((result, index) => (
                    <div key={index} className={`p-3 rounded-md ${
                      result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex justify-between items-start">
                        <span className="font-medium">Result #{index + 1}</span>
                        <span className="text-sm text-gray-500">
                          {result.processingTime.toFixed(2)}ms
                        </span>
                      </div>
                      {result.success && result.result ? (
                        <div className="mt-1 text-sm">
                          Confidence: {result.result.confidence.toFixed(3)}
                        </div>
                      ) : (
                        <div className="mt-1 text-sm text-red-600">
                          {result.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Activity Logs</h3>
              <button
                onClick={clearLogs}
                className="px-3 py-1 bg-red-500 text-white rounded-md text-sm"
              >
                Clear
              </button>
            </div>
            <div className="h-96 overflow-y-auto bg-gray-50 rounded-md p-3">
              {logs.length === 0 ? (
                <div className="text-gray-500 text-sm">No logs available...</div>
              ) : (
                <div className="space-y-1">
                  {logs.map((log, index) => (
                    <div key={index} className="text-xs font-mono text-gray-700">
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}