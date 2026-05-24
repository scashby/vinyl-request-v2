import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { type RoundCallSection } from "src/lib/bingoCallSheetPdf";

type TrackEntry = {
  artist_name: string;
  album_name: string;
  side: string;
  position: string;
  drawByRound: Map<number, number>;
};

/**
 * Generate an album-prep index for a bingo session.
 *
 * Produces one row per unique track (keyed by artist · album · side · position),
 * with a separate column for each round's draw number.
 * Sorted by draw order so prep sheets stay aligned with the locked round pull.
 */
export function generateBingoRoundIndexPdf(rounds: RoundCallSection[], title: string): jsPDF {
  // ── Build track map ──────────────────────────────────────────────────────────
  const trackMap = new Map<string, TrackEntry>();

  for (const round of rounds) {
    for (const call of round.calls) {
      const key = `${call.artist_name}::${call.album_name ?? ""}::${call.side ?? ""}::${call.position ?? ""}`;
      const existing = trackMap.get(key);
      if (existing) {
        existing.drawByRound.set(round.roundNumber, call.call_index);
      } else {
        trackMap.set(key, {
          artist_name: call.artist_name,
          album_name: call.album_name ?? "",
          side: call.side ?? "",
          position: call.position ?? "",
          drawByRound: new Map([[round.roundNumber, call.call_index]]),
        });
      }
    }
  }

  const roundNumbers = rounds.map((r) => r.roundNumber).sort((a, b) => a - b);

  const tracks = Array.from(trackMap.values()).sort((a, b) => {
    for (const roundNumber of roundNumbers) {
      const leftDraw = a.drawByRound.get(roundNumber) ?? Number.MAX_SAFE_INTEGER;
      const rightDraw = b.drawByRound.get(roundNumber) ?? Number.MAX_SAFE_INTEGER;
      if (leftDraw !== rightDraw) return leftDraw - rightDraw;
    }

    return (
      a.artist_name.localeCompare(b.artist_name) ||
      a.album_name.localeCompare(b.album_name) ||
      a.side.localeCompare(b.side) ||
      a.position.localeCompare(b.position)
    );
  });

  // ── Layout ───────────────────────────────────────────────────────────────────
  // Portrait letter keeps the sheet aligned with the crate pull format and maximizes vertical density.
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, 10, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 10, 19);

  const roundColWidth = 15;

  autoTable(doc, {
    startY: 22,
    margin: { top: 8, bottom: 8, left: 6, right: 6 },
    head: [["Artist", "Album", "Side", "Pos", ...roundNumbers.map((r) => `R${r}`)]],
    body: tracks.map((track) => [
      track.artist_name,
      track.album_name,
      track.side,
      track.position,
      ...roundNumbers.map((r) => {
        const draw = track.drawByRound.get(r);
        return draw ?? "—";
      }),
    ]),
    styles: {
      fontSize: 7,
      cellPadding: 1.2,
      overflow: "ellipsize",
      valign: "middle",
    },
    headStyles: {
      fillColor: [33, 33, 33],
      fontSize: 7,
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 56 },  // Artist
      1: { cellWidth: 68 },  // Album
      2: { cellWidth: 10 },  // Side
      3: { cellWidth: 10 },  // Pos
      // Round draw columns — R1 at index 4, R2 at 5, etc.
      ...Object.fromEntries(
        roundNumbers.map((_, i) => [
          4 + i,
          { cellWidth: roundColWidth, halign: "center" as const, fontStyle: "bold" as const },
        ])
      ),
    },
    alternateRowStyles: { fillColor: [245, 245, 240] },
    tableLineWidth: 0.1,
  });

  return doc;
}
