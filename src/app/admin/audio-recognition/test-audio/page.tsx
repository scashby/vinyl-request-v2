// src/app/admin/audio-recognition/test-audio/page.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAudioCapture, ProcessingResult } from 'lib/audio';
import AudioRecognitionComponent from 'components/AudioRecognitionComponent';
import AudioTestInterface from 'components/AudioTestInterface';

interface MouseEventHandler<T = HTMLButtonElement> {
  (event: React.MouseEvent<T>): void;
}

export default function AudioRecognitionTestPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [activeComponent, setActiveComponent] = useState<'recognition' | 'testing'>('recognition');
  const [recognitionResults, setRecognitionResults] = useState<ProcessingResult[]>([]);
  
  const {
    isPermissionGranted,
    hasPermissionError,
    isSupported,
    error,
    metrics,
    fingerprint,
    requestPermission,
    generateFingerprint,
    isAudioPlaying,
    getCaptureState
  } = useAudioCapture();

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  useEffect(() => {
    if (isPermissionGranted) {
      addLog('Audio permission granted');
    }
  }, [isPermissionGranted, addLog]);

  useEffect(() => {
    if (hasPermissionError) {
      addLog('Audio permission error occurred');
    }
  }, [hasPermissionError, addLog]);

  useEffect(() => {
    if (error) {
      addLog(`Error: ${error}`);
    }
  }, [error, addLog]);

  useEffect(() => {
    if (metrics) {
      addLog(`Audio metrics updated - Volume: ${metrics.volume.toFixed(2)}, Frequency: ${metrics.frequency.toFixed(2)}`);
    }
  }, [metrics, addLog]);

  const handleRequestPermission: MouseEventHandler = useCallback(async () => {
    try {
      await requestPermission();
      addLog('Permission request initiated');
    } catch (err) {
      addLog(`Permission request failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [requestPermission, addLog]);

  const handleGenerateFingerprint: MouseEventHandler = useCallback(async () => {
    try {
      const newFingerprint = await generateFingerprint();
      addLog(`Fingerprint generated: ${newFingerprint || 'None'}`);
    } catch (err) {
      addLog(`Fingerprint generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [generateFingerprint, addLog]);

  const handleRecognitionResult = useCallback((result: ProcessingResult) => {
    setRecognitionResults(prev => [...prev, result]);
    addLog(`Recognition completed - Success: ${result.success}, Time: ${result.processingTime.toFixed(2)}ms`);
  }, [addLog]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const clearResults = useCallback(() => {
    setRecognitionResults([]);
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
          <h1 className="text-3xl font-bold text-gray-900">Audio Recognition Test</h1>
          <div className="mt-4 flex flex-wrap gap-4">
            <div className={`px-3 py-1 rounded-full text-sm ${
              isPermissionGranted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              Permission: {isPermissionGranted ? 'Granted' : 'Not Granted'}
            </div>
            <div className={`px-3 py-1 rounded-full text-sm ${
              isAudioPlaying ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
            }`}>
              Audio: {isAudioPlaying ? 'Playing' : 'Silent'}
            </div>
            <div className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800">
              State: {getCaptureState()}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex space-x-4 mb-6">
                <button
                  onClick={() => setActiveComponent('recognition')}
                  className={`px-4 py-2 rounded-md ${
                    activeComponent === 'recognition' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  Recognition Component
                </button>
                <button
                  onClick={() => setActiveComponent('testing')}
                  className={`px-4 py-2 rounded-md ${
                    activeComponent === 'testing' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  Test Interface
                </button>
              </div>

              {activeComponent === 'recognition' ? (
                <AudioRecognitionComponent onResult={handleRecognitionResult} />
              ) : (
                <AudioTestInterface />
              )}
            </div>

            {recognitionResults.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Recognition Results</h3>
                  <button
                    onClick={clearResults}
                    className="px-3 py-1 bg-red-500 text-white rounded-md text-sm"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {recognitionResults.map((result, index) => (
                    <div key={index} className={`p-3 rounded-md ${
                      result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex justify-between items-start">
                        <span className="font-medium">
                          Result #{index + 1}
                        </span>
                        <span className="text-sm text-gray-500">
                          {result.processingTime.toFixed(2)}ms
                        </span>
                      </div>
                      {result.success && result.result ? (
                        <div className="mt-1 text-sm">
                          Confidence: {result.result.confidence.toFixed(3)} | 
                          Matches: {result.result.matches.length}
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

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Controls</h3>
              <div className="space-y-3">
                <button
                  onClick={handleRequestPermission}
                  disabled={isPermissionGranted}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isPermissionGranted ? 'Permission Granted' : 'Request Permission'}
                </button>
                
                <button
                  onClick={handleGenerateFingerprint}
                  disabled={!isPermissionGranted}
                  className="w-full px-4 py-2 bg-green-500 text-white rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Generate Fingerprint
                </button>
              </div>

              {fingerprint && (
                <div className="mt-4 p-3 bg-gray-50 rounded-md">
                  <div className="text-sm font-medium text-gray-700">Current Fingerprint:</div>
                  <div className="text-xs text-gray-600 break-all mt-1">
                    {fingerprint}
                  </div>
                </div>
              )}

              {metrics && (
                <div className="mt-4 p-3 bg-gray-50 rounded-md">
                  <div className="text-sm font-medium text-gray-700 mb-2">Audio Metrics:</div>
                  <div className="space-y-1 text-xs">
                    <div>Volume: {metrics.volume.toFixed(3)}</div>
                    <div>Frequency: {metrics.frequency.toFixed(1)} Hz</div>
                    <div>Clarity: {metrics.clarity.toFixed(3)}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">System Logs</h3>
                <button
                  onClick={clearLogs}
                  className="px-3 py-1 bg-red-500 text-white rounded-md text-sm"
                >
                  Clear
                </button>
              </div>
              <div className="h-64 overflow-y-auto bg-gray-50 rounded-md p-3">
                {logs.length === 0 ? (
                  <div className="text-gray-500 text-sm">No logs yet...</div>
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
    </div>
  );
}