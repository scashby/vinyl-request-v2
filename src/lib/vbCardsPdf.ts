import { jsPDF } from "jspdf";
import type { VbCard } from "src/lib/vbEngine";

const LETTER_WIDTH = 215.9;
const LETTER_HEIGHT = 279.4;
const MARGIN = 8;
const GAP = 6;
const TITLE_SPACE = 6;

function drawCard(doc: jsPDF, card: VbCard, x: number, y: number, width: number, height: number) {
  doc.setDrawColor(55);
  doc.setLineWidth(0.3);
  doc.rect(x, y, width, height);

  doc.setFontSize(8);
  doc.text(`Card ${card.index}`, x + 3, y + 4);

  const gridTop = y + 6;
  const cellSize = Math.min((width - 6) / 5, (height - 10) / 5);

  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const i = row * 5 + col;
      const cellX = x + 3 + col * cellSize;
      const cellY = gridTop + row * cellSize;
      const cell = card.cells[i];

      doc.rect(cellX, cellY, cellSize, cellSize);
      doc.setFontSize(6);
      const text = cell.isFree ? "FREE" : cell.label;
      const lines = doc.splitTextToSize(text, cellSize - 2);
      doc.text(lines, cellX + 1, cellY + 3);
    }
  }
}

export function generateVbCardsPdf(
  cards: VbCard[],
  title: string,
  options?: { layout?: "2-up" | "4-up" }
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const layout = options?.layout ?? "2-up";

  const cols = layout === "2-up" ? 1 : 2;
  const rows = 2;
  const perPage = cols * rows;

  const usableWidth = LETTER_WIDTH - MARGIN * 2;
  const usableHeight = LETTER_HEIGHT - MARGIN * 2 - TITLE_SPACE;
  const cardWidth = (usableWidth - GAP * (cols - 1)) / cols;
  const cardHeight = (usableHeight - GAP * (rows - 1)) / rows;

  cards.forEach((card, index) => {
    if (index % perPage === 0 && index !== 0) doc.addPage("letter");

    const slot = index % perPage;
    const col = slot % cols;
    const row = Math.floor(slot / cols);

    const x = MARGIN + col * (cardWidth + GAP);
    const y = MARGIN + TITLE_SPACE + row * (cardHeight + GAP);

    if (index % perPage === 0) {
      doc.setFontSize(10);
      doc.text(title, MARGIN, MARGIN + 1.5);
    }

    drawCard(doc, card, x, y, cardWidth, cardHeight);
  });

  return doc;
}
