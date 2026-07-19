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

    const repo = getStandaloneBingoSessionPlaylistsRepository();
    const rows = await repo.listBySession(id);
    return NextResponse.json({ ok: true, data: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unexpected error" }, { status: 400 });
  }
}

export async function POST(
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
    const snapshotsRepo = getTenantPlaylistSnapshotsRepository();
    const playlistsRepo = getStandaloneBingoSessionPlaylistsRepository();

    const session = await sessionsRepo.getById(ctx.tenantId, id);
    if (!session) return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });

    const snapshot = await snapshotsRepo.getById(ctx.tenantId, session.playlistSnapshotId);
    if (!snapshot) return NextResponse.json({ ok: false, error: "Snapshot not found for session." }, { status: 404 });

    const payload = (snapshot.snapshotPayload ?? {}) as SnapshotPayload;
    const baseItems = Array.isArray(payload.items) ? payload.items : [];
    const roundCount = Math.max(1, session.roundCount);

    const letterRows = ["A", "B", "C"];
    const allRows = letterRows.flatMap((letter) =>
      Array.from({ length: roundCount }, (_, index) => {
        const round = index + 1;
        const perRound = Array.isArray(payload.roundPlaylistIds)
          ? payload.roundPlaylistIds.find((entry) => Number(entry.round ?? 0) === round)
          : null;
        const sourceItems = perRound ? baseItems : baseItems;
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

    await playlistsRepo.createMany(id, allRows);
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

    const body = (await request.json().catch(() => ({}))) as { playlist_letter?: string };
    const letter = String(body.playlist_letter ?? "").trim().toUpperCase();
    if (!letter) {
      return NextResponse.json({ ok: false, error: "playlist_letter is required." }, { status: 400 });
    }

    const repo = getStandaloneBingoSessionPlaylistsRepository();
    const current = (await repo.listBySession(id)).filter((row) => row.playlistLetter === letter);
    if (current.length === 0) {
      return NextResponse.json({ ok: false, error: "Playlist letter not found for session." }, { status: 404 });
    }

    const reshuffled = current.map((row) => ({
      roundNumber: row.roundNumber,
      playlistLetter: row.playlistLetter,
      playlistName: row.playlistName,
      callOrder: shuffle(row.callOrder).map((entry, index) => ({ ...entry, call_index: index + 1 })),
    }));

    await repo.replaceByLetter(id, letter, reshuffled);
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
