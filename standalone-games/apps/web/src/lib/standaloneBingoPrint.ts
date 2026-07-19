import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type StandalonePrintableCard = {
  cardIndex: number;
  cardIdentifier: string;
  grid: Array<{
    row: number;
    col: number;
    track_title: string;
    artist_name: string;
    free: boolean;
  }>;
};

export type StandalonePrintableCall = {
  callIndex: number;
  trackTitle: string;
  artistName: string;
  albumName?: string | null;
  side?: string | null;
  position?: string | null;
  status: string;
};

export function formatStandaloneBallLabel(callIndex: number): string {
  const letters = ["B", "I", "N", "G", "O"];
  const letter = letters[(Math.max(1, callIndex) - 1) % letters.length] ?? "B";
  return `${letter}-${callIndex}`;
}

export function generateStandaloneCallSheetPdf(
  sessionCode: string,
  calls: StandalonePrintableCall[]
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Bingo Call Sheet - ${sessionCode}`, 10, 12);

  autoTable(doc, {
    startY: 18,
    head: [["Draw", "Ball", "Track", "Artist", "Album", "Side", "Pos", "Status"]],
    body: calls.map((call) => [
      call.callIndex,
      formatStandaloneBallLabel(call.callIndex),
      call.trackTitle,
      call.artistName,
      call.albumName ?? "",
      call.side ?? "",
      call.position ?? "",
      call.status,
    ]),
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [33, 33, 33] },
  });

  return doc;
}

export function generateStandaloneCardsPdf(
  sessionCode: string,
  cards: StandalonePrintableCard[],
  layout: "2-up" | "4-up"
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const cardsPerPage = layout === "4-up" ? 4 : 2;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const gutter = 18;
  const columns = 2;
  const rows = layout === "4-up" ? 2 : 1;
  const cardWidth = (pageWidth - margin * 2 - gutter * (columns - 1)) / columns;
  const cardHeight = (pageHeight - margin * 2 - gutter * (rows - 1)) / rows;
  const headerHeight = 28;
  const footerHeight = 20;
  const gridTopGap = 6;
  const cellWidth = cardWidth / 5;
  const cellHeight = (cardHeight - headerHeight - footerHeight - gridTopGap) / 5;

  cards.forEach((card, index) => {
    if (index > 0 && index % cardsPerPage === 0) {
      doc.addPage();
    }

    const slot = index % cardsPerPage;
    const col = slot % 2;
    const row = Math.floor(slot / 2);
    const baseX = margin + col * (cardWidth + gutter);
    const baseY = margin + row * (cardHeight + gutter);

    doc.setDrawColor(0, 0, 0);
    doc.rect(baseX, baseY, cardWidth, cardHeight);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(`Music Bingo - ${sessionCode}`, baseX + 10, baseY + 18);
    doc.setFontSize(10);
    doc.text(card.cardIdentifier, baseX + cardWidth - 10, baseY + 18, { align: "right" });

    const orderedGrid = [...card.grid].sort((a, b) => (a.row === b.row ? a.col - b.col : a.row - b.row));
    orderedGrid.forEach((cell) => {
      const cellX = baseX + cell.col * cellWidth;
      const cellY = baseY + headerHeight + gridTopGap + cell.row * cellHeight;
      doc.rect(cellX, cellY, cellWidth, cellHeight);
      const label = cell.free ? "FREE" : `${cell.track_title} - ${cell.artist_name}`;
      const lines = doc.splitTextToSize(label, cellWidth - 8);
      doc.setFont("helvetica", cell.free ? "bold" : "normal");
      doc.setFontSize(cell.free ? 12 : 7);
      doc.text(lines.slice(0, 6), cellX + cellWidth / 2, cellY + 8, {
        align: "center",
        baseline: "top",
      });
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Layout: ${layout}  Card #${card.cardIndex}`, baseX + 10, baseY + cardHeight - 8);
  });

  return doc;
}

export function generateStandaloneCrateLabelsPdf(
  sessionCode: string,
  playlists: Array<{ playlistLetter: string; playlistName: string; roundNumber: number }>
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(`Crate Labels - ${sessionCode}`, 12, 18);

  let y = 32;
  playlists.forEach((playlist, index) => {
    if (index > 0 && index % 6 === 0) {
      doc.addPage();
      y = 20;
    }

    doc.setDrawColor(40, 40, 40);
    doc.rect(12, y, 186, 32);
    doc.setFontSize(28);
    doc.text(playlist.playlistLetter, 20, y + 18);
    doc.setFontSize(13);
    doc.text(`Round ${playlist.roundNumber}`, 40, y + 12);
    doc.text(playlist.playlistName, 40, y + 22);
    y += 38;
  });

  return doc;
}

export function generateStandalonePlaylistSheetPdf(
  sessionCode: string,
  playlist: {
    playlistLetter: string;
    playlistName: string;
    roundNumber: number;
    callOrder: Array<{
      call_index: number;
      track_title: string;
      artist_name: string;
      album_name?: string | null;
      side?: string | null;
      position?: string | null;
    }>;
  }
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Playlist Sheet - ${sessionCode}`, 10, 12);
  doc.setFontSize(11);
  doc.text(`Round ${playlist.roundNumber} · ${playlist.playlistLetter} · ${playlist.playlistName}`, 10, 18);

  autoTable(doc, {
    startY: 24,
    head: [["Draw", "Ball", "Track", "Artist", "Album", "Side", "Pos"]],
    body: playlist.callOrder.map((entry) => [
      entry.call_index,
      formatStandaloneBallLabel(entry.call_index),
      entry.track_title,
      entry.artist_name,
      entry.album_name ?? "",
      entry.side ?? "",
      entry.position ?? "",
    ]),
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [33, 33, 33] },
  });

  return doc;
}
