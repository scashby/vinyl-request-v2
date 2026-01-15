// src/app/edit-collection/components/ImportCSVModal.tsx
'use client';

interface ImportCSVModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

export default function ImportCSVModal({ isOpen, onClose }: ImportCSVModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30000]">
      <div className="bg-white rounded-lg w-[600px] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 bg-emerald-500 text-white flex justify-between items-center">
          <h2 className="m-0 text-lg font-semibold">
            Import from CSV
          </h2>
          <button
            onClick={onClose}
            className="bg-none border-none text-white text-2xl cursor-pointer p-0 hover:text-white/80"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          <div className="p-5 bg-amber-50 border border-amber-300 rounded-md text-center">
            <div className="text-5xl mb-3">🚧</div>
            <h3 className="m-0 mb-4 text-lg font-semibold text-amber-800">
              Coming Soon
            </h3>
            <p className="m-0 text-sm text-amber-800">
              CSV import functionality is under development.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-500 border-none rounded text-sm font-semibold cursor-pointer text-white hover:bg-emerald-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}