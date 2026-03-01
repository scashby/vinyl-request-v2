import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type PullListRow = {
  call_index: number;
  round_number: number;
  artist_answer: string;
  title_answer: string;
  source_label?: string | null;
  snippet_start_seconds?: number | null;
  snippet_duration_seconds?: number | null;
  host_notes?: string | null;
};

function formatSeconds(value: number | null | undefined): string {
  if (!Number.isFinite(value)) return "";
  const total = Math.max(0, Number(value));
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function generateNameThatTunePullListPdf(rows: PullListRow[], title: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 14, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 20);

  autoTable(doc, {
    startY: 24,
    head: [["#", "Round", "Artist", "Title", "Source", "Cue Start", "Len", "Host Notes"]],
    body: rows.map((row) => [
      row.call_index,
      row.round_number,
      row.artist_answer,
      row.title_answer,
      row.source_label ?? "",
      formatSeconds(row.snippet_start_seconds),
      formatSeconds(row.snippet_duration_seconds),
      row.host_notes ?? "",
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 1.6,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: [120, 28, 72],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 14 },
      2: { cellWidth: 46 },
      3: { cellWidth: 56 },
      4: { cellWidth: 34 },
      5: { cellWidth: 22 },
      6: { cellWidth: 16 },
      7: { cellWidth: 70 },
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
  });

  return doc;
}
