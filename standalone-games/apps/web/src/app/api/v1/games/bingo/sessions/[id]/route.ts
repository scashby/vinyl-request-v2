import { NextRequest, NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getRequestEntitlements, hasEntitlement } from "@/lib/entitlements";
import { getStandaloneBingoSessionsRepository } from "@/lib/standaloneBingoSessionsRepositoryFactory";
import { getTenantPlaylistSnapshotsRepository } from "@/lib/tenantPlaylistSnapshotsRepositoryFactory";
import { getStandaloneBingoCallsRepository } from "@/lib/standaloneBingoCallsRepositoryFactory";
import { getStandaloneBingoSessionEventsRepository } from "@/lib/standaloneBingoSessionEventsRepositoryFactory";
import { computeStandaloneTransportQueueIds } from "@/lib/standaloneTransportQueue";

const DONE_STATUSES = new Set(["called", "completed", "skipped"]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getTenantRequestContext();
    const entitlements = await getRequestEntitlements(ctx.tenantId);

    if (!hasEntitlement(entitlements, "game:bingo")) {
      return NextResponse.json(
        { ok: false, error: "Missing entitlement: game:bingo" },
        { status: 403 }
      );
    }

    const repo = getStandaloneBingoSessionsRepository();
    const session = await repo.getById(ctx.tenantId, id);

    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    }

    const callsRepo = getStandaloneBingoCallsRepository();
    const eventsRepo = getStandaloneBingoSessionEventsRepository();
    const [calls, events] = await Promise.all([
      callsRepo.listBySession(id),
      eventsRepo.listBySession(id),
    ]);
    const currentOrder = [...calls]
      .filter((call) => call.status === "called")
      .sort((a, b) => b.callIndex - a.callIndex)[0]?.callIndex ?? 0;
    const transportQueueCallIds = computeStandaloneTransportQueueIds(
      calls.map((call) => ({ id: call.id, order: call.callIndex, status: call.status })),
      events.map((event) => ({
        eventType: event.eventType,
        callId: event.payload?.call_id ?? null,
        afterCallId: event.payload?.after_call_id ?? null,
      })),
      {
        currentOrder,
        doneStatuses: DONE_STATUSES,
      }
    );

    return NextResponse.json({ ok: true, data: { ...session, transportQueueCallIds } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getTenantRequestContext();
    const entitlements = await getRequestEntitlements(ctx.tenantId);

    if (!hasEntitlement(entitlements, "game:bingo")) {
      return NextResponse.json(
        { ok: false, error: "Missing entitlement: game:bingo" },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const repo = getStandaloneBingoSessionsRepository();
    const snapshotRepo = getTenantPlaylistSnapshotsRepository();
    const session = await repo.getById(ctx.tenantId, id);

    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    }

    if (
      body.master_playlist_ids !== undefined ||
      body.round_playlist_ids !== undefined ||
      body.cards_per_round_enabled !== undefined
    ) {
      const snapshot = await snapshotRepo.getById(ctx.tenantId, session.playlistSnapshotId);
      if (snapshot) {
        const currentPayload = (snapshot.snapshotPayload ?? {}) as Record<string, unknown>;
        const sourcePlaylistIds = Array.isArray(body.master_playlist_ids)
          ? body.master_playlist_ids.map(String)
          : Array.isArray(currentPayload.sourcePlaylistIds)
            ? (currentPayload.sourcePlaylistIds as unknown[]).map(String)
            : [];
        const roundPlaylistIds = Array.isArray(body.round_playlist_ids)
          ? body.round_playlist_ids
          : (Array.isArray(currentPayload.roundPlaylistIds) ? currentPayload.roundPlaylistIds : []);
        await snapshotRepo.update(ctx.tenantId, session.playlistSnapshotId, {
          snapshotPayload: {
            ...currentPayload,
            sourcePlaylistIds,
            roundPlaylistIds,
            cardsPerRoundEnabled: body.cards_per_round_enabled === undefined
              ? currentPayload.cardsPerRoundEnabled
              : Boolean(body.cards_per_round_enabled),
          },
        });
      }
    }

    const updated = await repo.update(ctx.tenantId, id, {
      eventId: body.event_id === undefined ? undefined : (body.event_id ? String(body.event_id) : null),
      roundCount: body.round_count === undefined ? undefined : Math.max(1, Number(body.round_count)),
      roundModes: Array.isArray(body.round_modes) ? body.round_modes as Array<{ round: number; modes: Array<"single_line" | "double_line" | "triple_line" | "criss_cross" | "four_corners" | "blackout" | "death"> }> : undefined,
      cardCount: body.card_count === undefined ? undefined : Math.max(1, Number(body.card_count)),
      gameMode: body.game_mode === undefined ? undefined : String(body.game_mode) as never,
      callIntervalSeconds: body.call_interval_seconds === undefined ? undefined : Math.max(1, Number(body.call_interval_seconds)),
      removeResleeveSeconds: body.remove_resleeve_seconds === undefined ? undefined : Math.max(0, Number(body.remove_resleeve_seconds)),
      placeVinylSeconds: body.place_vinyl_seconds === undefined ? undefined : Math.max(0, Number(body.place_vinyl_seconds)),
      cueSeconds: body.cue_seconds === undefined ? undefined : Math.max(0, Number(body.cue_seconds)),
      startSlideSeconds: body.start_slide_seconds === undefined ? undefined : Math.max(0, Number(body.start_slide_seconds)),
      hostBufferSeconds: body.host_buffer_seconds === undefined ? undefined : Math.max(0, Number(body.host_buffer_seconds)),
      sonosOutputDelayMs: body.sonos_output_delay_ms === undefined ? undefined : Math.max(0, Number(body.sonos_output_delay_ms)),
      isFavorite: body.is_favorite === undefined ? undefined : Boolean(body.is_favorite),
      welcomeHeadingText: body.welcome_heading_text === undefined ? undefined : (body.welcome_heading_text ? String(body.welcome_heading_text) : null),
      welcomeMessageText: body.welcome_message_text === undefined ? undefined : (body.welcome_message_text ? String(body.welcome_message_text) : null),
      welcomeRulesText: body.welcome_rules_text === undefined ? undefined : (body.welcome_rules_text ? String(body.welcome_rules_text) : null),
      welcomeTiebreakText: body.welcome_tiebreak_text === undefined ? undefined : (body.welcome_tiebreak_text ? String(body.welcome_tiebreak_text) : null),
      intermissionHeadingText: body.intermission_heading_text === undefined ? undefined : (body.intermission_heading_text ? String(body.intermission_heading_text) : null),
      intermissionMessageText: body.intermission_message_text === undefined ? undefined : (body.intermission_message_text ? String(body.intermission_message_text) : null),
      intermissionFooterText: body.intermission_footer_text === undefined ? undefined : (body.intermission_footer_text ? String(body.intermission_footer_text) : null),
      thanksHeadingText: body.thanks_heading_text === undefined ? undefined : (body.thanks_heading_text ? String(body.thanks_heading_text) : null),
      thanksSubheadingText: body.thanks_subheading_text === undefined ? undefined : (body.thanks_subheading_text ? String(body.thanks_subheading_text) : null),
      thanksEventsHeadingText: body.thanks_events_heading_text === undefined ? undefined : (body.thanks_events_heading_text ? String(body.thanks_events_heading_text) : null),
      showCountdown: body.show_countdown === undefined ? undefined : Boolean(body.show_countdown),
      recentCallsLimit: body.recent_calls_limit === undefined ? undefined : Math.max(1, Number(body.recent_calls_limit)),
      themeEnabled: body.theme_enabled === undefined ? undefined : Boolean(body.theme_enabled),
      themeName: body.theme_name === undefined ? undefined : (body.theme_name ? String(body.theme_name) : null),
      callRevealDelaySeconds: body.call_reveal_delay_seconds === undefined ? undefined : Math.max(0, Number(body.call_reveal_delay_seconds)),
      defaultIntermissionSeconds: body.default_intermission_seconds === undefined ? undefined : Math.max(0, Number(body.default_intermission_seconds)),
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getTenantRequestContext();
    const entitlements = await getRequestEntitlements(ctx.tenantId);

    if (!hasEntitlement(entitlements, "game:bingo")) {
      return NextResponse.json(
        { ok: false, error: "Missing entitlement: game:bingo" },
        { status: 403 }
      );
    }

    const repo = getStandaloneBingoSessionsRepository();
    await repo.delete(ctx.tenantId, id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}