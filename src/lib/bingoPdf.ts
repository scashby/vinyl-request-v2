import { jsPDF } from "jspdf";
import type { BingoCard } from "src/lib/bingo";

const LETTER_WIDTH = 215.9;
const LETTER_HEIGHT = 279.4;
const MARGIN = 8;
const CARD_GAP = 6;

const drawCard = (
  doc: jsPDF,
  card: BingoCard,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  doc.setDrawColor(40);
  doc.setLineWidth(0.3);
  doc.rect(x, y, width, height);

  doc.setFontSize(8);
  doc.text(`Card ${card.index}`, x + 3, y + 4);

  const gridTop = y + 6;
  const cellSize = Math.min((width - 6) / 5, (height - 10) / 5);

  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const cellX = x + 3 + col * cellSize;
      const cellY = gridTop + row * cellSize;
      const cellIndex = row * 5 + col;
      const cell = card.cells[cellIndex];

      doc.rect(cellX, cellY, cellSize, cellSize);
      doc.setFontSize(6);
      const label = cell.isFree ? "FREE" : cell.label;
      const lines = doc.splitTextToSize(label, cellSize - 2);
      doc.text(lines, cellX + 1, cellY + 3);
    }
  }
};

export const generateBingoCardsPdf = (
  cards: BingoCard[],
  title: string
): jsPDF => {
  const doc = new jsPDF({ unit: "mm", format: "letter" });

  const usableWidth = LETTER_WIDTH - MARGIN * 2;
  const usableHeight = LETTER_HEIGHT - MARGIN * 2;
  const cardWidth = (usableWidth - CARD_GAP) / 2;
  const cardHeight = (usableHeight - CARD_GAP) / 2;

  let pageIndex = 0;

  cards.forEach((card, index) => {
    if (index % 4 === 0 && index !== 0) {
      doc.addPage("letter");
      pageIndex += 1;
    }

    const slot = index % 4;
    const col = slot % 2;
    const row = Math.floor(slot / 2);

    const x = MARGIN + col * (cardWidth + CARD_GAP);
    const y = MARGIN + row * (cardHeight + CARD_GAP);

    if (index % 4 === 0) {
      doc.setFontSize(10);
      doc.text(title, MARGIN, MARGIN - 2);
    }

    drawCard(doc, card, x, y, cardWidth, cardHeight);
  });

  return doc;
};
