import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatBallLabel } from "src/lib/bingoBall";

type CallRow = {
  call_index: number;
  ball_number?: number | null;
  column_letter: string;
  track_title: string;
  artist_name: string;
  album_name: string | null;
  side?: string | null;
  position?: string | null;
};

export function generateBingoCallSheetPdf(rows: CallRow[], title: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, 10, 12);

  autoTable(doc, {
    startY: 18,
    head: [["Draw", "Ball", "Artist", "Album", "Side", "Pos", "Track"]],
    body: rows.map((row) => [
      row.call_index,
      formatBallLabel(row.ball_number ?? null, row.column_letter),
      row.artist_name,
      row.album_name ?? "",
      row.side ?? "",
      row.position ?? "",
      row.track_title,
    ]),
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [33, 33, 33] },
  });

  return doc;
}
