// Fixed Album Suggestion Component with correct database field mapping
// Replace: src/components/AlbumSuggestionBox.tsx

import { useState } from 'react';

interface AlbumSuggestionBoxProps {
  context?: 'search' | 'voting' | 'general';
  searchQuery?: string;
  onClose?: () => void;
  compact?: boolean;
}

export default function AlbumSuggestionBox({ 
  context = 'general', 
  searchQuery = '', 
  onClose,
  compact = false 
}: AlbumSuggestionBoxProps) {
  const [isOpen, setIsOpen] = useState(!compact);
  const [suggestion, setSuggestion] = useState({
    artist: '',
    album: '',
    reason: '', // Updated to match database schema
    contributionAmount: '',
    contributorName: '', // Updated to match database schema
    contributorEmail: '' // Updated to match database schema
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleOpen = () => {
    if (searchQuery) {
      const parts = searchQuery.split(' - ');
      if (parts.length === 2) {
        setSuggestion(prev => ({
          ...prev,
          artist: parts[0].trim(),
          album: parts[1].trim()
        }));
      } else {
        setSuggestion(prev => ({
          ...prev,
          artist: searchQuery.trim(),
          album: ''
        }));
      }
    }
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSubmitted(false);
    setError('');
    if (onClose) onClose();
  };

  const handleSubmit = async () => {
    if (!suggestion.artist.trim() || !suggestion.album.trim()) {
      setError('Please enter both artist and album name.');
      return;
    }

    if (!suggestion.contributorName.trim() || !suggestion.contributorEmail.trim()) {
      setError('Please enter your name and email address so we can let you know when we get the album.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/album-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: suggestion.artist.trim(),
          album: suggestion.album.trim(),
          notes: suggestion.reason.trim(), // Maps to 'reason' field in database
          contribution_amount: suggestion.contributionAmount || null,
          suggestor_name: suggestion.contributorName.trim(), // Maps to 'contributor_name' in database  
          suggestor_email: suggestion.contributorEmail.trim(), // Maps to 'contributor_email' in database
          context,
          search_query: searchQuery
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit suggestion');
      }

      setSubmitted(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to submit suggestion');
    } finally {
      setSubmitting(false);
    }
  };

  const getContextMessage = () => {
    switch (context) {
      case 'search':
        return `Couldn't find "${searchQuery}"? Suggest it for the collection!`;
      case 'voting':
        return "Don't see your favorite album? Suggest it for future additions!";
      default:
        return "Suggest an album for the Dead Wax Dialogues collection";
    }
  };

  const getVenmoUrl = () => {
    const amount = suggestion.contributionAmount || '10';
    const note = `Album suggestion: ${suggestion.artist} - ${suggestion.album}`;
    return `https://venmo.com/deadwaxdialogues?txn=pay&amount=${amount}&note=${encodeURIComponent(note)}`;
  };

  if (compact && !isOpen) {
    return (
      <div 
        style={{
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          color: 'white',
          padding: '12px 20px',
          borderRadius: 8,
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          fontSize: 14,
          fontWeight: 600,
          boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
        }}
        onClick={handleOpen}
      >
        💡 Suggest an Album
      </div>
    );
  }

  if (!isOpen) {
    return (
      <div 
        style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '2px dashed #3b82f6',
          borderRadius: 12,
          padding: 20,
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onClick={handleOpen}
      >
        <div style={{ fontSize: 24, marginBottom: 8 }}>💡</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: '#3b82f6' }}>
          {getContextMessage()}
        </div>
        <div style={{ fontSize: 14, color: '#6b7280' }}>
          Click to suggest • Optional Venmo contributions welcome
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #10b981, #047857)',
        color: 'white',
        borderRadius: 12,
        padding: 24,
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
        <h3 style={{ fontSize: 18, margin: '0 0 8px 0' }}>
          Suggestion Submitted!
        </h3>
        <p style={{ fontSize: 14, margin: '0 0 16px 0', opacity: 0.9 }}>
          Thanks for suggesting &ldquo;{suggestion.artist} - {suggestion.album}&rdquo;
        </p>
        
        {suggestion.contributionAmount && (
          <div style={{ marginBottom: 16 }}>
            <a
              href={getVenmoUrl()}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#00d4ff',
                color: '#000',
                padding: '10px 20px',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 'bold',
                display: 'inline-block'
              }}
            >
              💸 Contribute ${suggestion.contributionAmount} on Venmo
            </a>
          </div>
        )}
        
        <button
          onClick={handleClose}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div style={{
      background: '#fff',
      border: '2px solid #e5e7eb',
      borderRadius: 12,
      padding: 24,
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
      color: '#222',
      marginBottom: 16
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, margin: 0, fontWeight: 'bold' }}>
          💡 Suggest an Album
        </h3>
        <button
          onClick={handleClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 18,
            cursor: 'pointer',
            color: '#6b7280'
          }}
        >
          ✕
        </button>
      </div>

      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
        {getContextMessage()}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <input
          type="text"
          value={suggestion.artist}
          onChange={e => setSuggestion(prev => ({ ...prev, artist: e.target.value }))}
          placeholder="Artist Name"
          style={{
            padding: '10px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 14,
            outline: 'none',
            width: '100%'
          }}
        />
        <input
          type="text"
          value={suggestion.album}
          onChange={e => setSuggestion(prev => ({ ...prev, album: e.target.value }))}
          placeholder="Album Title"
          style={{
            padding: '10px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 14,
            outline: 'none',
            width: '100%'
          }}
        />
      </div>

      <textarea
        value={suggestion.reason}
        onChange={e => setSuggestion(prev => ({ ...prev, reason: e.target.value }))}
        placeholder="Why should we add this album? (optional)"
        rows={2}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          fontSize: 14,
          marginBottom: 16,
          resize: 'none',
          outline: 'none'
        }}
      />

      <div style={{ 
        background: '#f0f9ff', 
        border: '1px solid #0369a1', 
        borderRadius: 8, 
        padding: 16,
        marginBottom: 16 
      }}>
        <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 8, color: '#0c4a6e' }}>
          💸 Optional Contribution via Venmo
        </div>
        <div style={{ fontSize: 12, color: '#0369a1', marginBottom: 12 }}>
          Help fund album purchases! Venmo: @deadwaxdialogues
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, alignItems: 'center' }}>
          <input
            type="number"
            value={suggestion.contributionAmount}
            onChange={e => setSuggestion(prev => ({ ...prev, contributionAmount: e.target.value }))}
            placeholder="10.00"
            min="1"
            step="0.01"
            style={{
              padding: '8px 10px',
              border: '1px solid #bfdbfe',
              borderRadius: 4,
              fontSize: 14,
              outline: 'none'
            }}
          />
          <div style={{ fontSize: 12, color: '#0369a1' }}>
            Enter amount (optional) - you&rsquo;ll get a Venmo link after submitting
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <input
            type="text"
            value={suggestion.contributorName}
            onChange={e => setSuggestion(prev => ({ ...prev, contributorName: e.target.value }))}
            placeholder="Your Name (required) *"
            required
            style={{
              padding: '8px 10px',
              border: '2px solid #d1d5db',
              borderRadius: 4,
              fontSize: 12,
              outline: 'none',
              width: '100%'
            }}
          />
        </div>
        <div>
          <input
            type="email"
            value={suggestion.contributorEmail}
            onChange={e => setSuggestion(prev => ({ ...prev, contributorEmail: e.target.value }))}
            placeholder="Your Email (required) *"
            required
            style={{
              padding: '8px 10px',
              border: '2px solid #d1d5db',
              borderRadius: 4,
              fontSize: 12,
              outline: 'none',
              width: '100%'
            }}
          />
        </div>
      </div>

      <div style={{ 
        fontSize: 11, 
        color: '#6b7280', 
        marginBottom: 16,
        fontStyle: 'italic'
      }}>
        * Required so we can let you know when we get the album!
      </div>

      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          color: '#dc2626',
          borderRadius: 6,
          padding: 8,
          fontSize: 12,
          marginBottom: 12
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button
          onClick={handleClose}
          style={{
            background: '#f3f4f6',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            background: submitting ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: '8px 16px',
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 'bold'
          }}
        >
          {submitting ? 'Submitting...' : 'Submit Suggestion'}
        </button>
      </div>
    </div>
  );
}