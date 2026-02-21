import { jsPDF } from "jspdf";

type Card = {
  card_number: number;
  grid: Array<{ row: number; col: number; label: string }>;
};

export function generateBingoCardsPdf(cards: Card[], layout: "2-up" | "4-up", title: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const cardsPerPage = layout === "4-up" ? 4 : 2;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const margin = 8;
  const gutterX = layout === "4-up" ? 6 : 6;
  const gutterY = layout === "4-up" ? 6 : 0;

  const columns = layout === "4-up" ? 2 : 2;
  const rows = layout === "4-up" ? 2 : 1;
  const cardWidth = (pageW - margin * 2 - gutterX * (columns - 1)) / columns;
  const cardHeight = (pageH - margin * 2 - gutterY * (rows - 1)) / rows;

  const xOffsets: number[] = [];
  const yOffsets: number[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < columns; c += 1) {
      xOffsets.push(margin + c * (cardWidth + gutterX));
      yOffsets.push(margin + r * (cardHeight + gutterY));
    }
  }

  cards.forEach((card, index) => {
    if (index > 0 && index % cardsPerPage === 0) doc.addPage();

    const slot = index % cardsPerPage;
    const baseX = xOffsets[slot] ?? 10;
    const baseY = yOffsets[slot] ?? 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(layout === "4-up" ? 9 : 10);
    doc.text(`${title} · Card ${card.card_number}`, baseX, Math.max(4, baseY - 2));
    doc.rect(baseX, baseY, cardWidth, cardHeight);

    const cellW = cardWidth / 5;
    const cellH = cardHeight / 5;

    for (let r = 0; r < 5; r += 1) {
      for (let c = 0; c < 5; c += 1) {
        const x = baseX + c * cellW;
        const y = baseY + r * cellH;
        doc.rect(x, y, cellW, cellH);

        const match = card.grid.find((cell) => cell.row === r && cell.col === c);
        const label = match?.label ?? "";
        doc.setFont("helvetica", "normal");
        doc.setFontSize(layout === "4-up" ? 7 : 9);
        const lines = doc.splitTextToSize(label, cellW - 2);
        doc.text(lines.slice(0, layout === "4-up" ? 2 : 3), x + 1, y + 3.5);
      }
    }
  });

  return doc;
}
