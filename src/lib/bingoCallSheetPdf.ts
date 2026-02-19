import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type CallRow = {
  call_index: number;
  column_letter: string;
  track_title: string;
  artist_name: string;
  album_name: string | null;
};

export function generateBingoCallSheetPdf(rows: CallRow[], title: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, 10, 12);

  autoTable(doc, {
    startY: 18,
    head: [["#", "Col", "Track", "Artist", "Album"]],
    body: rows.map((row) => [
      row.call_index,
      row.column_letter,
      row.track_title,
      row.artist_name,
      row.album_name ?? "",
    ]),
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [33, 33, 33] },
  });

  return doc;
}
