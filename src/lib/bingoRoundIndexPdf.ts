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
 * Generate a cross-round draw-order index for a bingo session.
 *
 * Produces one row per unique track (keyed by artist · album · side · position),
 * with a separate column for each round's draw number.
 * Sorted alphabetically by artist so you can quickly locate any album in the crate
 * and write all its round numbers on a single label before the event.
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

  // Sort alphabetically by artist
  const tracks = Array.from(trackMap.values()).sort((a, b) =>
    a.artist_name.localeCompare(b.artist_name)
  );

  const roundNumbers = rounds.map((r) => r.roundNumber).sort((a, b) => a - b);

  // ── Layout ───────────────────────────────────────────────────────────────────
  // A4 landscape (~297×210mm) gives comfortable width for artist + album + round cols
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, 10, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 10, 19);

  const roundColWidth = 22;

  autoTable(doc, {
    startY: 24,
    head: [["Artist", "Album", "Side", "Pos", ...roundNumbers.map((r) => `R${r} Draw`)]],
    body: tracks.map((track) => [
      track.artist_name,
      track.album_name,
      track.side,
      track.position,
      ...roundNumbers.map((r) => track.drawByRound.get(r) ?? "—"),
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: "ellipsize",
    },
    headStyles: {
      fillColor: [33, 33, 33],
      fontSize: 8,
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 60 },  // Artist
      1: { cellWidth: 60 },  // Album
      2: { cellWidth: 14 },  // Side
      3: { cellWidth: 14 },  // Pos
      // Round draw columns — R1 at index 4, R2 at 5, etc.
      ...Object.fromEntries(
        roundNumbers.map((_, i) => [
          4 + i,
          { cellWidth: roundColWidth, halign: "center" as const, fontStyle: "bold" as const },
        ])
      ),
    },
    alternateRowStyles: { fillColor: [245, 245, 240] },
  });

  return doc;
}
