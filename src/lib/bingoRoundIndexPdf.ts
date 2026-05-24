import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { type RoundCallSection } from "src/lib/bingoCallSheetPdf";

type TrackEntry = {
  artist_name: string;
  album_name: string;
  drawByRound: Map<number, number[]>;
};

/**
 * Generate an album-prep index for a bingo session.
 *
 * Produces one row per album (keyed by artist · album),
 * with a separate column for each round's draw numbers.
 * Sorted by draw order so prep sheets stay aligned with the locked round pull.
 */
export function generateBingoRoundIndexPdf(rounds: RoundCallSection[], title: string): jsPDF {
  // ── Build track map ──────────────────────────────────────────────────────────
  const trackMap = new Map<string, TrackEntry>();

  for (const round of rounds) {
    for (const call of round.calls) {
      const key = `${call.artist_name}::${call.album_name ?? ""}`;
      const existing = trackMap.get(key);
      if (existing) {
        const existingDraws = existing.drawByRound.get(round.roundNumber) ?? [];
        existing.drawByRound.set(round.roundNumber, [...existingDraws, call.call_index].sort((a, b) => a - b));
      } else {
        trackMap.set(key, {
          artist_name: call.artist_name,
          album_name: call.album_name ?? "",
          drawByRound: new Map([[round.roundNumber, [call.call_index]]]),
        });
      }
    }
  }

  const roundNumbers = rounds.map((r) => r.roundNumber).sort((a, b) => a - b);

  const tracks = Array.from(trackMap.values()).sort((a, b) => {
    for (const roundNumber of roundNumbers) {
      const leftDraw = a.drawByRound.get(roundNumber)?.[0] ?? Number.MAX_SAFE_INTEGER;
      const rightDraw = b.drawByRound.get(roundNumber)?.[0] ?? Number.MAX_SAFE_INTEGER;
      if (leftDraw !== rightDraw) return leftDraw - rightDraw;
    }

    return (
      a.artist_name.localeCompare(b.artist_name) ||
      a.album_name.localeCompare(b.album_name)
    );
  });

  // ── Layout ───────────────────────────────────────────────────────────────────
  // A4 landscape keeps the album-prep sheet compact enough to print as a working crate reference.
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, 10, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 10, 19);

  const roundColWidth = 16;

  autoTable(doc, {
    startY: 22,
    head: [["Artist", "Album", ...roundNumbers.map((r) => `R${r}`)]],
    body: tracks.map((track) => [
      track.artist_name,
      track.album_name,
      ...roundNumbers.map((r) => {
        const draws = track.drawByRound.get(r) ?? [];
        return draws.length > 0 ? draws.join(", ") : "—";
      }),
    ]),
    styles: {
      fontSize: 7,
      cellPadding: 1.2,
      overflow: "ellipsize",
    },
    headStyles: {
      fillColor: [33, 33, 33],
      fontSize: 7,
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 78 },  // Artist
      1: { cellWidth: 110 },  // Album
      // Round draw columns — R1 at index 2, R2 at 3, etc.
      ...Object.fromEntries(
        roundNumbers.map((_, i) => [
          2 + i,
          { cellWidth: roundColWidth, halign: "center" as const, fontStyle: "bold" as const },
        ])
      ),
    },
    alternateRowStyles: { fillColor: [245, 245, 240] },
  });

  return doc;
}
