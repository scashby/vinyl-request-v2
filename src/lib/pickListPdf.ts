import { jsPDF } from "jspdf";
import type { BingoItem } from "src/lib/bingo";

export const generatePickListPdf = (items: BingoItem[], title: string): jsPDF => {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const margin = 12;
  let y = margin;

  doc.setFontSize(14);
  doc.text(title, margin, y);
  y += 8;

  doc.setFontSize(10);

  items.forEach((item, index) => {
    const line = `${index + 1}. ${item.title} - ${item.artist}`;
    const lines = doc.splitTextToSize(line, 180);
    if (y + lines.length * 5 > 270) {
      doc.addPage("letter");
      y = margin;
    }
    doc.text(lines, margin, y);
    y += lines.length * 5 + 1;
  });

  return doc;
};
