import { NextRequest, NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getRequestEntitlements, hasEntitlement } from "@/lib/entitlements";
import { getTenantPlaylistsRepository } from "@/lib/tenantPlaylistsRepositoryFactory";
import { getTenantPlaylistSnapshotsRepository } from "@/lib/tenantPlaylistSnapshotsRepositoryFactory";
import { generateStandaloneBingoCards } from "@/lib/standaloneBingoCardEngine";
import { getStandaloneBingoCardsRepository } from "@/lib/standaloneBingoCardsRepositoryFactory";
import { getStandaloneBingoCallsRepository } from "@/lib/standaloneBingoCallsRepositoryFactory";
import {
  type BingoGameMode,
} from "@/lib/standaloneBingoSessionsRepo";
import { getStandaloneBingoSessionsRepository } from "@/lib/standaloneBingoSessionsRepositoryFactory";

interface SnapshotPayloadItem {
  trackTitle?: string;
  artistName?: string;
  canonicalTrackId?: string | null;
}

interface SnapshotPayload {
  items?: SnapshotPayloadItem[];
  itemCount?: number;
  playlistName?: string;
}

interface CreateSessionBody {
  playlistSnapshotId?: string;
  playlist_id?: string;
  playlist_ids?: string[];
  master_playlist_ids?: string[];
  round_playlist_ids?: Array<{ round?: number; playlist_ids?: string[] }>;
  cards_per_round_enabled?: boolean;
  roundCount?: number;
  round_count?: number;
  cardCount?: number;
  card_count?: number;
  gameMode?: BingoGameMode;
  game_mode?: BingoGameMode;
  callIntervalSeconds?: number;
  call_interval_seconds?: number;
}

function isValidGameMode(value: unknown): value is BingoGameMode {
  return (
    value === "single_line" ||
    value === "double_line" ||
    value === "triple_line" ||
    value === "criss_cross" ||
    value === "four_corners" ||
    value === "blackout" ||
    value === "death"
  );
}

