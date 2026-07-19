import { NextRequest, NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getRequestEntitlements, hasEntitlement } from "@/lib/entitlements";
import { getStandaloneEventsRepository } from "@/lib/standaloneEventsRepositoryFactory";
import { getTenantPlaylistsRepository } from "@/lib/tenantPlaylistsRepositoryFactory";
import { getTenantPlaylistSnapshotsRepository } from "@/lib/tenantPlaylistSnapshotsRepositoryFactory";
import { generateStandaloneBingoCards } from "@/lib/standaloneBingoCardEngine";
import { getStandaloneBingoCardsRepository } from "@/lib/standaloneBingoCardsRepositoryFactory";
import { getStandaloneBingoCallsRepository } from "@/lib/standaloneBingoCallsRepositoryFactory";
import {
  type BingoGameMode,
  type StandaloneBingoRoundModesEntry,
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
  masterItems?: SnapshotPayloadItem[];
  roundItemsByRound?: Array<{ round: number; items: SnapshotPayloadItem[] }>;
  cardsPerRoundEnabled?: boolean;
}

interface CreateSessionBody {
  playlistSnapshotId?: string;
  event_id?: string;
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
  round_modes?: Array<{ round?: number; modes?: string[] }>;
  callIntervalSeconds?: number;
  call_interval_seconds?: number;
  remove_resleeve_seconds?: number;
  place_vinyl_seconds?: number;
  cue_seconds?: number;
  start_slide_seconds?: number;
  host_buffer_seconds?: number;
  sonos_output_delay_ms?: number;
  call_reveal_delay_seconds?: number;
  default_intermission_seconds?: number;
  welcome_heading_text?: string;
  welcome_message_text?: string;
  welcome_rules_text?: string;
  welcome_tiebreak_text?: string;
  intermission_heading_text?: string;
  intermission_message_text?: string;
  intermission_footer_text?: string;
  thanks_heading_text?: string;
  thanks_subheading_text?: string;
  thanks_events_heading_text?: string;
  show_countdown?: boolean;
  recent_calls_limit?: number;
  theme_enabled?: boolean;
  theme_name?: string;
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

function normalizeRoundModes(input: unknown, roundCount: number): StandaloneBingoRoundModesEntry[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      round: Number(entry.round ?? 1),
      modes: Array.isArray(entry.modes)
        ? entry.modes.filter((mode) => isValidGameMode(mode)).map((mode) => mode as BingoGameMode)
        : [],
    }))
    .filter((entry) => Number.isInteger(entry.round) && entry.round >= 1 && entry.round <= roundCount && entry.modes.length > 0);
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
    const eventRepo = getStandaloneEventsRepository();

    const roundCount = body.round_count ?? body.roundCount ?? 3;
    const cardCount = body.card_count ?? body.cardCount ?? 40;
    const removeResleeveSeconds = body.remove_resleeve_seconds ?? 20;
    const placeVinylSeconds = body.place_vinyl_seconds ?? 8;
    const cueSeconds = body.cue_seconds ?? 12;
    const startSlideSeconds = body.start_slide_seconds ?? 5;
    const hostBufferSeconds = body.host_buffer_seconds ?? 2;
    const sonosOutputDelayMs = body.sonos_output_delay_ms ?? 75;
    const callRevealDelaySeconds = body.call_reveal_delay_seconds ?? 10;
    const defaultIntermissionSeconds = body.default_intermission_seconds ?? 600;
    const derivedCallIntervalSeconds =
      removeResleeveSeconds +
      placeVinylSeconds +
      cueSeconds +
      startSlideSeconds +
      hostBufferSeconds +
      Math.ceil(sonosOutputDelayMs / 1000);
    const callIntervalSeconds = body.call_interval_seconds ?? body.callIntervalSeconds ?? derivedCallIntervalSeconds;
    const requestedGameMode = body.game_mode ?? body.gameMode;
    const gameMode: BingoGameMode = isValidGameMode(requestedGameMode)
      ? requestedGameMode
      : "single_line";
    const roundModes = normalizeRoundModes(body.round_modes, roundCount);

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

    const timingValues = [
      removeResleeveSeconds,
      placeVinylSeconds,
      cueSeconds,
      startSlideSeconds,
      hostBufferSeconds,
      sonosOutputDelayMs,
      callRevealDelaySeconds,
      defaultIntermissionSeconds,
    ];

    if (timingValues.some((value) => !Number.isInteger(value) || value < 0)) {
      return NextResponse.json(
        { ok: false, error: "Timing fields must be integers >= 0." },
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
    let eventId: string | null = null;

    if (body.event_id) {
      const event = await eventRepo.getById(ctx.tenantId, String(body.event_id));
      if (!event) {
        return NextResponse.json(
          { ok: false, error: "event_id does not exist for this tenant." },
          { status: 404 }
        );
      }
      eventId = event.id;
    }

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

      const roundItemsByRound = (Array.isArray(body.round_playlist_ids) ? body.round_playlist_ids : [])
        .map((entry) => {
          const playlistIds = Array.isArray(entry.playlist_ids) ? entry.playlist_ids.map(String) : [];
          const items = playlistIds.flatMap((playlistId) => {
            const snapshotEntry = resolvedSnapshots.find((candidate) => candidate.playlist?.id === playlistId)?.snapshot;
            const payload = (snapshotEntry?.snapshotPayload ?? {}) as SnapshotPayload;
            return Array.isArray(payload.items) ? payload.items : [];
          });
          return {
            round: Number(entry.round ?? 1),
            items,
          };
        })
        .filter((entry) => Number.isInteger(entry.round) && entry.round >= 1 && entry.items.length > 0);

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
          masterItems: combinedItems,
          roundItemsByRound,
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
      eventId,
      playlistSnapshotId: snapshot.id,
      roundCount,
      roundModes,
      cardCount,
      gameMode,
      callIntervalSeconds,
      removeResleeveSeconds,
      placeVinylSeconds,
      cueSeconds,
      startSlideSeconds,
      hostBufferSeconds,
      sonosOutputDelayMs,
      callRevealDelaySeconds,
      defaultIntermissionSeconds,
      welcomeHeadingText: body.welcome_heading_text?.trim() || undefined,
      welcomeMessageText: body.welcome_message_text?.trim() || undefined,
      welcomeRulesText: body.welcome_rules_text?.trim() || undefined,
      welcomeTiebreakText: body.welcome_tiebreak_text?.trim() || undefined,
      intermissionHeadingText: body.intermission_heading_text?.trim() || undefined,
      intermissionMessageText: body.intermission_message_text?.trim() || undefined,
      intermissionFooterText: body.intermission_footer_text?.trim() || undefined,
      thanksHeadingText: body.thanks_heading_text?.trim() || undefined,
      thanksSubheadingText: body.thanks_subheading_text?.trim() || undefined,
      thanksEventsHeadingText: body.thanks_events_heading_text?.trim() || undefined,
      showCountdown: body.show_countdown !== false,
      recentCallsLimit: Number.isFinite(Number(body.recent_calls_limit)) ? Math.max(1, Number(body.recent_calls_limit)) : 5,
      themeEnabled: body.theme_enabled === true,
      themeName: body.theme_enabled ? body.theme_name?.trim() || null : null,
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
