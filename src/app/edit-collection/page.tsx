// src/app/edit-collection/page.tsx

'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

type Album = {
  id: number;
  artist: string;
  title: string;
  year: string | null;
  format: string;
  image_url: string | null;
  folder: string;
  for_sale: boolean;
  sale_price: number | null;
  date_added: string | null;
  media_condition: string;
  custom_tags: string[] | null;
};

function CollectionBrowserPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'both' | 'albums' | 'tracks'>('albums');
  const [showSearchTypeDropdown, setShowSearchTypeDropdown] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<string>('All');
  const [folderMode, setFolderMode] = useState<string>('format');
  const [selectedFolderValue, setSelectedFolderValue] = useState<string | null>(null);
  const [collectionFilter, setCollectionFilter] = useState<string>('All');
  const [showCollectionDropdown, setShowCollectionDropdown] = useState(false);
  const [folderSearch, setFolderSearch] = useState('');
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<number>>(new Set());
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [activeCollection, setActiveCollection] = useState('music');

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <>
      {/* FORCE HIDE ANY PARENT NAVIGATION */}
      <style jsx global>{`
        body > div:first-child > nav,
        body > div:first-child > header:not(.clz-header),
        body > nav,
        body > header:not(.clz-header),
        [class*="navigation"],
        [class*="Navigation"],
        [class*="navbar"],
        [class*="NavBar"],
        [class*="sidebar"]:not(.clz-sidebar),
        [class*="Sidebar"]:not(.clz-sidebar) {
          display: none !important;
        }
        body {
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
      `}</style>

      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        zIndex: 9999
      }}>
        {/* HAMBURGER SIDEBAR */}
        {sidebarOpen && (
          <>
            <div
              onClick={() => setSidebarOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                zIndex: 19999
              }}
            />
            <div className="clz-sidebar" style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: '280px',
              background: '#2C2C2C',
              color: 'white',
              zIndex: 20000,
              overflowY: 'auto',
              padding: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>CLZ MUSIC WEB</div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    fontSize: '24px',
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#999', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Collection</div>
                <button style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px', borderRadius: '4px', fontSize: '14px' }}>
                  <span style={{ marginRight: '10px' }}>➕</span> Add Albums from Core
                </button>
                <button style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px', fontSize: '14px' }}>
                  <span style={{ marginRight: '10px' }}>📋</span> Manage Pick Lists
                </button>
                <button style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px', fontSize: '14px' }}>
                  <span style={{ marginRight: '10px' }}>⚙️</span> Manage Collections
                </button>
              </div>

              <hr style={{ borderColor: '#444', margin: '20px 0' }} />

              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#999', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tools</div>
                <button style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px', fontSize: '14px' }}>
                  <span style={{ marginRight: '10px' }}>🖨️</span> Print to PDF
                </button>
                <button style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px', fontSize: '14px' }}>
                  <span style={{ marginRight: '10px' }}>📊</span> Statistics
                </button>
                <button style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px', fontSize: '14px' }}>
                  <span style={{ marginRight: '10px' }}>🔍</span> Find Duplicates
                </button>
                <button style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', marginBottom: '5px', fontSize: '14px' }}>
                  <span style={{ marginRight: '10px' }}>📚</span> Loan Manager
                </button>
              </div>
            </div>
          </>
        )}

        {/* ROW 1: ORANGE GRADIENT HEADER */}
        <div className="clz-header" style={{
          background: 'linear-gradient(to right, #FF8C00, #FFA500)',
          color: 'white',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '50px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '20px',
                padding: '4px'
              }}
            >
              ☰
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>♪</span>
              <span style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '0.5px' }}>CLZ MUSIC</span>
              <span style={{ fontSize: '15px', fontWeight: 300 }}>WEB</span>
            </div>
            <span style={{ fontSize: '13px', opacity: 0.95 }}>976277's music</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px', padding: '4px' }}>⊞</button>
            <button style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px', padding: '4px' }}>👤</button>
          </div>
        </div>

        {/* ROW 3: MAIN TOOLBAR */}
        <div style={{
          background: '#3A3A3A',
          color: 'white',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
          height: '48px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: '0 0 auto' }}>
            <button style={{
              background: '#17a2b8',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap'
            }}>
              <span style={{ fontSize: '16px' }}>+</span>
              <span>Add Albums</span>
            </button>

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowCollectionDropdown(!showCollectionDropdown)}
                style={{
                  background: '#2a2a2a',
                  color: 'white',
                  border: '1px solid #555',
                  padding: '6px 12px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>📚</span>
                <span>{collectionFilter}</span>
                <span style={{ fontSize: '10px' }}>▼</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '2px', alignItems: 'center', flex: '1 1 auto', justifyContent: 'center' }}>
            <button
              onClick={() => setSelectedLetter('All')}
              style={{
                background: selectedLetter === 'All' ? '#5A9BD5' : 'transparent',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: '12px',
                borderRadius: '2px'
              }}
            >
              All
            </button>
            <button
              onClick={() => setSelectedLetter('0-9')}
              style={{
                background: selectedLetter === '0-9' ? '#5A9BD5' : 'transparent',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: '12px',
                borderRadius: '2px'
              }}
            >
              0-9
            </button>
            {alphabet.map(letter => (
              <button
                key={letter}
                onClick={() => setSelectedLetter(letter)}
                style={{
                  background: selectedLetter === letter ? '#5A9BD5' : 'transparent',
                  color: 'white',
                  border: 'none',
                  padding: '4px 7px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  borderRadius: '2px',
                  minWidth: '20px'
                }}
              >
                {letter}
              </button>
            ))}
            <button style={{
              background: 'transparent',
              color: 'white',
              border: 'none',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '14px',
              marginLeft: '4px'
            }}>⚙️</button>
          </div>

          <div style={{ display: 'flex', gap: '0', alignItems: 'center', flex: '0 0 auto' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowSearchTypeDropdown(!showSearchTypeDropdown)}
                style={{
                  background: '#2a2a2a',
                  color: 'white',
                  border: '1px solid #555',
                  borderRight: 'none',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  borderRadius: '3px 0 0 3px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  height: '32px'
                }}
              >
                <span>🔍</span>
                <span style={{ fontSize: '10px' }}>▼</span>
              </button>
            </div>
            <input
              type="text"
              placeholder="Search albums..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: '#2a2a2a',
                color: 'white',
                border: '1px solid #555',
                borderLeft: 'none',
                padding: '6px 12px',
                borderRadius: '0 3px 3px 0',
                fontSize: '13px',
                width: '220px',
                height: '32px',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* SELECTION TOOLBAR */}
        {selectedAlbumIds.size > 0 && (
          <div style={{
            background: '#5BA3D0',
            color: 'white',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            height: '40px',
            flexShrink: 0
          }}>
            <button
              onClick={() => setSelectedAlbumIds(new Set())}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                padding: '4px 10px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              ✕ Cancel
            </button>
            <button style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '4px 10px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}>☑ All</button>
            <button style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '4px 10px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}>✏️ Edit</button>
            <button style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '4px 10px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}>🗑 Remove</button>
            <button style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '4px 10px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}>🖨 Print to PDF</button>
            <button style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '4px 10px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}>⋮</button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: '12px', fontWeight: 500 }}>
              {selectedAlbumIds.size} of 535 selected
            </span>
          </div>
        )}

        {/* THREE-COLUMN BODY */}
        <div style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          minHeight: 0
        }}>
          {/* LEFT COLUMN: Folder Panel */}
          <div style={{
            width: '220px',
            background: '#2C2C2C',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRight: '1px solid #1a1a1a',
            flexShrink: 0
          }}>
            <div style={{
              padding: '10px',
              borderBottom: '1px solid #1a1a1a',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
            }}>
              <button style={{
                background: '#3a3a3a',
                color: 'white',
                border: '1px solid #555',
                padding: '5px 10px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span>📁</span>
                <span>Format</span>
                <span style={{ fontSize: '10px' }}>▼</span>
              </button>
              <button style={{
                background: 'transparent',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '4px'
              }}>☰</button>
            </div>

            <div style={{ padding: '10px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
              <input
                type="text"
                placeholder="Search format..."
                value={folderSearch}
                onChange={(e) => setFolderSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  background: '#3a3a3a',
                  color: 'white',
                  border: '1px solid #555',
                  borderRadius: '3px',
                  fontSize: '12px',
                  outline: 'none'
                }}
              />
              <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                <button style={{
                  background: '#3a3a3a',
                  color: 'white',
                  border: '1px solid #555',
                  padding: '4px 8px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}>🔤</button>
                <button style={{
                  background: '#3a3a3a',
                  color: 'white',
                  border: '1px solid #555',
                  padding: '4px 8px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}>↕️</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '6px', minHeight: 0 }}>
              <button style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 8px',
                background: '#5A9BD5',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                marginBottom: '3px',
                fontSize: '12px',
                color: 'white',
                textAlign: 'left'
              }}>
                <span>[All Albums]</span>
                <span style={{
                  background: '#3578b3',
                  color: 'white',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 600
                }}>535</span>
              </button>

              {['LP, Album', 'CD, Album', '7", Single', '12", EP'].map((format, idx) => (
                <button
                  key={idx}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 8px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    marginBottom: '3px',
                    fontSize: '12px',
                    color: 'white',
                    textAlign: 'left'
                  }}
                >
                  <span>{format}</span>
                  <span style={{
                    background: '#555',
                    color: 'white',
                    padding: '2px 7px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: 600
                  }}>{Math.floor(Math.random() * 100)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* CENTER COLUMN: Table */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: '#fff',
            minWidth: 0
          }}>
            {/* CENTER COLUMN TOOLBAR */}
            <div style={{
              padding: '6px 12px',
              borderBottom: '1px solid #555',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#4a4a4a',
              height: '40px',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button style={{
                  background: '#3a3a3a',
                  border: '1px solid #555',
                  padding: '4px 9px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  <span>☰</span>
                  <span style={{ fontSize: '9px' }}>▼</span>
                </button>
                
                <button style={{
                  background: '#3a3a3a',
                  border: '1px solid #555',
                  padding: '4px 9px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  <span>↕️</span>
                  <span style={{ fontSize: '9px' }}>▼</span>
                </button>
                
                <button style={{
                  background: '#3a3a3a',
                  border: '1px solid #555',
                  padding: '4px 9px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  <span>⊞</span>
                  <span style={{ fontSize: '9px' }}>▼</span>
                </button>
              </div>
              <div style={{ fontSize: '12px', color: '#ddd', fontWeight: 600 }}>
                535 albums
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', background: '#fff', minHeight: 0 }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '13px'
              }}>
                <thead>
                  <tr style={{
                    background: '#f5f5f5',
                    borderBottom: '2px solid #ddd',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10
                  }}>
                    <th style={{ width: '30px', padding: '8px', textAlign: 'center', borderRight: '1px solid #e0e0e0', color: '#333' }}>
                      <input type="checkbox" style={{ cursor: 'pointer' }} />
                    </th>
                    <th style={{ width: '30px', padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #e0e0e0', color: '#333', fontWeight: 600 }}>✓</th>
                    <th style={{ width: '30px', padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #e0e0e0', color: '#333', fontWeight: 600 }}>$</th>
                    <th style={{ width: '30px', padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #e0e0e0', color: '#333', fontWeight: 600 }}>✏</th>
                    <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid #e0e0e0', cursor: 'pointer', color: '#333' }}>
                      Artist <span style={{ fontSize: '10px' }}>▲</span>
                    </th>
                    <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid #e0e0e0', cursor: 'pointer', color: '#333' }}>
                      Title <span style={{ fontSize: '10px' }}>▲</span>
                    </th>
                    <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid #e0e0e0', width: '110px', color: '#333' }}>Release Date</th>
                    <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid #e0e0e0', width: '150px', color: '#333' }}>Format</th>
                    <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600, borderRight: '1px solid #e0e0e0', width: '50px', color: '#333' }}>Discs</th>
                    <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600, borderRight: '1px solid #e0e0e0', width: '60px', color: '#333' }}>Tracks</th>
                    <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid #e0e0e0', width: '70px', color: '#333' }}>Length</th>
                    <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid #e0e0e0', width: '130px', color: '#333' }}>Genre</th>
                    <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid #e0e0e0', width: '130px', color: '#333' }}>Label</th>
                    <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, width: '110px', color: '#333' }}>Added Date</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { artist: '...And You Will Know Us By The Trail Of Dead', title: 'Source Tags & Codes', year: '2002', format: 'CD, Album', discs: 1, tracks: 11, length: '45:54', genre: 'Alternative Rock', label: 'Interscope Records', added: 'Feb 26, 2002' },
                    { artist: "'Til Tuesday", title: 'Welcome Home', year: '1986', format: 'Cass, Album, Gre', discs: 1, tracks: 10, length: '38:22', genre: 'New Wave', label: 'Epic', added: 'Jan 15, 1986' },
                    { artist: '"Bonanza" Cast', title: 'Ponderosa Party Time!', year: '1962', format: 'LP, Album, Hol', discs: 1, tracks: 12, length: '32:10', genre: 'Country', label: 'RCA Victor', added: 'Mar 5, 1962' },
                  ].map((album, idx) => (
                    <tr 
                      key={idx}
                      onClick={() => setSelectedAlbumId(idx)}
                      style={{
                        background: selectedAlbumId === idx ? '#d4e9f7' : idx % 2 === 0 ? '#fff' : '#fafafa',
                        borderBottom: '1px solid #e8e8e8',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedAlbumId !== idx) {
                          e.currentTarget.style.background = '#f5f5f5';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedAlbumId !== idx) {
                          e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa';
                        }
                      }}
                    >
                      <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #e8e8e8' }}>
                        <input 
                          type="checkbox" 
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #e8e8e8', color: '#4CAF50', fontSize: '14px' }}>✓</td>
                      <td style={{ padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #e8e8e8', color: '#666' }}></td>
                      <td style={{ padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #e8e8e8' }}>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#2196F3', padding: 0 }}>✏</button>
                      </td>
                      <td style={{ padding: '8px', borderRight: '1px solid #e8e8e8', color: '#333' }}>{album.artist}</td>
                      <td style={{ padding: '8px', borderRight: '1px solid #e8e8e8', color: '#2196F3' }}>{album.title}</td>
                      <td style={{ padding: '8px', borderRight: '1px solid #e8e8e8', color: '#333' }}>{album.added}</td>
                      <td style={{ padding: '8px', borderRight: '1px solid #e8e8e8', color: '#333' }}>{album.format}</td>
                      <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #e8e8e8', color: '#333' }}>{album.discs}</td>
                      <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #e8e8e8', color: '#333' }}>{album.tracks}</td>
                      <td style={{ padding: '8px', borderRight: '1px solid #e8e8e8', color: '#333' }}>{album.length}</td>
                      <td style={{ padding: '8px', borderRight: '1px solid #e8e8e8', color: '#333' }}>{album.genre}</td>
                      <td style={{ padding: '8px', borderRight: '1px solid #e8e8e8', color: '#333' }}>{album.label}</td>
                      <td style={{ padding: '8px', color: '#333' }}>{album.added}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT COLUMN: Detail Panel */}
          {selectedAlbumId !== null && (
            <div style={{
              width: '380px',
              background: '#fff',
              borderLeft: '1px solid #ddd',
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0
            }}>
              {/* DARK GREY HEADER BAR with toolbar */}
              <div style={{
                padding: '6px 12px',
                borderBottom: '1px solid #555',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#4a4a4a',
                height: '40px',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button style={{
                    background: '#3a3a3a',
                    border: '1px solid #555',
                    padding: '6px 10px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: 'white'
                  }}>✏️</button>

                  <button style={{
                    background: '#3a3a3a',
                    border: '1px solid #555',
                    padding: '6px 10px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: 'white'
                  }}>↗️</button>

                  <button style={{
                    background: '#3a3a3a',
                    border: '1px solid #555',
                    padding: '6px 10px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: 'white',
                    fontWeight: 600
                  }}>eBay</button>

                  <button style={{
                    background: '#3a3a3a',
                    border: '1px solid #555',
                    padding: '6px 10px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: 'white'
                  }}>⋮</button>
                </div>
                
                <button style={{
                  background: '#3a3a3a',
                  border: '1px solid #555',
                  padding: '4px 9px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  <span>⊞</span>
                  <span style={{ fontSize: '9px' }}>▼</span>
                </button>
              </div>

              <div style={{ padding: '16px', flex: 1, overflowY: 'auto', background: '#f5f5f5' }}>
                {/* Artist Name */}
                <div style={{ fontSize: '14px', color: '#333', marginBottom: '4px' }}>
                  ...And You Will Know Us By The Trail Of Dead
                </div>

                {/* Album Title with checkmark */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <h4 style={{ color: '#2196F3', margin: 0, fontSize: '18px', fontWeight: 600 }}>
                    Source Tags & Codes
                  </h4>
                  <div style={{
                    background: '#2196F3',
                    color: 'white',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>✓</div>
                </div>

                {/* Album Cover */}
                <div style={{
                  width: '100%',
                  aspectRatio: '1',
                  background: '#fff',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#999',
                  fontSize: '48px',
                  border: '1px solid #ddd'
                }}>🎵</div>

                {/* Pagination dots */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '8px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: '#333'
                  }}></div>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: '#ccc'
                  }}></div>
                </div>

                {/* Label */}
                <div style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#333',
                  marginBottom: '8px'
                }}>
                  Interscope Records (2002)
                </div>

                {/* Genres */}
                <div style={{
                  fontSize: '14px',
                  color: '#666',
                  marginBottom: '16px'
                }}>
                  Alternative Rock | Art Rock | Post-Hardcore | Rock
                </div>

                {/* Barcode */}
                <div style={{
                  fontSize: '14px',
                  color: '#333',
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '16px' }}>|||||||</span>
                  <span>606949323622</span>
                </div>

                {/* Country */}
                <div style={{
                  fontSize: '14px',
                  color: '#333',
                  marginBottom: '8px'
                }}>
                  US
                </div>

                {/* Format */}
                <div style={{
                  fontSize: '14px',
                  color: '#333',
                  marginBottom: '16px',
                  fontWeight: 600
                }}>
                  CD, Album | 1 Disc | 11 Tracks | 45:54
                </div>

                {/* Catalog Number */}
                <div style={{
                  fontSize: '13px',
                  color: '#999',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  CAT NO <span style={{ color: '#333', fontWeight: 600 }}>069493236-2</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM ROW: Collection Tabs */}
        <div style={{
          background: '#1a1a1a',
          borderTop: '1px solid #000',
          padding: 0,
          display: 'flex',
          alignItems: 'stretch',
          height: '40px',
          flexShrink: 0
        }}>
          <button style={{
            background: 'transparent',
            color: 'white',
            border: 'none',
            padding: '0 14px',
            cursor: 'pointer',
            fontSize: '14px',
            borderRight: '1px solid #333'
          }}>☰</button>
          {['music', 'Vinyl', 'Singles (45s and 12")', 'Sale'].map(collection => (
            <button
              key={collection}
              onClick={() => setActiveCollection(collection)}
              style={{
                background: activeCollection === collection ? '#FF8C00' : 'transparent',
                color: 'white',
                border: 'none',
                borderBottom: activeCollection === collection ? '3px solid #FF8C00' : 'none',
                padding: '0 18px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: activeCollection === collection ? 600 : 400
              }}
            >
              {collection}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '16px',
        color: '#666'
      }}>
        Loading...
      </div>
    }>
      <CollectionBrowserPage />
    </Suspense>
  );
}