export async function GET() {
  try {
    const ctx = await getTenantRequestContext();
    const entitlements = await getRequestEntitlements(ctx.tenantId);
    if (!hasEntitlement(entitlements, "game:bingo")) {
      return NextResponse.json(
        { ok: false, error: "Missing entitlement: game:bingo" },
        { status: 403 }
      );
    }

    const repo = getStandaloneBingoSessionsRepository();
    const sessions = await repo.listByTenant(ctx.tenantId);

    return NextResponse.json({ ok: true, data: sessions });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantRequestContext();
    const entitlements = await getRequestEntitlements(ctx.tenantId);
    if (!hasEntitlement(entitlements, "game:bingo")) {
      return NextResponse.json(
        { ok: false, error: "Missing entitlement: game:bingo" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as CreateSessionBody;

    const snapshotRepo = getTenantPlaylistSnapshotsRepository();
    const playlistRepo = getTenantPlaylistsRepository();

    const roundCount = body.round_count ?? body.roundCount ?? 3;
    const cardCount = body.card_count ?? body.cardCount ?? 40;
    const callIntervalSeconds = body.call_interval_seconds ?? body.callIntervalSeconds ?? 45;
    const requestedGameMode = body.game_mode ?? body.gameMode;
    const gameMode: BingoGameMode = isValidGameMode(requestedGameMode)
      ? requestedGameMode
      : "single_line";

    if (!Number.isInteger(roundCount) || roundCount < 1) {
      return NextResponse.json(
        { ok: false, error: "roundCount must be an integer >= 1." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(cardCount) || cardCount < 1) {
      return NextResponse.json(
        { ok: false, error: "cardCount must be an integer >= 1." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(callIntervalSeconds) || callIntervalSeconds < 1) {
      return NextResponse.json(
        { ok: false, error: "callIntervalSeconds must be an integer >= 1." },
        { status: 400 }
      );
    }

    const explicitPlaylistIds = [
      ...(Array.isArray(body.master_playlist_ids) ? body.master_playlist_ids : []),
      ...(Array.isArray(body.playlist_ids) ? body.playlist_ids : []),
      ...(body.playlist_id ? [body.playlist_id] : []),
    ]
      .map((value) => String(value).trim())
      .filter((value, index, source) => value.length > 0 && source.indexOf(value) === index);

    const roundPlaylistIds = (Array.isArray(body.round_playlist_ids) ? body.round_playlist_ids : [])
      .flatMap((entry) => (Array.isArray(entry.playlist_ids) ? entry.playlist_ids : []))
      .map((value) => String(value).trim())
      .filter((value, index, source) => value.length > 0 && source.indexOf(value) === index);

    let snapshot = null;

    if (body.playlistSnapshotId && body.playlistSnapshotId.trim().length > 0) {
      snapshot = await snapshotRepo.getById(ctx.tenantId, body.playlistSnapshotId);
      if (!snapshot) {
        return NextResponse.json(
          { ok: false, error: "playlistSnapshotId does not exist for this tenant." },
          { status: 404 }
        );
      }
    } else {
      const sourcePlaylistIds = [...explicitPlaylistIds, ...roundPlaylistIds].filter(
        (value, index, source) => source.indexOf(value) === index
      );

      if (sourcePlaylistIds.length === 0) {
        return NextResponse.json(
          { ok: false, error: "At least one playlist or playlist snapshot is required." },
          { status: 400 }
        );
      }

      const [playlists, snapshots] = await Promise.all([
        playlistRepo.listByTenant(ctx.tenantId),
        snapshotRepo.listByTenant(ctx.tenantId),
      ]);

      const playlistById = new Map(playlists.map((playlist) => [playlist.id, playlist]));
      const latestSnapshotByPlaylistId = new Map<string, (typeof snapshots)[number]>();

      for (const candidate of snapshots) {
        if (!latestSnapshotByPlaylistId.has(candidate.tenantPlaylistId)) {
          latestSnapshotByPlaylistId.set(candidate.tenantPlaylistId, candidate);
        }
      }

      const resolvedSnapshots = sourcePlaylistIds.map((playlistId) => {
        const playlist = playlistById.get(playlistId);
        const resolvedSnapshot = latestSnapshotByPlaylistId.get(playlistId);
        return {
          playlist,
          snapshot: resolvedSnapshot ?? null,
        };
      });

      const missing = resolvedSnapshots.filter((entry) => !entry.playlist || !entry.snapshot);
      if (missing.length > 0) {
        return NextResponse.json(
          { ok: false, error: "Every selected playlist must have an imported snapshot before creating a session." },
          { status: 400 }
        );
      }

      const combinedItems = resolvedSnapshots.flatMap((entry) => {
        const payload = (entry.snapshot?.snapshotPayload ?? {}) as SnapshotPayload;
        return Array.isArray(payload.items) ? payload.items : [];
      });

      if (combinedItems.length === 0) {
        return NextResponse.json(
          { ok: false, error: "Selected playlists do not contain any snapshot items." },
          { status: 400 }
        );
      }

      const snapshotName = `Session Source · ${new Date().toLocaleString()}`;
      const firstPlaylistId = sourcePlaylistIds[0] as string;
      snapshot = await snapshotRepo.create({
        tenantId: ctx.tenantId,
        tenantPlaylistId: firstPlaylistId,
        createdByUserId: ctx.userId,
        snapshotName,
        snapshotPayload: {
          playlistName: resolvedSnapshots
            .map((entry) => entry.playlist?.name ?? "")
            .filter((value) => value.length > 0)
            .join(" + "),
          itemCount: combinedItems.length,
          items: combinedItems,
          sourcePlaylistIds,
          roundPlaylistIds: Array.isArray(body.round_playlist_ids) ? body.round_playlist_ids : [],
          cardsPerRoundEnabled: Boolean(body.cards_per_round_enabled),
        },
      });
    }

    const repo = getStandaloneBingoSessionsRepository();
    const session = await repo.create({
      tenantId: ctx.tenantId,
      createdByUserId: ctx.userId,
      playlistSnapshotId: snapshot.id,
      roundCount,
      cardCount,
      gameMode,
      callIntervalSeconds,
    });

    const snapshotPayload = (snapshot.snapshotPayload ?? {}) as SnapshotPayload;
    const seededCalls = (snapshotPayload.items ?? [])
      .map((item, index) => ({
        callIndex: index + 1,
        canonicalTrackId: item.canonicalTrackId ?? null,
        trackTitle: String(item.trackTitle ?? "").trim(),
        artistName: String(item.artistName ?? "").trim(),
      }))
      .filter((item) => item.trackTitle && item.artistName);

    const callsRepo = getStandaloneBingoCallsRepository();
    await callsRepo.createMany(session.id, seededCalls);

    const cardsRepo = getStandaloneBingoCardsRepository();
    const generatedCards = generateStandaloneBingoCards(
      session.sessionCode,
      seededCalls.map((call) => ({
        trackTitle: call.trackTitle,
        artistName: call.artistName,
      })),
      cardCount
    );
    await cardsRepo.createMany(session.id, generatedCards);

    return NextResponse.json({ ok: true, data: session }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      { status: 400 }
    );
  }
}
