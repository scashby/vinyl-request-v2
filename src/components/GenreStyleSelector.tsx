// src/components/GenreStyleSelector.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from 'lib/supabaseClient';

type GenreStyleSelectorProps = {
  value: string[];
  onChange: (value: string[]) => void;
  type: 'genre' | 'style';
  placeholder?: string;
};

export default function GenreStyleSelector({ value, onChange, type, placeholder }: GenreStyleSelectorProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    try {
      const field = type === 'genre' ? 'genres' : 'styles';
      const { data, error } = await supabase
        .from('masters')
        .select(field)
        .not(field, 'is', null);

      if (error) throw error;

      const allItems = new Set<string>();
      data?.forEach((row) => {
        const items = row[field];
        if (Array.isArray(items)) {
          items.forEach((item: string) => allItems.add(item));
        }
      });

      setOptions(Array.from(allItems).sort());
    } catch (error) {
      console.error(`Error loading ${type}s:`, error);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(
    (option) =>
      !value.includes(option) &&
      option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = (item: string) => {
    if (!value.includes(item)) {
      onChange([...value, item]);
    }
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleRemove = (item: string) => {
    onChange(value.filter((v) => v !== item));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      e.preventDefault();
      const trimmed = searchTerm.trim();
      if (!value.includes(trimmed)) {
        onChange([...value, trimmed]);
        setSearchTerm('');
        if (!options.includes(trimmed)) {
          setOptions([...options, trimmed].sort());
        }
      }
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Selected items */}
      {value.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: 8,
          padding: 8,
          background: '#f9fafb',
          borderRadius: 6,
          border: '1px solid #e5e7eb'
        }}>
          {value.map((item) => (
            <span
              key={item}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                background: type === 'genre' ? '#dbeafe' : '#fce7f3',
                color: type === 'genre' ? '#1e40af' : '#be185d',
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 500
              }}
            >
              {item}
              <button
                onClick={() => handleRemove(item)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 16,
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || `Type to search or add ${type}...`}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          fontSize: 14,
          color: '#1f2937',
          backgroundColor: 'white'
        }}
      />

      {/* Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          background: 'white',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          maxHeight: 200,
          overflowY: 'auto',
          zIndex: 100
        }}>
          {loading ? (
            <div style={{ padding: 12, color: '#6b7280', textAlign: 'center', fontSize: 13 }}>
              Loading...
            </div>
          ) : filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <div
                key={option}
                onClick={() => handleAdd(option)}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: '#1f2937',
                  transition: 'background-color 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {option}
              </div>
            ))
          ) : searchTerm.trim() ? (
            <div
              onClick={() => handleAdd(searchTerm.trim())}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                fontSize: 14,
                color: '#059669',
                fontWeight: 500
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f0fdf4';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              + Create &quot;{searchTerm.trim()}&quot;
            </div>
          ) : (
            <div style={{ padding: 12, color: '#6b7280', textAlign: 'center', fontSize: 13 }}>
              No {type}s found. Type to create a new one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// AUDIT: inspected, no changes.
