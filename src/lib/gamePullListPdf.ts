import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type GamePullListRow = {
  call_index: number;
  round_number?: number | null;
  artist?: string | null;
  title?: string | null;
  source_label?: string | null;
  detail?: string | null;
  host_notes?: string | null;
};

export function generateGamePullListPdf(rows: GamePullListRow[], title: string, accentRgb: [number, number, number] = [30, 58, 138]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 14, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 20);

  autoTable(doc, {
    startY: 24,
    head: [["#", "Round", "Artist", "Title", "Source", "Details", "Host Notes"]],
    body: rows.map((row) => [
      row.call_index,
      row.round_number ?? "",
      row.artist ?? "",
      row.title ?? "",
      row.source_label ?? "",
      row.detail ?? "",
      row.host_notes ?? "",
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 1.6,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: accentRgb,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 14 },
      2: { cellWidth: 42 },
      3: { cellWidth: 48 },
      4: { cellWidth: 34 },
      5: { cellWidth: 75 },
      6: { cellWidth: 58 },
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
  });

  return doc;
}
