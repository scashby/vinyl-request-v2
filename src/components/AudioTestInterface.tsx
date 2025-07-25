// src/components/AudioTestInterface.tsx

import React, { useState, useCallback } from 'react';
import { useAudioCapture, ProcessingResult } from 'lib/audio';
import AudioRecognitionComponent from 'components/AudioRecognitionComponent';

const AudioTestInterface: React.FC = () => {
  const [testResults, setTestResults] = useState<ProcessingResult[]>([]);
  const [isTestMode, setIsTestMode] = useState(false);
  
  const {
    isPermissionGranted,
    hasPermissionError,
    requestPermission,
    generateFingerprint
  } = useAudioCapture();

  const handleTestResult = useCallback((result: ProcessingResult) => {
    setTestResults(prev => [...prev, result]);
  }, []);

  const handleGenerateFingerprint = useCallback(async () => {
    if (!isPermissionGranted) {
      await requestPermission();
      return;
    }
    
    const fingerprint = await generateFingerprint();
    console.log('Generated fingerprint:', fingerprint);
  }, [isPermissionGranted, requestPermission, generateFingerprint]);

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="audio-test-interface">
      <div className="test-controls">
        <h2>Audio Recognition Test Interface</h2>
        
        <div className="button-group">
          <button 
            onClick={() => setIsTestMode(!isTestMode)}
            className={isTestMode ? 'active' : ''}
          >
            {isTestMode ? 'Exit Test Mode' : 'Enter Test Mode'}
          </button>
          
          <button 
            onClick={handleGenerateFingerprint}
            disabled={!isPermissionGranted}
          >
            Generate Fingerprint
          </button>
          
          <button onClick={clearResults}>
            Clear Results
          </button>
        </div>

        {hasPermissionError && (
          <div className="error-message">
            Microphone permission is required for testing.
            <button onClick={requestPermission}>Grant Permission</button>
          </div>
        )}
      </div>

      <AudioRecognitionComponent 
        onResult={handleTestResult}
        className={isTestMode ? 'test-mode' : ''}
      />

      {testResults.length > 0 && (
        <div className="test-results">
          <h3>Test Results ({testResults.length})</h3>
          <div className="results-list">
            {testResults.map((result, index) => (
              <div key={index} className={`result-item ${result.success ? 'success' : 'error'}`}>
                <div className="result-header">
                  Test #{index + 1} - {result.success ? 'Success' : 'Failed'}
                </div>
                {result.success && result.result ? (
                  <div className="result-details">
                    <p>Confidence: {result.result.confidence.toFixed(3)}</p>
                    <p>Matches: {result.result.matches.length}</p>
                    <p>Processing: {result.processingTime.toFixed(2)}ms</p>
                  </div>
                ) : (
                  <div className="error-details">
                    Error: {result.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioTestInterface;