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

  const marginX = layout === "4-up" ? 6 : 5;
  const marginY = layout === "4-up" ? 6 : 5;
  const gutterX = layout === "4-up" ? 6 : 6;
  const gutterY = layout === "4-up" ? 6 : 0;

  const columns = layout === "4-up" ? 2 : 2;
  const rows = layout === "4-up" ? 2 : 1;
  const cardWidth = (pageW - marginX * 2 - gutterX * (columns - 1)) / columns;
  const cardHeight = (pageH - marginY * 2 - gutterY * (rows - 1)) / rows;

  const cellPaddingX = layout === "4-up" ? 0.9 : 1.0;
  const cellPaddingY = layout === "4-up" ? 0.9 : 1.0;

  const splitLabel = (value: string) => {
    const text = value.trim();
    const idx = text.lastIndexOf(" - ");
    if (idx === -1) return { title: text, artist: "" };
    return { title: text.slice(0, idx).trim(), artist: text.slice(idx + 3).trim() };
  };

  const xOffsets: number[] = [];
  const yOffsets: number[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < columns; c += 1) {
      xOffsets.push(marginX + c * (cardWidth + gutterX));
      yOffsets.push(marginY + r * (cardHeight + gutterY));
    }
  }

  function buildLines(
    label: string,
    availableW: number,
    maxLines: number,
    mode: "title_only" | "title_artist"
  ): string[] {
    const cleaned = label.trim();
    if (!cleaned) return [];

    const { title: rawTitle, artist: rawArtist } = splitLabel(cleaned);
    const title = rawTitle || cleaned;
    const artist = rawArtist || "";

    if (mode === "title_artist" && artist) {
      const maxArtistLines = 1;
      const titleLines = doc.splitTextToSize(title, availableW) as string[];
      const artistLines = doc.splitTextToSize(artist, availableW) as string[];
      const keptTitle = titleLines.slice(0, Math.max(0, maxLines - maxArtistLines));
      const keptArtist = artistLines.slice(0, maxArtistLines);
      const combined = [...keptTitle, ...keptArtist].filter(Boolean);
      return combined.length ? combined : (doc.splitTextToSize(title, availableW) as string[]).slice(0, maxLines);
    }

    return (doc.splitTextToSize(title, availableW) as string[]).slice(0, maxLines);
  }

  function fitTextToCell(
    label: string,
    cellW: number,
    cellH: number,
    maxLines: number,
    maxFont: number,
    minFont: number,
    mode: "title_only" | "title_artist"
  ) {
    const availableW = Math.max(1, cellW - cellPaddingX * 2);
    const availableH = Math.max(1, cellH - cellPaddingY * 2);

    for (let fontSize = maxFont; fontSize >= minFont; fontSize -= 0.5) {
      doc.setFontSize(fontSize);
      const lines = buildLines(label, availableW, maxLines, mode);
      if (lines.length === 0) return { lines: [] as string[], fontSize };

      // jsPDF units are in mm; `getTextDimensions("M").h` behaves like a per-line height already.
      const lineH = doc.getTextDimensions("M").h;
      const totalH = lineH * lines.length;
      if (totalH <= availableH) return { lines, fontSize };
    }

    doc.setFontSize(minFont);
    return { lines: buildLines(label, Math.max(1, cellW - cellPaddingX * 2), maxLines, mode), fontSize: minFont };
  }

  function renderCellText(label: string, cellX: number, cellY: number, cellW: number, cellH: number, maxLines: number) {
    const baseLabel = String(label ?? "").trim();
    if (!baseLabel) return;

    const maxFont = layout === "4-up" ? 11 : 12;
    const minFont = layout === "4-up" ? 6 : 8;

    const innerX = cellX + cellPaddingX;
    const innerY = cellY + cellPaddingY;
    const innerW = Math.max(1, cellW - cellPaddingX * 2);
    const innerH = Math.max(1, cellH - cellPaddingY * 2);

    const primaryMode: "title_only" | "title_artist" = layout === "4-up" ? "title_only" : "title_artist";
    const secondaryMode: "title_only" | null = primaryMode === "title_artist" ? "title_only" : null;

    const first = fitTextToCell(baseLabel, innerW, innerH, maxLines, maxFont, minFont, primaryMode);
    const second = secondaryMode ? fitTextToCell(baseLabel, innerW, innerH, maxLines, maxFont, minFont, secondaryMode) : null;

    const best = second && second.fontSize > first.fontSize ? second : first;

    doc.setFontSize(best.fontSize);
    const lineH = doc.getTextDimensions("M").h;
    const totalH = lineH * best.lines.length;
    const centerX = innerX + innerW / 2;
    const centerY = innerY + innerH / 2;
    const startY = centerY - totalH / 2;

    best.lines.forEach((line, index) => {
      doc.text(line, centerX, startY + lineH * (index + 0.5), { align: "center", baseline: "middle" });
    });
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
        const maxLines = layout === "4-up" ? 2 : 3;
        renderCellText(label, x, y, cellW, cellH, maxLines);
      }
    }
  });

  return doc;
}
