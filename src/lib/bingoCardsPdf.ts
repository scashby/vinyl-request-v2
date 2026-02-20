import { jsPDF } from "jspdf";

type Card = {
  card_number: number;
  grid: Array<{ row: number; col: number; label: string }>;
};

export function generateBingoCardsPdf(cards: Card[], layout: "2-up" | "4-up", title: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const cardsPerPage = layout === "4-up" ? 4 : 2;
  const cardWidth = layout === "4-up" ? 90 : 180;
  const cardHeight = layout === "4-up" ? 65 : 120;
  const xOffsets = layout === "4-up" ? [10, 110, 10, 110] : [10, 10];
  const yOffsets = layout === "4-up" ? [20, 20, 150, 150] : [20, 155];

  cards.forEach((card, index) => {
    if (index > 0 && index % cardsPerPage === 0) doc.addPage();

    const slot = index % cardsPerPage;
    const baseX = xOffsets[slot] ?? 10;
    const baseY = yOffsets[slot] ?? 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`${title} - Card ${card.card_number}`, baseX, baseY - 4);
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
        doc.setFontSize(layout === "4-up" ? 6 : 8);
        const lines = doc.splitTextToSize(label, cellW - 2);
        doc.text(lines.slice(0, 3), x + 1, y + 3);
      }
    }
  });

  return doc;
}
