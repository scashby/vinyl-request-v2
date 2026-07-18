import { getStandaloneSupabaseClient } from "@/lib/supabaseStandalone";
import {
  type CreateStandaloneEventInput,
  type StandaloneEventRecord,
  type StandaloneEventsRepository,
} from "@/lib/standaloneEventsRepo";

function mapRow(row: Record<string, unknown>): StandaloneEventRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    title: String(row.title),
    date: String(row.date),
    time: typeof row.time === "string" ? row.time : null,
    location: typeof row.location === "string" ? row.location : null,
    venueLogoUrl: typeof row.venue_logo_url === "string" ? row.venue_logo_url : null,
    createdAt: String(row.created_at),
  };
}

export class SupabaseStandaloneEventsRepository implements StandaloneEventsRepository {
  async listByTenant(tenantId: string): Promise<StandaloneEventRecord[]> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_events")
      .select("id, tenant_id, title, date, time, location, venue_logo_url, created_at")
      .eq("tenant_id", tenantId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  async create(input: CreateStandaloneEventInput): Promise<StandaloneEventRecord> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_events")
      .insert({
        tenant_id: input.tenantId,
        title: input.title,
        date: input.date,
        time: input.time ?? null,
        location: input.location ?? null,
        venue_logo_url: input.venueLogoUrl ?? null,
      })
      .select("id, tenant_id, title, date, time, location, venue_logo_url, created_at")
      .single();

    if (error) throw new Error(error.message);
    return mapRow(data as Record<string, unknown>);
  }

  async getById(tenantId: string, eventId: string): Promise<StandaloneEventRecord | null> {
    const supabase = getStandaloneSupabaseClient();
    const { data, error } = await supabase
      .from("sg_events")
      .select("id, tenant_id, title, date, time, location, venue_logo_url, created_at")
      .eq("tenant_id", tenantId)
      .eq("id", eventId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapRow(data as Record<string, unknown>) : null;
  }
}
