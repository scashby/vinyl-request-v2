export type BingoGameMode =
  | "single_line"
  | "double_line"
  | "triple_line"
  | "criss_cross"
  | "four_corners"
  | "blackout"
  | "death";

export interface StandaloneBingoRoundModesEntry {
  round: number;
  modes: BingoGameMode[];
}

export interface CreateStandaloneBingoSessionInput {
  tenantId: string;
  createdByUserId: string;
  eventId?: string | null;
  playlistSnapshotId: string;
  roundCount: number;
  roundModes?: StandaloneBingoRoundModesEntry[];
  cardCount: number;
  gameMode: BingoGameMode;
  callIntervalSeconds: number;
  removeResleeveSeconds?: number;
  placeVinylSeconds?: number;
  cueSeconds?: number;
  startSlideSeconds?: number;
  hostBufferSeconds?: number;
  sonosOutputDelayMs?: number;
  callRevealDelaySeconds?: number;
  defaultIntermissionSeconds?: number;
  welcomeHeadingText?: string | null;
  welcomeMessageText?: string | null;
  welcomeRulesText?: string | null;
  welcomeTiebreakText?: string | null;
  intermissionHeadingText?: string | null;
  intermissionMessageText?: string | null;
  intermissionFooterText?: string | null;
  thanksHeadingText?: string | null;
  thanksSubheadingText?: string | null;
  thanksEventsHeadingText?: string | null;
  showCountdown?: boolean;
  recentCallsLimit?: number;
  themeEnabled?: boolean;
  themeName?: string | null;
  isSandbox?: boolean;
  sandboxSourceSessionId?: string | null;
  sandboxExpiresAt?: string | null;
}

export interface StandaloneBingoSessionRecord {
  id: string;
  tenantId: string;
  createdByUserId: string;
  eventId?: string | null;
  sessionCode: string;
  status: "pending" | "running" | "paused" | "completed";
  bingoOverlay: "none" | "welcome" | "countdown" | "thanks" | "winner" | "pending" | "tiebreaker";
  nextGameScheduledAt?: string | null;
  countdownStartedAt?: string | null;
  pausedAt?: string | null;
  pausedRemainingSeconds?: number | null;
  playlistSnapshotId: string;
  currentRound: number;
  roundCount: number;
  roundModes?: StandaloneBingoRoundModesEntry[];
  cardCount: number;
  gameMode: BingoGameMode;
  callIntervalSeconds: number;
  removeResleeveSeconds: number;
  placeVinylSeconds: number;
  cueSeconds: number;
  startSlideSeconds: number;
  hostBufferSeconds: number;
  sonosOutputDelayMs: number;
  callRevealDelaySeconds: number;
  defaultIntermissionSeconds: number;
  welcomeHeadingText?: string | null;
  welcomeMessageText?: string | null;
  welcomeRulesText?: string | null;
  welcomeTiebreakText?: string | null;
  intermissionHeadingText?: string | null;
  intermissionMessageText?: string | null;
  intermissionFooterText?: string | null;
  thanksHeadingText?: string | null;
  thanksSubheadingText?: string | null;
  thanksEventsHeadingText?: string | null;
  showCountdown: boolean;
  recentCallsLimit: number;
  themeEnabled: boolean;
  themeName?: string | null;
  isSandbox?: boolean;
  sandboxSourceSessionId?: string | null;
  sandboxExpiresAt?: string | null;
  isFavorite?: boolean;
  createdAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
}

export interface UpdateStandaloneBingoSessionInput {
  eventId?: string | null;
  roundCount?: number;
  roundModes?: StandaloneBingoRoundModesEntry[];
  cardCount?: number;
  gameMode?: BingoGameMode;
  callIntervalSeconds?: number;
  removeResleeveSeconds?: number;
  placeVinylSeconds?: number;
  cueSeconds?: number;
  startSlideSeconds?: number;
  hostBufferSeconds?: number;
  sonosOutputDelayMs?: number;
  status?: StandaloneBingoSessionRecord["status"];
  startedAt?: string | null;
  endedAt?: string | null;
  isFavorite?: boolean;
  welcomeHeadingText?: string | null;
  welcomeMessageText?: string | null;
  welcomeRulesText?: string | null;
  welcomeTiebreakText?: string | null;
  intermissionHeadingText?: string | null;
  intermissionMessageText?: string | null;
  intermissionFooterText?: string | null;
  thanksHeadingText?: string | null;
  thanksSubheadingText?: string | null;
  thanksEventsHeadingText?: string | null;
  showCountdown?: boolean;
  recentCallsLimit?: number;
  themeEnabled?: boolean;
  themeName?: string | null;
  callRevealDelaySeconds?: number;
  defaultIntermissionSeconds?: number;
  currentRound?: number;
  sandboxExpiresAt?: string | null;
  bingoOverlay?: StandaloneBingoSessionRecord["bingoOverlay"];
  nextGameScheduledAt?: string | null;
  countdownStartedAt?: string | null;
  pausedAt?: string | null;
  pausedRemainingSeconds?: number | null;
}

