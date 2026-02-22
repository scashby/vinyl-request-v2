import { jsPDF } from "jspdf";

type Card = {
  card_number: number;
  grid: Array<{ row: number; col: number; label: string }>;
};

export function generateBingoCardsPdf(cards: Card[], layout: "2-up" | "4-up", title: string) {
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

  const headerH = layout === "4-up" ? 14 : 16;
  const headerGap = layout === "4-up" ? 6 : 8;

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

    const splitLongToken = (token: string) => {
      // Fallback for "words" that won't fit even alone (no spaces).
      const parts: string[] = [];
      let remaining = token;
      while (remaining.length) {
        let cut = remaining.length;
        while (cut > 1 && doc.getTextWidth(remaining.slice(0, cut)) > maxWidth) cut -= 1;
        parts.push(remaining.slice(0, cut));
        remaining = remaining.slice(cut);
      }
      return parts;
    };

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (doc.getTextWidth(candidate) <= maxWidth) {
        current = candidate;
        continue;
      }

      if (!current) {
        // Word alone doesn't fit; split it into chunks.
        const chunks = splitLongToken(word);
        lines.push(...chunks);
        continue;
      }

      pushCurrent();

      if (doc.getTextWidth(word) <= maxWidth) {
        current = word;
      } else {
        const chunks = splitLongToken(word);
        lines.push(...chunks);
      }
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
    const combined = artistText ? `${titleText} — ${artistText}` : titleText;

    const maxFont = layout === "4-up" ? 14 : 18;
    // Never truncate: allow font to shrink aggressively to fit the cell.
    const minFont = layout === "4-up" ? 1.25 : 1.5;
    const step = 0.25;

    for (let fontSize = maxFont; fontSize >= minFont; fontSize -= step) {
      doc.setFontSize(fontSize);
      const lines = wrapTextToWidth(combined, availableW);
      if (lines.length === 0) return { lines: [] as string[], fontSize };

      const lineH = doc.getTextDimensions("Mg").h * 0.98;
      const totalH = lineH * lines.length;
      if (totalH <= availableH) return { lines, fontSize };
    }

    doc.setFontSize(minFont);
    return { lines: wrapTextToWidth(combined, availableW), fontSize: minFont };
  }

  function renderCellText(label: string, cellX: number, cellY: number, cellW: number, cellH: number) {
    const baseLabel = String(label ?? "").trim();
    if (!baseLabel) return;

    const innerX = cellX + cellPaddingX;
    const innerY = cellY + cellPaddingY;
    const innerW = Math.max(1, cellW - cellPaddingX * 2);
    const innerH = Math.max(1, cellH - cellPaddingY * 2);

    const best = fitTextToCell(baseLabel, innerW, innerH);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(best.fontSize);
    const lineH = doc.getTextDimensions("Mg").h * 0.98;
    const totalH = lineH * best.lines.length;
    const centerX = innerX + innerW / 2;
    const centerY = innerY + innerH / 2;
    const startY = centerY - totalH / 2;

    // Use baseline=top to reduce the risk of clipping at cell borders.
    best.lines.forEach((line, index) => {
      doc.text(line, centerX, startY + lineH * index, { align: "center", baseline: "top" });
    });
  }

  cards.forEach((card, index) => {
    if (index > 0 && index % cardsPerPage === 0) doc.addPage();

    const slot = index % cardsPerPage;
    const baseX = xOffsets[slot] ?? 10;
    const baseY = yOffsets[slot] ?? 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(layout === "4-up" ? 10 : 11);
    doc.text(`${title} · Card ${card.card_number}`, baseX, baseY + headerH);
    doc.rect(baseX, baseY, cardWidth, cardHeight);

    const gridX = baseX;
    const gridY = baseY + headerH + headerGap;
    const gridW = cardWidth;
    const gridH = cardHeight - (headerH + headerGap);

    const cellW = gridW / 5;
    const cellH = gridH / 5;

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
