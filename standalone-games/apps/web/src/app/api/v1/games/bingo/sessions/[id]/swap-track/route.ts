import { NextRequest, NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getRequestEntitlements, hasEntitlement } from "@/lib/entitlements";
import { getStandaloneBingoCallsRepository } from "@/lib/standaloneBingoCallsRepositoryFactory";
import { getStandaloneBingoCardsRepository } from "@/lib/standaloneBingoCardsRepositoryFactory";
import { getStandaloneBingoSessionsRepository } from "@/lib/standaloneBingoSessionsRepositoryFactory";
import { getStandaloneBingoSessionEventsRepository } from "@/lib/standaloneBingoSessionEventsRepositoryFactory";
import { getTenantPlaylistSnapshotsRepository } from "@/lib/tenantPlaylistSnapshotsRepositoryFactory";

type SwapBody = {
  fromTrackKey?: string;
  toTrackKey?: string;
};

type SnapshotItem = {
  trackTitle?: string;
  artistName?: string;
  albumName?: string | null;
  side?: string | null;
  position?: string | null;
  canonicalTrackId?: string | null;
};

function buildTrackKey(trackTitle: string, artistName: string) {
  return `${trackTitle.trim().toLowerCase()}::${artistName.trim().toLowerCase()}`;
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

    const body = (await request.json().catch(() => ({}))) as SwapBody;
    const fromTrackKey = String(body.fromTrackKey ?? "").trim().toLowerCase();
    const toTrackKey = String(body.toTrackKey ?? "").trim().toLowerCase();

    if (!fromTrackKey || !toTrackKey) {
      return NextResponse.json({ ok: false, error: "fromTrackKey and toTrackKey are required." }, { status: 400 });
    }

    const sessionsRepo = getStandaloneBingoSessionsRepository();
    const session = await sessionsRepo.getById(ctx.tenantId, id);
    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    }

    if (session.status !== "pending") {
      return NextResponse.json({ ok: false, error: "Track swapping is only supported before the session starts." }, { status: 400 });
    }

    const snapshotRepo = getTenantPlaylistSnapshotsRepository();
    const snapshots = await snapshotRepo.listByTenant(ctx.tenantId);
    let replacement: {
      trackTitle: string;
      artistName: string;
      albumName: string | null;
      side: string | null;
      position: string | null;
      canonicalTrackId: string | null;
    } | null = null;

    for (const snapshot of snapshots) {
      const items = Array.isArray((snapshot.snapshotPayload as { items?: unknown[] } | null)?.items)
        ? ((snapshot.snapshotPayload as { items?: SnapshotItem[] }).items ?? [])
        : [];
      for (const item of items) {
        const trackTitle = String(item.trackTitle ?? "").trim();
        const artistName = String(item.artistName ?? "").trim();
        if (!trackTitle || !artistName) continue;
        if (buildTrackKey(trackTitle, artistName) === toTrackKey) {
          replacement = {
            trackTitle,
            artistName,
            albumName: typeof item.albumName === "string" ? item.albumName.trim() || null : null,
            side: typeof item.side === "string" ? item.side.trim() || null : null,
            position: typeof item.position === "string" ? item.position.trim() || null : null,
            canonicalTrackId: item.canonicalTrackId ?? null,
          };
          break;
        }
      }
      if (replacement) break;
    }

    if (!replacement) {
      return NextResponse.json({ ok: false, error: "Replacement track was not found in imported snapshots." }, { status: 404 });
    }

    const callsRepo = getStandaloneBingoCallsRepository();
    const calls = await callsRepo.listBySession(id);
    const updatedCalls = calls.map((call) => {
      const trackKey = buildTrackKey(call.trackTitle, call.artistName);
      if (trackKey !== fromTrackKey) {
        return {
          callIndex: call.callIndex,
          canonicalTrackId: call.canonicalTrackId ?? null,
          trackTitle: call.trackTitle,
          artistName: call.artistName,
          albumName: call.albumName ?? null,
          side: call.side ?? null,
          position: call.position ?? null,
        };
      }
      return {
        callIndex: call.callIndex,
        canonicalTrackId: replacement.canonicalTrackId,
        trackTitle: replacement.trackTitle,
        artistName: replacement.artistName,
        albumName: replacement.albumName,
        side: replacement.side,
        position: replacement.position,
      };
    });

    const cardsRepo = getStandaloneBingoCardsRepository();
    const eventsRepo = getStandaloneBingoSessionEventsRepository();
    const cards = await cardsRepo.listBySession(id);
    const updatedCards = cards.map((card) => ({
      cardIndex: card.cardIndex,
      cardIdentifier: card.cardIdentifier,
      grid: card.grid.map((cell) => {
        const trackKey = buildTrackKey(cell.track_title, cell.artist_name);
        if (cell.free || trackKey !== fromTrackKey) return cell;
        return {
          ...cell,
          track_title: replacement.trackTitle,
          artist_name: replacement.artistName,
        };
      }),
    }));

    await callsRepo.replaceSession(id, updatedCalls);
    await cardsRepo.replaceSession(id, updatedCards);
    await eventsRepo.deleteBySession(id);

    return NextResponse.json({ ok: true, data: { updatedCalls: updatedCalls.length, updatedCards: updatedCards.length } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}
