// Fixed Album Suggestion Component with Event Context Support
// Replace: src/components/AlbumSuggestionBox.tsx

import { useState } from 'react';

interface AlbumSuggestionBoxProps {
  context?: 'search' | 'voting' | 'general';
  searchQuery?: string;
  eventId?: string | null;
  eventTitle?: string | null;
  onClose?: () => void;
  compact?: boolean;
}

export default function AlbumSuggestionBox({ 
  context = 'general', 
  searchQuery = '', 
  eventId = null,
  eventTitle = null,
  onClose,
  compact = false 
}: AlbumSuggestionBoxProps) {
  const [isOpen, setIsOpen] = useState(!compact);
  const [suggestion, setSuggestion] = useState({
    artist: '',
    album: '',
    reason: '',
    contributionAmount: '',
    contributorName: '',
    contributorEmail: ''
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
          notes: suggestion.reason.trim(),
          contribution_amount: suggestion.contributionAmount || null,
          suggestor_name: suggestion.contributorName.trim(),
          suggestor_email: suggestion.contributorEmail.trim(),
          context,
          search_query: searchQuery,
          event_id: eventId,
          event_title: eventTitle
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
    const eventContext = eventId && eventTitle ? ` for ${eventTitle}` : '';
    
    switch (context) {
      case 'search':
        return `Couldn't find "${searchQuery}"? Suggest it for the collection${eventContext}!`;
      case 'voting':
        return `Don't see your favorite album? Suggest it for future additions${eventContext}!`;
      default:
        return `Suggest an album for the Dead Wax Dialogues collection${eventContext}`;
    }
  };

  const getVenmoUrl = () => {
    return `https://venmo.com/u/deadwaxdialogues`;
  };

  if (compact && !isOpen) {
    return (
      <div 
        className="bg-gradient-to-br from-blue-500 to-blue-700 text-white px-5 py-3 rounded-lg text-center cursor-pointer transition-all duration-300 text-sm font-bold shadow-sm hover:shadow-md hover:scale-[1.02]"
        onClick={handleOpen}
      >
        💡 Suggest an Album
      </div>
    );
  }

  if (!isOpen) {
    return (
      <div 
        className="bg-blue-50 border-2 border-dashed border-blue-500 rounded-xl p-5 text-center cursor-pointer transition-all duration-300 hover:bg-blue-100"
        onClick={handleOpen}
      >
        <div className="text-2xl mb-2">💡</div>
        <div className="text-base font-bold mb-1 text-blue-500">
          {getContextMessage()}
        </div>
        <div className="text-sm text-gray-500">
          Click to suggest • Optional Venmo contributions welcome
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white rounded-xl p-6 text-center shadow-lg">
        <div className="text-4xl mb-3">🎉</div>
        <h3 className="text-lg font-bold m-0 mb-2">
          Suggestion Submitted!
        </h3>
        <p className="text-sm m-0 mb-4 opacity-90">
          Thanks for suggesting &ldquo;{suggestion.artist} - {suggestion.album}&rdquo;
          {eventId && eventTitle && ` for ${eventTitle}`}
        </p>
        
        {suggestion.contributionAmount && (
          <div className="mb-4">
            <a
              href={getVenmoUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#00d4ff] text-black px-5 py-2.5 rounded-lg no-underline text-sm font-bold inline-block hover:brightness-110 transition-all"
            >
              💸 Contribute ${suggestion.contributionAmount} on Venmo
            </a>
          </div>
        )}
        
        <button
          onClick={handleClose}
          className="bg-white/20 text-white border-none rounded-md px-4 py-2 cursor-pointer text-sm hover:bg-white/30 transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md text-gray-800 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold m-0">
          💡 Suggest an Album
        </h3>
        <button
          onClick={handleClose}
          className="bg-transparent border-none text-lg cursor-pointer text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-5">
        {getContextMessage()}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <input
          type="text"
          value={suggestion.artist}
          onChange={e => setSuggestion(prev => ({ ...prev, artist: e.target.value }))}
          placeholder="Artist Name"
          className="w-full p-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        <input
          type="text"
          value={suggestion.album}
          onChange={e => setSuggestion(prev => ({ ...prev, album: e.target.value }))}
          placeholder="Album Title"
          className="w-full p-2.5 border border-gray-300 rounded-md text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <textarea
        value={suggestion.reason}
        onChange={e => setSuggestion(prev => ({ ...prev, reason: e.target.value }))}
        placeholder="Why should we add this album? (optional)"
        rows={2}
        className="w-full p-2.5 border border-gray-300 rounded-md text-sm mb-4 resize-none outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />

      <div className="bg-sky-50 border border-sky-600 rounded-lg p-4 mb-4">
        <div className="text-sm font-bold mb-2 text-sky-900">
          💸 Optional Contribution via Venmo
        </div>
        <div className="text-xs text-sky-700 mb-3">
          Help fund album purchases! Venmo: @deadwaxdialogues
        </div>
        
        <div className="grid grid-cols-[120px_1fr] gap-3 items-center">
          <input
            type="number"
            value={suggestion.contributionAmount}
            onChange={e => setSuggestion(prev => ({ ...prev, contributionAmount: e.target.value }))}
            placeholder="10.00"
            min="1"
            step="0.01"
            className="p-2 border border-blue-200 rounded text-sm outline-none focus:border-blue-500"
          />
          <div className="text-xs text-sky-700">
            Enter amount (optional) - you&rsquo;ll get a Venmo link after submitting
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div>
          <input
            type="text"
            value={suggestion.contributorName}
            onChange={e => setSuggestion(prev => ({ ...prev, contributorName: e.target.value }))}
            placeholder="Your Name (required) *"
            required
            className="w-full p-2 border-2 border-gray-300 rounded text-xs outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <input
            type="email"
            value={suggestion.contributorEmail}
            onChange={e => setSuggestion(prev => ({ ...prev, contributorEmail: e.target.value }))}
            placeholder="Your Email (required) *"
            required
            className="w-full p-2 border-2 border-gray-300 rounded text-xs outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="text-[11px] text-gray-500 mb-4 italic">
        * Required so we can let you know when we get the album!
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-600 rounded-md p-2 text-xs mb-3">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <button
          onClick={handleClose}
          className="bg-gray-100 text-gray-700 border border-gray-300 rounded-md px-4 py-2 cursor-pointer text-sm hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className={`px-4 py-2 border-none rounded-md text-sm font-bold text-white transition-colors ${
            submitting 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-500 cursor-pointer hover:bg-blue-600'
          }`}
        >
          {submitting ? 'Submitting...' : 'Submit Suggestion'}
        </button>
      </div>
    </div>
  );
}
// AUDIT: inspected, no changes.
