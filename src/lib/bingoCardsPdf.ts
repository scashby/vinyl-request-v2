import { jsPDF } from "jspdf";
import { BINGO_COLUMNS } from "src/lib/bingoBall";

type Card = {
  card_number: number;
  grid: Array<{ row: number; col: number; label: string }>;
};

export function generateBingoCardsPdf(cards: Card[], layout: "2-up" | "4-up", _title: string) {
  // Use US Letter landscape for predictable printing in the US.
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });

  const cardsPerPage = layout === "4-up" ? 4 : 2;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const marginX = layout === "4-up" ? 18 : 16;
  const marginY = layout === "4-up" ? 18 : 16;
  const gutterX = layout === "4-up" ? 16 : 24; // extra space for center cut on 2-up
  const gutterY = layout === "4-up" ? 16 : 0;

  const columns = layout === "4-up" ? 2 : 2;
  const rows = layout === "4-up" ? 2 : 1;
  const cardWidth = (pageW - marginX * 2 - gutterX * (columns - 1)) / columns;
  const cardHeight = (pageH - marginY * 2 - gutterY * (rows - 1)) / rows;

  // Printed card title line is intentionally removed for cleaner physical handouts.
  const headerH = 0;
  const headerGap = 0;
  const columnHeaderH = layout === "4-up" ? 12 : 14;
  const columnHeaderGap = layout === "4-up" ? 4 : 6;

  const cellPaddingX = layout === "4-up" ? 2.5 : 3.0;
  const cellPaddingY = layout === "4-up" ? 2.5 : 3.0;

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

  function wrapTextToWidth(text: string, maxWidth: number): string[] {
    const cleaned = String(text ?? "")
      .replace(/\s+/g, " ")
      .replace(/\s*-\s*/g, " - ")
      .trim();
    if (!cleaned) return [];

    const words = cleaned.split(" ");
    const lines: string[] = [];
    let current = "";

    const pushCurrent = () => {
      const trimmed = current.trim();
      if (trimmed) lines.push(trimmed);
      current = "";
    };

    for (const word of words) {
      // Never break words across lines. If a single word doesn't fit, the caller must reduce font size.
      if (doc.getTextWidth(word) > maxWidth) return [];

      const candidate = current ? `${current} ${word}` : word;
      if (doc.getTextWidth(candidate) <= maxWidth) {
        current = candidate;
        continue;
      }

      if (!current) {
        // Single word doesn't fit (handled above). Keep defensive fallback.
        return [];
        continue;
      }

      pushCurrent();

      current = word;
    }

    pushCurrent();
    return lines;
  }

  function fitTextToCell(label: string, cellW: number, cellH: number) {
    const availableW = Math.max(1, cellW - cellPaddingX * 2);
    const availableH = Math.max(1, cellH - cellPaddingY * 2);

    const cleaned = String(label ?? "").replace(/\s+/g, " ").trim();
    if (!cleaned) return { lines: [] as string[], fontSize: layout === "4-up" ? 8 : 10 };

    const { title: rawTitle, artist: rawArtist } = splitLabel(cleaned);
    const titleText = rawTitle || cleaned;
    const artistText = rawArtist || "";

    const maxFont = layout === "4-up" ? 14 : 18;
    // Never truncate: allow font to shrink aggressively to fit the cell.
    const minFont = layout === "4-up" ? 0.75 : 1.0;
    const step = 0.25;

    for (let fontSize = maxFont; fontSize >= minFont; fontSize -= step) {
      doc.setFontSize(fontSize);

      const titleLines = wrapTextToWidth(titleText, availableW);
      if (titleLines.length === 0) continue;

      const artistLines = artistText ? wrapTextToWidth(artistText, availableW) : [];
      if (artistText && artistLines.length === 0) continue;

      const titleLineH = doc.getTextDimensions("Mg").h * 0.98;
      const artistLineH = titleLineH;
      const sepLineH = artistText ? Math.max(1, fontSize * 0.1) : 0;
      const sepGap = artistText ? Math.max(2, fontSize * 0.2) : 0;

      const totalH =
        titleLineH * titleLines.length +
        (artistText ? sepGap + sepLineH + sepGap : 0) +
        artistLineH * artistLines.length;

      if (totalH <= availableH) {
        // Use a sentinel empty string to indicate a separator line between title and artist.
        const lines = artistText ? [...titleLines, "", ...artistLines] : [...titleLines];
        return { lines, fontSize, _meta: { titleLines, artistLines, titleLineH, artistLineH, sepLineH, sepGap } };
      }
    }

    doc.setFontSize(minFont);
    // If it still doesn't fit at min font, prefer showing all text (may be tiny) over truncation.
    // We keep "no word breaks" by letting wrapTextToWidth return [] if any word doesn't fit.
    const titleLines = wrapTextToWidth(titleText, availableW);
    const artistLines = artistText ? wrapTextToWidth(artistText, availableW) : [];
    const titleLineH = doc.getTextDimensions("Mg").h * 0.98;
    const artistLineH = titleLineH;
    const sepLineH = artistText ? Math.max(1, minFont * 0.1) : 0;
    const sepGap = artistText ? Math.max(2, minFont * 0.2) : 0;
    const lines = artistText ? [...titleLines, "", ...artistLines] : [...titleLines];
    return { lines, fontSize: minFont, _meta: { titleLines, artistLines, titleLineH, artistLineH, sepLineH, sepGap } };
  }

  function renderCellText(label: string, cellX: number, cellY: number, cellW: number, cellH: number) {
    const baseLabel = String(label ?? "").trim();
    if (!baseLabel) return;

    const innerX = cellX + cellPaddingX;
    const innerY = cellY + cellPaddingY;
    const innerW = Math.max(1, cellW - cellPaddingX * 2);
    const innerH = Math.max(1, cellH - cellPaddingY * 2);

    doc.setFont("helvetica", "normal");

    const best = fitTextToCell(baseLabel, innerW, innerH) as {
      lines: string[];
      fontSize: number;
      _meta?: {
        titleLines: string[];
        artistLines: string[];
        titleLineH: number;
        artistLineH: number;
        sepLineH: number;
        sepGap: number;
      };
    };

    doc.setFontSize(best.fontSize);

    const meta = best._meta;
    const titleLines = meta?.titleLines ?? best.lines;
    const artistLines = meta?.artistLines ?? [];
    const titleLineH = meta?.titleLineH ?? doc.getTextDimensions("Mg").h * 0.98;
    const artistLineH = meta?.artistLineH ?? titleLineH;
    const sepLineH = meta?.sepLineH ?? 0;
    const sepGap = meta?.sepGap ?? 0;

    const totalH =
      titleLineH * titleLines.length +
      (artistLines.length ? sepGap + sepLineH + sepGap : 0) +
      artistLineH * artistLines.length;

    const centerX = innerX + innerW / 2;
    const centerY = innerY + innerH / 2;
    const startY = centerY - totalH / 2;

    // Title (top block)
    titleLines.forEach((line, index) => {
      doc.text(line, centerX, startY + titleLineH * index, { align: "center", baseline: "top" });
    });

    let cursorY = startY + titleLineH * titleLines.length;

    // Separator line between title and artist
    if (artistLines.length) {
      cursorY += sepGap;
      const lineY = cursorY + sepLineH / 2;
      const lineX1 = innerX + innerW * 0.15;
      const lineX2 = innerX + innerW * 0.85;
      doc.setLineWidth(Math.min(1.0, Math.max(0.5, sepLineH)));
      doc.line(lineX1, lineY, lineX2, lineY);
      cursorY += sepLineH + sepGap;

      artistLines.forEach((line, index) => {
        doc.text(line, centerX, cursorY + artistLineH * index, { align: "center", baseline: "top" });
      });
    }
  }

  cards.forEach((card, index) => {
    if (index > 0 && index % cardsPerPage === 0) doc.addPage();

    const slot = index % cardsPerPage;
    const baseX = xOffsets[slot] ?? 10;
    const baseY = yOffsets[slot] ?? 20;

    doc.rect(baseX, baseY, cardWidth, cardHeight);

    const gridX = baseX;
    const gridY = baseY + headerH + headerGap + columnHeaderH + columnHeaderGap;
    const gridW = cardWidth;
    const gridH = cardHeight - (headerH + headerGap + columnHeaderH + columnHeaderGap);

    const cellW = gridW / 5;
    const cellH = gridH / 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(layout === "4-up" ? 12 : 14);
    const columnHeaderY = baseY + headerH + headerGap + columnHeaderH / 2;
    for (let c = 0; c < 5; c += 1) {
      const letter = BINGO_COLUMNS[c];
      doc.text(letter, gridX + c * cellW + cellW / 2, columnHeaderY, { align: "center", baseline: "middle" });
    }

    for (let r = 0; r < 5; r += 1) {
      for (let c = 0; c < 5; c += 1) {
        const x = gridX + c * cellW;
        const y = gridY + r * cellH;
        doc.rect(x, y, cellW, cellH);

        const match = card.grid.find((cell) => cell.row === r && cell.col === c);
        const label = match?.label ?? "";
        renderCellText(label, x, y, cellW, cellH);
      }
    }
  });

  return doc;
}
