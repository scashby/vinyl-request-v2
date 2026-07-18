export interface StandaloneEventRecord {
  id: string;
  tenantId: string;
  title: string;
  date: string;
  time?: string | null;
  location?: string | null;
  venueLogoUrl?: string | null;
  createdAt: string;
}

export interface CreateStandaloneEventInput {
  tenantId: string;
  title: string;
  date: string;
  time?: string | null;
  location?: string | null;
  venueLogoUrl?: string | null;
}

export interface StandaloneEventsRepository {
  listByTenant(tenantId: string): Promise<StandaloneEventRecord[]>;
  create(input: CreateStandaloneEventInput): Promise<StandaloneEventRecord>;
  getById(tenantId: string, eventId: string): Promise<StandaloneEventRecord | null>;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export class InMemoryStandaloneEventsRepository implements StandaloneEventsRepository {
  private readonly events: StandaloneEventRecord[] = [];

  async listByTenant(tenantId: string): Promise<StandaloneEventRecord[]> {
    return this.events
      .filter((event) => event.tenantId === tenantId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async create(input: CreateStandaloneEventInput): Promise<StandaloneEventRecord> {
    const event: StandaloneEventRecord = {
      id: makeId(),
      tenantId: input.tenantId,
      title: input.title,
      date: input.date,
      time: input.time ?? null,
      location: input.location ?? null,
      venueLogoUrl: input.venueLogoUrl ?? null,
      createdAt: new Date().toISOString(),
    };
    this.events.push(event);
    return event;
  }

  async getById(tenantId: string, eventId: string): Promise<StandaloneEventRecord | null> {
    return this.events.find((event) => event.tenantId === tenantId && event.id === eventId) ?? null;
  }
}