export interface StandaloneBingoSessionsRepository {
  listByTenant(tenantId: string): Promise<StandaloneBingoSessionRecord[]>;
  create(input: CreateStandaloneBingoSessionInput): Promise<StandaloneBingoSessionRecord>;
  getById(tenantId: string, sessionId: string): Promise<StandaloneBingoSessionRecord | null>;
  update(
    tenantId: string,
    sessionId: string,
    input: UpdateStandaloneBingoSessionInput
  ): Promise<StandaloneBingoSessionRecord | null>;
  delete(tenantId: string, sessionId: string): Promise<void>;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function makeSessionCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export class InMemoryStandaloneBingoSessionsRepository
  implements StandaloneBingoSessionsRepository
{
  private readonly sessions: StandaloneBingoSessionRecord[] = [];

  async listByTenant(tenantId: string): Promise<StandaloneBingoSessionRecord[]> {
    return this.sessions
      .filter((session) => session.tenantId === tenantId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async create(
    input: CreateStandaloneBingoSessionInput
  ): Promise<StandaloneBingoSessionRecord> {
    const session: StandaloneBingoSessionRecord = {
      id: makeId(),
      tenantId: input.tenantId,
      createdByUserId: input.createdByUserId,
      eventId: input.eventId ?? null,
      sessionCode: makeSessionCode(),
      status: "pending",
      bingoOverlay: "welcome",
      nextGameScheduledAt: null,
      countdownStartedAt: null,
      pausedAt: null,
      pausedRemainingSeconds: null,
      playlistSnapshotId: input.playlistSnapshotId,
      currentRound: 1,
      roundCount: input.roundCount,
      roundModes: input.roundModes ?? [],
      cardCount: input.cardCount,
      gameMode: input.gameMode,
      callIntervalSeconds: input.callIntervalSeconds,
      removeResleeveSeconds: input.removeResleeveSeconds ?? 20,
      placeVinylSeconds: input.placeVinylSeconds ?? 8,
      cueSeconds: input.cueSeconds ?? 12,
      startSlideSeconds: input.startSlideSeconds ?? 5,
      hostBufferSeconds: input.hostBufferSeconds ?? 2,
      sonosOutputDelayMs: input.sonosOutputDelayMs ?? 75,
      callRevealDelaySeconds: input.callRevealDelaySeconds ?? 10,
      defaultIntermissionSeconds: input.defaultIntermissionSeconds ?? 600,
      welcomeHeadingText: input.welcomeHeadingText ?? "Welcome To Vinyl Music Bingo",
      welcomeMessageText: input.welcomeMessageText ?? "Get your cards ready and listen for the next call.",
      welcomeRulesText: input.welcomeRulesText ?? "Complete the winning pattern before anyone else.",
      welcomeTiebreakText: input.welcomeTiebreakText ?? "Ties are resolved by the host.",
      intermissionHeadingText: input.intermissionHeadingText ?? "Intermission",
      intermissionMessageText: input.intermissionMessageText ?? "Round {round} of {roundCount} begins in",
      intermissionFooterText: input.intermissionFooterText ?? "Crate reset in progress. Next round starts shortly.",
      thanksHeadingText: input.thanksHeadingText ?? "Thank You For Playing!",
      thanksSubheadingText: input.thanksSubheadingText ?? "Vinyl Music Bingo",
      thanksEventsHeadingText: input.thanksEventsHeadingText ?? "Find Us Next At",
      showCountdown: input.showCountdown ?? true,
      recentCallsLimit: input.recentCallsLimit ?? 5,
      themeEnabled: input.themeEnabled ?? false,
      themeName: input.themeName ?? null,
      isSandbox: input.isSandbox ?? false,
      sandboxSourceSessionId: input.sandboxSourceSessionId ?? null,
      sandboxExpiresAt: input.sandboxExpiresAt ?? null,
      isFavorite: false,
      createdAt: new Date().toISOString(),
      startedAt: null,
      endedAt: null,
    };

    this.sessions.push(session);
    return session;
  }

  async getById(
    tenantId: string,
    sessionId: string
  ): Promise<StandaloneBingoSessionRecord | null> {
    return (
      this.sessions.find(
        (session) => session.tenantId === tenantId && session.id === sessionId
      ) ?? null
    );
  }

  async update(
    tenantId: string,
    sessionId: string,
    input: UpdateStandaloneBingoSessionInput
  ): Promise<StandaloneBingoSessionRecord | null> {
    const session = await this.getById(tenantId, sessionId);
    if (!session) return null;

    if (input.eventId !== undefined) session.eventId = input.eventId;
    if (input.roundCount !== undefined) session.roundCount = input.roundCount;
    if (input.cardCount !== undefined) session.cardCount = input.cardCount;
    if (input.gameMode !== undefined) session.gameMode = input.gameMode;
    if (input.callIntervalSeconds !== undefined) session.callIntervalSeconds = input.callIntervalSeconds;
    if (input.removeResleeveSeconds !== undefined) session.removeResleeveSeconds = input.removeResleeveSeconds;
    if (input.placeVinylSeconds !== undefined) session.placeVinylSeconds = input.placeVinylSeconds;
    if (input.cueSeconds !== undefined) session.cueSeconds = input.cueSeconds;
    if (input.startSlideSeconds !== undefined) session.startSlideSeconds = input.startSlideSeconds;
    if (input.hostBufferSeconds !== undefined) session.hostBufferSeconds = input.hostBufferSeconds;
    if (input.sonosOutputDelayMs !== undefined) session.sonosOutputDelayMs = input.sonosOutputDelayMs;
    if (input.status) session.status = input.status;
    if (input.startedAt !== undefined) session.startedAt = input.startedAt;
    if (input.endedAt !== undefined) session.endedAt = input.endedAt;
    if (input.isFavorite !== undefined) session.isFavorite = input.isFavorite;
    if (input.welcomeHeadingText !== undefined) session.welcomeHeadingText = input.welcomeHeadingText;
    if (input.welcomeMessageText !== undefined) session.welcomeMessageText = input.welcomeMessageText;
    if (input.welcomeRulesText !== undefined) session.welcomeRulesText = input.welcomeRulesText;
    if (input.welcomeTiebreakText !== undefined) session.welcomeTiebreakText = input.welcomeTiebreakText;
    if (input.intermissionHeadingText !== undefined) session.intermissionHeadingText = input.intermissionHeadingText;
    if (input.intermissionMessageText !== undefined) session.intermissionMessageText = input.intermissionMessageText;
    if (input.intermissionFooterText !== undefined) session.intermissionFooterText = input.intermissionFooterText;
    if (input.thanksHeadingText !== undefined) session.thanksHeadingText = input.thanksHeadingText;
    if (input.thanksSubheadingText !== undefined) session.thanksSubheadingText = input.thanksSubheadingText;
    if (input.thanksEventsHeadingText !== undefined) session.thanksEventsHeadingText = input.thanksEventsHeadingText;
    if (input.showCountdown !== undefined) session.showCountdown = input.showCountdown;
    if (input.recentCallsLimit !== undefined) session.recentCallsLimit = input.recentCallsLimit;
    if (input.themeEnabled !== undefined) session.themeEnabled = input.themeEnabled;
    if (input.themeName !== undefined) session.themeName = input.themeName;
    if (input.callRevealDelaySeconds !== undefined) {
      session.callRevealDelaySeconds = input.callRevealDelaySeconds;
    }
    if (input.defaultIntermissionSeconds !== undefined) {
      session.defaultIntermissionSeconds = input.defaultIntermissionSeconds;
    }
    if (input.currentRound !== undefined) {
      session.currentRound = input.currentRound;
    }
    if (input.roundModes !== undefined) {
      session.roundModes = input.roundModes;
    }
    if (input.sandboxExpiresAt !== undefined) {
      session.sandboxExpiresAt = input.sandboxExpiresAt;
    }
    if (input.bingoOverlay !== undefined) {
      session.bingoOverlay = input.bingoOverlay;
    }
    if (input.nextGameScheduledAt !== undefined) {
      session.nextGameScheduledAt = input.nextGameScheduledAt;
    }
    if (input.countdownStartedAt !== undefined) {
      session.countdownStartedAt = input.countdownStartedAt;
    }
    if (input.pausedAt !== undefined) {
      session.pausedAt = input.pausedAt;
    }
    if (input.pausedRemainingSeconds !== undefined) {
      session.pausedRemainingSeconds = input.pausedRemainingSeconds;
    }

    return session;
  }

  async delete(tenantId: string, sessionId: string): Promise<void> {
    const index = this.sessions.findIndex(
      (session) => session.tenantId === tenantId && session.id === sessionId
    );
    if (index >= 0) {
      this.sessions.splice(index, 1);
    }
  }
}
