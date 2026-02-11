// src/app/edit-collection/Header.tsx
'use client';

import { useState } from 'react';
import { SettingsModal } from './settings/SettingsModal';
import ManagePickListsModal from './ManagePickListsModal';
import ManageCratesModal from './crates/ManageCratesModal';
import NewCrateModal from './crates/NewCrateModal';
import NewSmartCrateModal from './crates/NewSmartCrateModal';
import { PrintToPDFModal } from './PrintToPDFModal';
import { StatisticsModal } from './StatisticsModal';
import ImportSelectionModal from './components/ImportSelectionModal';
import ImportDiscogsModal from './components/ImportDiscogsModal';
import ImportCLZModal from './components/ImportCLZModal';
import ImportCSVModal from './components/ImportCSVModal';
import ImportEnrichModal from './components/ImportEnrichModal';
import FindDuplicatesModal from './FindDuplicatesModal';
import type { Album } from '../../types/album';
import type { Crate } from '../../types/crate';

interface HeaderProps {
  albums?: Album[];
  loadAlbums?: () => Promise<void>;
  loadCrates?: () => Promise<void>;
  filteredAndSortedAlbums?: Album[];
  selectedAlbumIds?: Set<number>;
  onOpenManagePlaylists?: () => void;
  onOpenExportCsvTxt?: () => void;
}

