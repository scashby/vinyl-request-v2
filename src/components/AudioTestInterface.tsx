// src/components/AudioTestInterface.tsx - Fixed all TypeScript issues
'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from 'types/supabase';
import AudioCapture from './AudioCapture';

interface TestResult {
  timestamp: string;
  service: string;
  status: 'success' | 'error' | 'testing';
  response?: unknown;
  error?: string;
  latency?: number;
}

interface RecognitionResult {
  artist: string;
  title: string;
  album: string;
  confidence: number;
  source: string;
}

interface ServiceConfig {
  name: string;
  endpoint: string;
  enabled: boolean;
  description: string;
}

export default function AudioTestInterface() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isTestingServices, setIsTestingServices] = useState<boolean>(false);
  const [lastRecognitionResult, setLastRecognitionResult] = useState<RecognitionResult | null>(null);
  const [systemStatus, setSystemStatus] = useState<string>('Ready');
  const [logs, setLogs] = useState<string[]>([]);

  const supabase = createClientComponentClient<Database>();

  const services: ServiceConfig[] = [
    {
      name: 'Audio Recognition API',
      endpoint: '/api/audio-recognition',
      enabled: true,
      description: 'Main recognition service with fallback support'
    },
    {
      name: 'Manual Recognition API',
      endpoint: '/api/manual-recognition',
      enabled: true,
      description: 'Manual override and album context management'
    },
    {
      name: 'Album Context API',
      endpoint: '/api/album-context',
      enabled: true,
      description: 'Collection matching and metadata lookup'
    },
    {
      name: 'ACRCloud Test',
      endpoint: '/api/test-acrcloud',
      enabled: true,
      description: 'Direct ACRCloud service test'
    },
    {
      name: 'AudD Test',
      endpoint: '/api/test-audd',
      enabled: true,
      description: 'Direct AudD service test'
    },
    {
      name: 'AcoustID Test',
      endpoint: '/api/test-acoustid',
      enabled: true,
      description: 'Direct AcoustID service test'
    }
  ];

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev.slice(-19), logEntry]); // Keep last 20 logs
  }, []);

  const testService = async (service: ServiceConfig): Promise<TestResult> => {
    const startTime = Date.now();
    addLog(`Testing ${service.name}...`);

    try {
      const response = await fetch(service.endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const latency = Date.now() - startTime;
      const data = await response.json();

      if (response.ok) {
        addLog(`✅ ${service.name}: ${data.message || 'OK'} (${latency}ms)`);
        return {
          timestamp: new Date().toISOString(),
          service: service.name,
          status: 'success',
          response: data,
          latency
        };
      } else {
        addLog(`❌ ${service.name}: HTTP ${response.status} (${latency}ms)`);
        return {
          timestamp: new Date().toISOString(),
          service: service.name,
          status: 'error',
          error: `HTTP ${response.status}: ${data.error || 'Unknown error'}`,
          latency
        };
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      addLog(`❌ ${service.name}: ${errorMessage} (${latency}ms)`);
      
      return {
        timestamp: new Date().toISOString(),
        service: service.name,
        status: 'error',
        error: errorMessage,
        latency
      };
    }
  };

  const testAllServices = async (): Promise<void> => {
    setIsTestingServices(true);
    setSystemStatus('Testing all services...');
    setTestResults([]);
    
    addLog('🚀 Starting comprehensive service test...');

    const results: TestResult[] = [];

    for (const service of services.filter(s => s.enabled)) {
      const result = await testService(service);
      results.push(result);
      setTestResults([...results]);
      
      // Small delay between tests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const totalCount = results.length;
    
    setSystemStatus(`Testing complete: ${successCount}/${totalCount} services available`);
    addLog(`🏁 Testing complete: ${successCount}/${totalCount} services working`);
    setIsTestingServices(false);
  };

  const handleRecognitionResult = useCallback((result: RecognitionResult) => {
    setLastRecognitionResult(result);
    addLog(`🎵 Recognition: ${result.artist} - ${result.title} (${Math.round(result.confidence * 100)}% confidence)`);
    setSystemStatus(`Last recognition: ${result.source} service`);
  }, [addLog]);

  const handleRecognitionError = useCallback((error: string) => {
    addLog(`❌ Recognition error: ${error}`);
    setSystemStatus('Recognition failed');
  }, [addLog]);

  const clearLogs = (): void => {
    setLogs([]);
    addLog('🧹 Logs cleared');
  };

  const clearResults = (): void => {
    setTestResults([]);
    setLastRecognitionResult(null);
    addLog('🗑️ Test results cleared');
  };

  useEffect(() => {
    addLog('🔧 Audio Test Interface initialized');
    setSystemStatus('Ready for testing');
  }, [addLog]);

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '24px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div>
          <h2 style={{ 
            margin: '0 0 8px 0', 
            fontSize: '20px', 
            fontWeight: 'bold',
            color: '#1f2937'
          }}>
            Audio Recognition Test Interface
          </h2>
          <div style={{
            fontSize: '14px',
            color: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: systemStatus.includes('error') || systemStatus.includes('failed') ? '#ef4444' : '#10b981'
            }} />
            Status: {systemStatus}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={testAllServices}
            disabled={isTestingServices}
            style={{
              background: isTestingServices ? '#9ca3af' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: isTestingServices ? 'not-allowed' : 'pointer'
            }}
          >
            {isTestingServices ? '🔄 Testing...' : '🧪 Test All Services'}
          </button>
          
          <button
            onClick={clearResults}
            style={{
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            🗑️ Clear Results
          </button>
        </div>
      </div>

      {/* Audio Capture Component */}
      <AudioCapture
        onRecognitionResult={handleRecognitionResult}
        onError={handleRecognitionError}
        duration={10}
      />

      {/* Last Recognition Result */}
      {lastRecognitionResult && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #22c55e',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <h3 style={{
            margin: '0 0 12px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#16a34a'
          }}>
            🎵 Last Recognition Result
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '14px' }}>
            <div><strong>Artist:</strong> {lastRecognitionResult.artist}</div>
            <div><strong>Title:</strong> {lastRecognitionResult.title}</div>
            <div><strong>Album:</strong> {lastRecognitionResult.album}</div>
            <div><strong>Source:</strong> {lastRecognitionResult.source}</div>
            <div><strong>Confidence:</strong> {Math.round(lastRecognitionResult.confidence * 100)}%</div>
          </div>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px'
      }}>
        {/* Service Test Results */}
        <div>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#374151'
          }}>
            Service Test Results
          </h3>
          
          {testResults.length === 0 ? (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
              color: '#6b7280',
              fontSize: '14px'
            }}>
              No test results yet. Click Test All Services to begin.
            </div>
          ) : (
            <div style={{
              maxHeight: '400px',
              overflowY: 'auto',
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}>
              {testResults.map((result, index) => (
                <div
                  key={index}
                  style={{
                    padding: '12px 16px',
                    borderBottom: index < testResults.length - 1 ? '1px solid #f3f4f6' : 'none',
                    background: result.status === 'success' ? '#f0fdf4' : result.status === 'error' ? '#fef2f2' : '#f8fafc'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}>
                    <span style={{
                      fontWeight: '600',
                      fontSize: '14px'
                    }}>
                      {result.service}
                    </span>
                    <span style={{
                      fontSize: '12px',
                      color: result.status === 'success' ? '#16a34a' : '#dc2626',
                      fontWeight: '600'
                    }}>
                      {result.status === 'success' ? '✅ OK' : '❌ Error'}
                      {result.latency && ` (${result.latency}ms)`}
                    </span>
                  </div>
                  {result.error && (
                    <div style={{
                      fontSize: '12px',
                      color: '#dc2626',
                      fontFamily: 'monospace'
                    }}>
                      {result.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System Logs */}
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: '600',
              color: '#374151'
            }}>
              System Logs
            </h3>
            <button
              onClick={clearLogs}
              style={{
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          </div>
          
          <div style={{
            height: '400px',
            overflowY: 'auto',
            background: '#000',
            color: '#00ff00',
            fontFamily: 'monospace',
            fontSize: '12px',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #374151'
          }}>
            {logs.length === 0 ? (
              <div style={{ color: '#666' }}>System ready. Logs will appear here...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} style={{ marginBottom: '2px' }}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Service Configuration Display */}
      <div style={{ marginTop: '24px' }}>
        <h3 style={{
          margin: '0 0 16px 0',
          fontSize: '16px',
          fontWeight: '600',
          color: '#374151'
        }}>
          Configured Services
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '12px'
        }}>
          {services.map((service, index) => (
            <div
              key={index}
              style={{
                background: service.enabled ? '#f0fdf4' : '#f9fafb',
                border: `1px solid ${service.enabled ? '#bbf7d0' : '#e5e7eb'}`,
                borderRadius: '8px',
                padding: '12px',
                fontSize: '12px'
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px'
              }}>
                <span style={{ fontWeight: '600' }}>{service.name}</span>
                <span style={{
                  background: service.enabled ? '#16a34a' : '#6b7280',
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '12px',
                  fontSize: '10px'
                }}>
                  {service.enabled ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>
              <div style={{ color: '#6b7280', fontSize: '11px', marginBottom: '4px' }}>
                {service.endpoint}
              </div>
              <div style={{ color: '#374151', fontSize: '11px' }}>
                {service.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}