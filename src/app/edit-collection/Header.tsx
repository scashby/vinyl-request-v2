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
import type { Album } from '../../types/album';
import type { Crate } from '../../types/crate';
import styles from './EditCollection.module.css';

interface HeaderProps {
  albums?: Album[];
  loadAlbums?: () => Promise<void>;
  loadCrates?: () => Promise<void>;
  filteredAndSortedAlbums?: Album[];
  selectedAlbumIds?: Set<number>;
}

export default function Header({ 
  albums = [], 
  loadAlbums = async () => {}, 
  loadCrates = async () => {},
  filteredAndSortedAlbums = [],
  selectedAlbumIds = new Set()
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
  const [editingCrate, setEditingCrate] = useState<Crate | null>(null);

  return (
    <>
      {sidebarOpen && (
        <>
          <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />
          <div className={`clz-sidebar ${styles.sidebar}`}>
            <div className={styles.sidebarHeader}>
              <div>DWD COLLECTION</div>
              <button onClick={() => setSidebarOpen(false)} title="Close menu" className={styles.sidebarCloseButton}>×</button>
            </div>

            <div className={styles.sidebarSection}>
              <div className={styles.sidebarSectionTitle}>Collection</div>
              <button onClick={() => { setSidebarOpen(false); setShowManagePickListsModal(true); }} title="Create and manage pick lists" className={styles.sidebarButton}>
                <span style={{ marginRight: '10px' }}>📋</span> Manage Pick Lists
              </button>
              <button onClick={() => { setSidebarOpen(false); setShowManageCratesModal(true); }} title="Manage crates (DJ workflow organization)" className={styles.sidebarButton}>
                <span style={{ marginRight: '10px' }}>📦</span> Manage Crates
              </button>
            </div>

            <hr className={styles.sidebarHr} />

            <div className={styles.sidebarSection}>
              <div className={styles.sidebarSectionTitle}>Tools</div>
              <button onClick={() => { setSidebarOpen(false); setShowPrintToPDF(true); }} title="Export collection to PDF" className={styles.sidebarButton}>
                <span style={{ marginRight: '10px' }}>🖨️</span> Print to PDF
              </button>
              <button onClick={() => { setSidebarOpen(false); setShowStatistics(true); }} title="View collection statistics" className={styles.sidebarButton}>
                <span style={{ marginRight: '10px' }}>📊</span> Statistics
              </button>
              <button onClick={() => { setSidebarOpen(false); setShowImportModal(true); }} title="Import album data from various sources" className={styles.sidebarButton}>
                <span style={{ marginRight: '10px' }}>📥</span> Import Data
              </button>
              <button title="Track loaned albums" className={styles.sidebarButton}>
                <span style={{ marginRight: '10px' }}>📚</span> Loan Manager
              </button>
              <button onClick={() => { setSidebarOpen(false); setShowSettings(true); }} title="Application settings" className={styles.sidebarButton}>
                <span style={{ marginRight: '10px' }}>⚙️</span> Settings
              </button>
            </div>
          </div>
        </>
      )}

      <div className={`clz-header ${styles.header}`}>
        <div className={styles.headerLeft}>
          <button onClick={() => setSidebarOpen(true)} title="Open menu" className={styles.headerMenuButton}>☰</button>
          <div className={styles.headerTitle}>
            <span style={{ fontSize: '18px' }}>♪</span>
            <span style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '0.5px' }}>DWD Collection Management System</span>
          </div>
        </div>
        <div className={styles.headerRight}>
          <button title="Grid view" className={styles.headerButton}>⊞</button>
          <button title="User account" className={styles.headerButton}>👤</button>
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
    </>
  );
}