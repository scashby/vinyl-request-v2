export interface StandaloneBingoCardCell {
  row: number;
  col: number;
  label: string;
  track_title: string;
  artist_name: string;
  free: boolean;
  call_id: number | null;
}

export interface StandaloneBingoCardRecord {
  id: string;
  sessionId: string;
  cardIndex: number;
  cardIdentifier: string;
  grid: StandaloneBingoCardCell[];
  createdAt: string;
}

export interface CreateStandaloneBingoCardInput {
  cardIndex: number;
  cardIdentifier: string;
  grid: StandaloneBingoCardCell[];
}

export interface StandaloneBingoCardsRepository {
  listBySession(sessionId: string): Promise<StandaloneBingoCardRecord[]>;
  createMany(sessionId: string, cards: CreateStandaloneBingoCardInput[]): Promise<void>;
  getByIdentifier(
    sessionId: string,
    cardIdentifier: string
  ): Promise<StandaloneBingoCardRecord | null>;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export class InMemoryStandaloneBingoCardsRepository
  implements StandaloneBingoCardsRepository
{
  private readonly cards: StandaloneBingoCardRecord[] = [];

  async listBySession(sessionId: string): Promise<StandaloneBingoCardRecord[]> {
    return this.cards
      .filter((card) => card.sessionId === sessionId)
      .sort((a, b) => a.cardIndex - b.cardIndex);
  }

  async createMany(
    sessionId: string,
    cards: CreateStandaloneBingoCardInput[]
  ): Promise<void> {
    const createdAt = new Date().toISOString();
    for (const card of cards) {
      this.cards.push({
        id: makeId(),
        sessionId,
        cardIndex: card.cardIndex,
        cardIdentifier: card.cardIdentifier,
        grid: card.grid,
        createdAt,
      });
    }
  }

  async getByIdentifier(
    sessionId: string,
    cardIdentifier: string
  ): Promise<StandaloneBingoCardRecord | null> {
    return (
      this.cards.find(
        (card) => card.sessionId === sessionId && card.cardIdentifier === cardIdentifier
      ) ?? null
    );
  }
}