export default function Header({ 
  albums = [], 
  loadAlbums = async () => {}, 
  loadCrates = async () => {},
  filteredAndSortedAlbums = [],
  selectedAlbumIds = new Set(),
  onOpenManagePlaylists = () => {},
  onOpenExportCsvTxt = () => {}
}: HeaderProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showManagePickListsModal, setShowManagePickListsModal] = useState(false);
  const [showManageCratesModal, setShowManageCratesModal] = useState(false);
  const [showNewCrateModal, setShowNewCrateModal] = useState(false);
  const [showNewSmartCrateModal, setShowNewSmartCrateModal] = useState(false);
  const [showPrintToPDF, setShowPrintToPDF] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImportDiscogsModal, setShowImportDiscogsModal] = useState(false);
  const [showImportCLZModal, setShowImportCLZModal] = useState(false);
  const [showImportCSVModal, setShowImportCSVModal] = useState(false);
  const [showImportEnrichModal, setShowImportEnrichModal] = useState(false);
  const [showFindDuplicates, setShowFindDuplicates] = useState(false);
  const [editingCrate, setEditingCrate] = useState<Crate | null>(null);

  return (
    <>
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[19999]" onClick={() => setSidebarOpen(false)} />
          <div className="fixed top-0 left-0 bottom-0 w-[280px] bg-[#2C2C2C] text-white z-[20000] overflow-y-auto p-5 clz-sidebar">
            <div className="flex justify-between items-center mb-6 text-lg font-semibold">
              <div>DWD COLLECTION</div>
              <button onClick={() => setSidebarOpen(false)} title="Close menu" className="bg-none border-none text-white text-2xl cursor-pointer">×</button>
            </div>

            <div className="mb-5">
              <div className="text-[11px] font-semibold text-[#999] mb-2.5 uppercase tracking-wider">Collection</div>
              <button onClick={() => { setSidebarOpen(false); setShowManagePickListsModal(true); }} title="Create and manage pick lists" className="w-full p-2.5 bg-transparent border-none text-white text-left cursor-pointer mb-1 text-sm hover:bg-white/5 rounded transition-colors">
                <span className="mr-2.5">📋</span> Manage Pick Lists
              </button>
              <button onClick={() => { setSidebarOpen(false); setShowManageCratesModal(true); }} title="Manage crates (DJ workflow organization)" className="w-full p-2.5 bg-transparent border-none text-white text-left cursor-pointer mb-1 text-sm hover:bg-white/5 rounded transition-colors">
                <span className="mr-2.5">📦</span> Manage Crates
              </button>
              <button onClick={() => { setSidebarOpen(false); onOpenManagePlaylists(); }} title="Manage playlists (track-based organization)" className="w-full p-2.5 bg-transparent border-none text-white text-left cursor-pointer mb-1 text-sm hover:bg-white/5 rounded transition-colors">
                <span className="mr-2.5">🎵</span> Manage Playlists
              </button>
            </div>

            <hr className="border-[#444] my-5" />

            <div className="mb-5">
              <div className="text-[11px] font-semibold text-[#999] mb-2.5 uppercase tracking-wider">Tools</div>
              <button onClick={() => { setSidebarOpen(false); setShowPrintToPDF(true); }} title="Export collection to PDF" className="w-full p-2.5 bg-transparent border-none text-white text-left cursor-pointer mb-1 text-sm hover:bg-white/5 rounded transition-colors">
                <span className="mr-2.5">🖨️</span> Print to PDF
              </button>
              <button onClick={() => { setSidebarOpen(false); onOpenExportCsvTxt(); }} title="Export collection/tracks to CSV or TXT" className="w-full p-2.5 bg-transparent border-none text-white text-left cursor-pointer mb-1 text-sm hover:bg-white/5 rounded transition-colors">
                <span className="mr-2.5">📄</span> Export CSV / TXT
              </button>
              <button onClick={() => { setSidebarOpen(false); setShowStatistics(true); }} title="View collection statistics" className="w-full p-2.5 bg-transparent border-none text-white text-left cursor-pointer mb-1 text-sm hover:bg-white/5 rounded transition-colors">
                <span className="mr-2.5">📊</span> Statistics
              </button>
              <button onClick={() => { setSidebarOpen(false); setShowImportModal(true); }} title="Import album data from various sources" className="w-full p-2.5 bg-transparent border-none text-white text-left cursor-pointer mb-1 text-sm hover:bg-white/5 rounded transition-colors">
                <span className="mr-2.5">📥</span> Import Data
              </button>
              <button onClick={() => { setSidebarOpen(false); setShowFindDuplicates(true); }} title="Find duplicate albums" className="w-full p-2.5 bg-transparent border-none text-white text-left cursor-pointer mb-1 text-sm hover:bg-white/5 rounded transition-colors">
                <span className="mr-2.5">🔍</span> Find Duplicates
              </button>
              <button title="Track loaned albums" className="w-full p-2.5 bg-transparent border-none text-white text-left cursor-pointer mb-1 text-sm hover:bg-white/5 rounded transition-colors">
                <span className="mr-2.5">📚</span> Loan Manager
              </button>
              <button onClick={() => { setSidebarOpen(false); setShowSettings(true); }} title="Application settings" className="w-full p-2.5 bg-transparent border-none text-white text-left cursor-pointer mb-1 text-sm hover:bg-white/5 rounded transition-colors">
                <span className="mr-2.5">⚙️</span> Settings
              </button>
            </div>
          </div>
        </>
      )}

      <div className="bg-gradient-to-r from-[#8809AC] to-[#A855F7] text-white px-4 py-2 flex items-center justify-between h-[50px] shrink-0 clz-header">
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)} title="Open menu" className="bg-none border-none text-white cursor-pointer text-xl p-1 hover:bg-white/10 rounded transition-colors">☰</button>
          <div className="flex items-center gap-2 select-none">
            <span className="text-[18px]">♪</span>
            <span className="text-[15px] font-semibold tracking-[0.5px]">DWD Collection Management System</span>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <button title="Grid view" className="bg-none border-none text-white cursor-pointer text-lg p-1 hover:bg-white/10 rounded">⊞</button>
          <button title="User account" className="bg-none border-none text-white cursor-pointer text-lg p-1 hover:bg-white/10 rounded">👤</button>
        </div>
      </div>

      {showSettings && <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />}
      {showManagePickListsModal && <ManagePickListsModal isOpen={showManagePickListsModal} onClose={() => setShowManagePickListsModal(false)} />}
      {showNewCrateModal && <NewCrateModal isOpen={showNewCrateModal} onClose={() => { setShowNewCrateModal(false); setEditingCrate(null); }} onCrateCreated={async () => { await loadCrates(); setShowNewCrateModal(false); setShowManageCratesModal(true); setEditingCrate(null); }} editingCrate={editingCrate} />}
      {showNewSmartCrateModal && <NewSmartCrateModal isOpen={showNewSmartCrateModal} onClose={() => { setShowNewSmartCrateModal(false); setEditingCrate(null); }} onCrateCreated={async () => { await loadCrates(); setShowNewSmartCrateModal(false); setShowManageCratesModal(true); setEditingCrate(null); }} editingCrate={editingCrate} />}
      {showManageCratesModal && <ManageCratesModal isOpen={showManageCratesModal} onClose={() => setShowManageCratesModal(false)} onCratesChanged={() => { loadCrates(); }} onOpenNewCrate={() => { setShowManageCratesModal(false); setEditingCrate(null); setShowNewCrateModal(true); }} onOpenNewSmartCrate={() => { setShowManageCratesModal(false); setEditingCrate(null); setShowNewSmartCrateModal(true); }} onOpenEditCrate={(crate) => { setShowManageCratesModal(false); setEditingCrate(crate); setShowNewCrateModal(true); }} onOpenEditSmartCrate={(crate) => { setShowManageCratesModal(false); setEditingCrate(crate); setShowNewSmartCrateModal(true); }} />}
      {showPrintToPDF && <PrintToPDFModal isOpen={showPrintToPDF} onClose={() => setShowPrintToPDF(false)} allAlbums={albums} currentListAlbums={filteredAndSortedAlbums} checkedAlbumIds={selectedAlbumIds} />}
      {showStatistics && <StatisticsModal isOpen={showStatistics} onClose={() => setShowStatistics(false)} albums={albums} />}
      {showImportModal && <ImportSelectionModal onSelectImportType={(type) => { 
        setShowImportModal(false); 
        if (type === 'discogs') {
          setShowImportDiscogsModal(true);
        } else if (type === 'csv') { 
          setShowImportCSVModal(true);
        } else if (type === 'clz') { 
          setShowImportCLZModal(true);
        } else if (type === 'enrich') { 
          setShowImportEnrichModal(true);
        }
      }} onCancel={() => setShowImportModal(false)} />}
      {showImportDiscogsModal && <ImportDiscogsModal 
        isOpen={showImportDiscogsModal} 
        onClose={() => setShowImportDiscogsModal(false)} 
        onImportComplete={loadAlbums} 
      />}
      {showImportCLZModal && <ImportCLZModal 
        isOpen={showImportCLZModal} 
        onClose={() => setShowImportCLZModal(false)} 
        onImportComplete={loadAlbums} 
      />}
      {showImportCSVModal && <ImportCSVModal 
        isOpen={showImportCSVModal} 
        onClose={() => setShowImportCSVModal(false)} 
        onImportComplete={loadAlbums} 
      />}
      {showImportEnrichModal && <ImportEnrichModal 
        isOpen={showImportEnrichModal} 
        onClose={() => setShowImportEnrichModal(false)} 
        onImportComplete={loadAlbums} 
      />}
      {showFindDuplicates && <FindDuplicatesModal 
        isOpen={showFindDuplicates} 
        onClose={() => setShowFindDuplicates(false)} 
        onDuplicatesRemoved={loadAlbums} 
      />}
    </>
  );
}
// AUDIT: inspected, no changes.
