// CSVPreviewTable.tsx — preview table for CSV imports (Next.js + TypeScript ready)

import React from "react";

interface CSVPreviewTableProps {
  rows: Array<Record<string, string | number | null | undefined>>;
}

export default function CSVPreviewTable({ rows }: CSVPreviewTableProps) {
  if (!rows.length) return <p className="text-gray-500">No data to preview.</p>;

  return (
    <div className="overflow-x-auto border rounded p-2">
      <table className="min-w-full text-sm text-left">
        <thead>
          <tr>
            {Object.keys(rows[0]).map((col) => (
              <th key={col} className="px-2 py-1 border-b">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((row, idx) => (
            <tr key={idx}>
              {Object.values(row).map((val, i) => (
                <td key={i} className="px-2 py-1 border-b">
                  {val}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 mt-1">
        Showing first 20 of {rows.length} rows.
      </p>
    </div>
  );
}
// AUDIT: inspected, no changes.
