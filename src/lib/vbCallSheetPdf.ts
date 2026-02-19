import { jsPDF } from "jspdf";

type CallItem = {
  index: number;
  column: string;
  track: string;
  artist: string;
  album?: string | null;
};

export function generateVbCallSheetPdf(items: CallItem[], title: string): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const margin = 12;
  let y = margin;

  doc.setFontSize(14);
  doc.text(title, margin, y);
  y += 8;

  doc.setFontSize(9);
  for (const item of items) {
    const text = `${item.index + 1}. [${item.column}] ${item.track} - ${item.artist}${item.album ? ` (${item.album})` : ""}`;
    const lines = doc.splitTextToSize(text, 185);
    if (y + lines.length * 5 > 270) {
      doc.addPage("letter");
      y = margin;
    }
    doc.text(lines, margin, y);
    y += lines.length * 5 + 1;
  }

  return doc;
}
