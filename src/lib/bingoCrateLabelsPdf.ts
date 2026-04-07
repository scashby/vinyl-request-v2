import { jsPDF } from "jspdf";
import { formatBallLabel } from "src/lib/bingoBall";

export type LabelPlaylist = {
  playlist_name: string;
  playlist_letter: string;
  round_number: number;
  call_order: Array<{
    call_index: number;
    ball_number: number | null;
    column_letter: string;
    track_title: string;
    artist_name: string;
    album_name: string | null;
    side: string | null;
    position: string | null;
    track_key?: string | null;
  }>;
};

type TrackLabel = {
  artist_name: string;
  track_title: string;
  album_name: string | null;
  side: string | null;
  position: string | null;
  positions: Array<{ displayName: string; callIndex: number; ballLabel: string }>;
};

function normalize(text: string): string {
  return String(text ?? "")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-")
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract the animal/letter name from "QFTD46 Playlist Fox" → "Fox" */
function shortName(playlistName: string): string {
  const m = /Playlist\s+(\S.*)$/.exec(playlistName);
  return m ? m[1].trim() : playlistName;
}

function wrapToWidth(doc: jsPDF, text: string, maxWidth: number): string[] {
  const words = normalize(text).split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (doc.getTextWidth(candidate) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Generate a printable label sheet for a bingo session's crate.
 *
 * Produces one label per unique track (keyed by track_key or artist+title+album),
 * showing each playlist name and the call_index for that track.
 * Sort order: artist → album → side/position.
 */
export function generateBingoCrateLabelsPdf(playlists: LabelPlaylist[], sessionCode: string): jsPDF {
  // ── Build cross-reference ──────────────────────────────────────────────────
  const trackMap = new Map<string, TrackLabel>();
  const hasMultipleRounds = new Set(playlists.map((p) => p.round_number)).size > 1;

  for (const playlist of playlists) {
    const display = hasMultipleRounds
      ? `${shortName(playlist.playlist_name)} R${playlist.round_number}`
      : shortName(playlist.playlist_name);

    for (const entry of playlist.call_order) {
      // Use track_key if available; otherwise fall back to (artist · title · album).
      const key =
        entry.track_key && entry.track_key.trim()
          ? entry.track_key
          : `${entry.artist_name}::${entry.track_title}::${entry.album_name ?? ""}`;

      const ballLabel = formatBallLabel(entry.ball_number ?? null, entry.column_letter);
      const existing = trackMap.get(key);
      if (existing) {
        existing.positions.push({ displayName: display, callIndex: entry.call_index, ballLabel });
      } else {
        trackMap.set(key, {
          artist_name: entry.artist_name,
          track_title: entry.track_title,
          album_name: entry.album_name,
          side: entry.side,
          position: entry.position,
          positions: [{ displayName: display, callIndex: entry.call_index, ballLabel }],
        });
      }
    }
  }

  // Sort alphabetically by artist → album → position
  const tracks = Array.from(trackMap.values()).sort((a, b) => {
    const ac = a.artist_name.localeCompare(b.artist_name);
    if (ac !== 0) return ac;
    const bc = (a.album_name ?? "").localeCompare(b.album_name ?? "");
    if (bc !== 0) return bc;
    return (a.position ?? "").localeCompare(b.position ?? "");
  });

  // Within each track, sort positions alphabetically by displayName
  for (const t of tracks) {
    t.positions.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  // ── Layout constants (US Letter portrait, points) ─────────────────────────
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });

  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN_X = 30;
  const MARGIN_Y = 30;
  const COLS = 3;
  const ROWS = 8;
  const LABEL_W = (PAGE_W - MARGIN_X * 2) / COLS; // ~184pt
  const LABEL_H = (PAGE_H - MARGIN_Y * 2) / ROWS; // ~91.5pt
  const PAD = 5;

  // ── First page header ──────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  // Title replaces the top margin — shift labels down for first page
  const HEADER_H = 18;

  let trackIndex = 0;
  let firstPage = true;

  while (trackIndex < tracks.length) {
    if (!firstPage) doc.addPage();
    firstPage = false;

    // Print session identifier in the top margin
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(
      `${sessionCode} — Crate Labels  (${tracks.length} tracks, ${playlists.length} playlists)`,
      MARGIN_X,
      MARGIN_Y - 8
    );

    const labelAreaTop = MARGIN_Y + (HEADER_H > 0 ? 0 : 0);

    for (let row = 0; row < ROWS && trackIndex < tracks.length; row++) {
      for (let col = 0; col < COLS && trackIndex < tracks.length; col++) {
        const track = tracks[trackIndex];
        const lx = MARGIN_X + col * LABEL_W;
        const ly = labelAreaTop + row * LABEL_H;

        // ── Border ──────────────────────────────────────────────────────────
        doc.setDrawColor(190, 190, 190);
        doc.setLineWidth(0.4);
        doc.rect(lx, ly, LABEL_W, LABEL_H);

        const cx = lx + PAD;
        let cy = ly + PAD + 1;
        const textW = LABEL_W - PAD * 2;

        // ── Artist ──────────────────────────────────────────────────────────
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(20, 20, 20);
        const artistLines = wrapToWidth(doc, track.artist_name, textW);
        const artistText = artistLines[0] ?? "";
        doc.text(artistText, cx, cy, { baseline: "top" });
        cy += 11;

        // ── Track title ──────────────────────────────────────────────────────
        doc.setFont("helvetica", "bolditalic");
        doc.setFontSize(8);
        doc.setTextColor(30, 30, 30);
        const titleLines = wrapToWidth(doc, `\u201C${normalize(track.track_title)}\u201D`, textW);
        const maxTitleLines = 2;
        for (let i = 0; i < Math.min(titleLines.length, maxTitleLines); i++) {
          doc.text(titleLines[i], cx, cy, { baseline: "top" });
          cy += 10;
        }
        if (titleLines.length > maxTitleLines) cy -= 1; // tight mode

        // ── Album · Side/Pos ────────────────────────────────────────────────
        const albumParts: string[] = [];
        if (track.album_name) albumParts.push(normalize(track.album_name));
        const sidePos = [track.side, track.position].filter(Boolean).join(" ");
        if (sidePos) albumParts.push(sidePos);
        if (albumParts.length > 0) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.5);
          doc.setTextColor(100, 100, 100);
          const albumLine = albumParts.join(" \u00B7 ");
          const albumLines = wrapToWidth(doc, albumLine, textW);
          doc.text(albumLines[0] ?? "", cx, cy, { baseline: "top" });
          cy += 9;
        }

        // ── Divider ──────────────────────────────────────────────────────────
        doc.setDrawColor(210, 210, 210);
        doc.setLineWidth(0.3);
        doc.line(cx, cy + 1, cx + textW, cy + 1);
        cy += 5;

        // ── Playlist positions ───────────────────────────────────────────────
        // Render positions 3 per row: "Bear #3   Fox #41   Wolf #7"
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);

        const lineMaxItems = 3;
        for (let i = 0; i < track.positions.length; i += lineMaxItems) {
          const chunk = track.positions.slice(i, i + lineMaxItems);
          // Distribute evenly across label width
          const colWidth = textW / lineMaxItems;
          for (let j = 0; j < chunk.length; j++) {
            const p = chunk[j];
            const posX = cx + j * colWidth;
            // Playlist name in dark blue, number in black
            const label = `${p.displayName}: `;
            const number = `#${p.callIndex}`;
            doc.setTextColor(50, 80, 160);
            doc.text(label, posX, cy, { baseline: "top" });
            const labelW = doc.getTextWidth(label);
            doc.setTextColor(20, 20, 20);
            doc.text(number, posX + labelW, cy, { baseline: "top" });
          }
          cy += 9;
          if (cy > ly + LABEL_H - PAD) break; // guard: don't overflow cell
        }

        trackIndex++;
      }
    }
  }

  return doc;
}
