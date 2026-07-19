import { NextRequest, NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getRequestEntitlements, hasEntitlement } from "@/lib/entitlements";
import { getStandaloneBingoSessionPlaylistsRepository } from "@/lib/standaloneBingoSessionPlaylistsRepositoryFactory";
import { getTenantPlaylistSnapshotsRepository } from "@/lib/tenantPlaylistSnapshotsRepositoryFactory";
import { getStandaloneBingoSessionsRepository } from "@/lib/standaloneBingoSessionsRepositoryFactory";

type SnapshotItem = { trackTitle?: string; artistName?: string };

type SnapshotPayload = {
  sourcePlaylistIds?: string[];
  roundPlaylistIds?: Array<{ round?: number; playlist_ids?: string[] }>;
  items?: SnapshotItem[];
  masterItems?: SnapshotItem[];
  roundItemsByRound?: Array<{ round?: number; items?: SnapshotItem[] }>;
};

type PlaylistBody = {
  playlist_letters?: string[];
  replace_existing?: boolean;
};

type ReshuffleBody = {
  playlist_letter?: string;
  reshuffle_all?: boolean;
};

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = next[index];
    next[index] = next[swapIndex] as T;
    next[swapIndex] = temp as T;
  }
  return next;
}

function getSourceItemsForRound(payload: SnapshotPayload, round: number): SnapshotItem[] {
  const roundItems = Array.isArray(payload.roundItemsByRound)
    ? payload.roundItemsByRound.find((entry) => Number(entry.round ?? 0) === round)?.items
    : null;

  if (Array.isArray(roundItems) && roundItems.length > 0) {
    return roundItems;
  }

  if (Array.isArray(payload.masterItems) && payload.masterItems.length > 0) {
    return payload.masterItems;
  }

  return Array.isArray(payload.items) ? payload.items : [];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getTenantRequestContext();
    const entitlements = await getRequestEntitlements(ctx.tenantId);
    if (!hasEntitlement(entitlements, "game:bingo")) {
      return NextResponse.json({ ok: false, error: "Missing entitlement: game:bingo" }, { status: 403 });
    }

    const sessionsRepo = getStandaloneBingoSessionsRepository();
    if (!(await sessionsRepo.getById(ctx.tenantId, id))) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    }

    const repo = getStandaloneBingoSessionPlaylistsRepository();
    const rows = await repo.listBySession(id);
    return NextResponse.json({ ok: true, data: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unexpected error" }, { status: 400 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getTenantRequestContext();
    const entitlements = await getRequestEntitlements(ctx.tenantId);
    if (!hasEntitlement(entitlements, "game:bingo")) {
      return NextResponse.json({ ok: false, error: "Missing entitlement: game:bingo" }, { status: 403 });
    }

    const sessionsRepo = getStandaloneBingoSessionsRepository();
    const snapshotsRepo = getTenantPlaylistSnapshotsRepository();
    const playlistsRepo = getStandaloneBingoSessionPlaylistsRepository();

    const session = await sessionsRepo.getById(ctx.tenantId, id);
    if (!session) return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });

    const snapshot = await snapshotsRepo.getById(ctx.tenantId, session.playlistSnapshotId);
    if (!snapshot) return NextResponse.json({ ok: false, error: "Snapshot not found for session." }, { status: 404 });

    const payload = (snapshot.snapshotPayload ?? {}) as SnapshotPayload;
    const roundCount = Math.max(1, session.roundCount);
    const body = (await request.json().catch(() => ({}))) as PlaylistBody;
    const letters = Array.isArray(body.playlist_letters)
      ? body.playlist_letters
          .map((value) => String(value).trim().toUpperCase())
          .filter((value, index, source) => value.length > 0 && source.indexOf(value) === index)
      : ["A", "B", "C"];

    if (letters.length === 0) {
      return NextResponse.json({ ok: false, error: "At least one playlist letter is required." }, { status: 400 });
    }

    const allRows = letters.flatMap((letter) =>
      Array.from({ length: roundCount }, (_, index) => {
        const round = index + 1;
        const sourceItems = getSourceItemsForRound(payload, round);
        const shuffled = shuffle(sourceItems)
          .slice(0, 75)
          .map((item, itemIndex) => ({
            call_index: itemIndex + 1,
            track_title: String(item.trackTitle ?? "").trim(),
            artist_name: String(item.artistName ?? "").trim(),
          }))
          .filter((item) => item.track_title && item.artist_name);

        return {
          roundNumber: round,
          playlistLetter: letter,
          playlistName: `Round ${round} - Playlist ${letter}`,
          callOrder: shuffled,
        };
      })
    );

    const validRows = allRows.filter((row) => row.callOrder.length > 0);
    if (validRows.length === 0) {
      return NextResponse.json({ ok: false, error: "No source tracks available to generate playlists." }, { status: 400 });
    }

    if (body.replace_existing !== false) {
      const existing = await playlistsRepo.listBySession(id);
      const existingLetters = [...new Set(existing.map((row) => row.playlistLetter))];
      await Promise.all(existingLetters.map((letter) => playlistsRepo.deleteByLetter(id, letter)));
    }

    await playlistsRepo.createMany(id, validRows);
    const rows = await playlistsRepo.listBySession(id);
    return NextResponse.json({ ok: true, data: rows }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unexpected error" }, { status: 400 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getTenantRequestContext();
    const entitlements = await getRequestEntitlements(ctx.tenantId);
    if (!hasEntitlement(entitlements, "game:bingo")) {
      return NextResponse.json({ ok: false, error: "Missing entitlement: game:bingo" }, { status: 403 });
    }

    const sessionsRepo = getStandaloneBingoSessionsRepository();
    if (!(await sessionsRepo.getById(ctx.tenantId, id))) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as ReshuffleBody;
    const letter = String(body.playlist_letter ?? "").trim().toUpperCase();

    const repo = getStandaloneBingoSessionPlaylistsRepository();
    const currentRows = await repo.listBySession(id);
    const targetLetters = body.reshuffle_all
      ? [...new Set(currentRows.map((row) => row.playlistLetter))]
      : (letter ? [letter] : []);

    if (targetLetters.length === 0) {
      return NextResponse.json({ ok: false, error: "Provide playlist_letter or set reshuffle_all=true." }, { status: 400 });
    }

    for (const targetLetter of targetLetters) {
      const current = currentRows.filter((row) => row.playlistLetter === targetLetter);
      if (current.length === 0) continue;

      const reshuffled = current.map((row) => ({
        roundNumber: row.roundNumber,
        playlistLetter: row.playlistLetter,
        playlistName: row.playlistName,
        callOrder: shuffle(row.callOrder).map((entry, index) => ({ ...entry, call_index: index + 1 })),
      }));

      await repo.replaceByLetter(id, targetLetter, reshuffled);
    }

    const rows = await repo.listBySession(id);
    return NextResponse.json({ ok: true, data: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unexpected error" }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getTenantRequestContext();
    const entitlements = await getRequestEntitlements(ctx.tenantId);
    if (!hasEntitlement(entitlements, "game:bingo")) {
      return NextResponse.json({ ok: false, error: "Missing entitlement: game:bingo" }, { status: 403 });
    }

    const sessionsRepo = getStandaloneBingoSessionsRepository();
    if (!(await sessionsRepo.getById(ctx.tenantId, id))) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    }

    const letter = String(request.nextUrl.searchParams.get("playlist_letter") ?? "").trim().toUpperCase();
    if (!letter) {
      return NextResponse.json({ ok: false, error: "playlist_letter query param is required." }, { status: 400 });
    }

    const repo = getStandaloneBingoSessionPlaylistsRepository();
    await repo.deleteByLetter(id, letter);
    const rows = await repo.listBySession(id);
    return NextResponse.json({ ok: true, data: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unexpected error" }, { status: 400 });
  }
}
