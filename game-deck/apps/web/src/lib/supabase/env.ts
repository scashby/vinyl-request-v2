function required(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

export function getSupabaseUrl(): string {
  return required("GAMEDECK_SUPABASE_URL", process.env.GAMEDECK_SUPABASE_URL);
}

export function getSupabasePublishableKey(): string {
  return required("GAMEDECK_SUPABASE_PUBLISHABLE_KEY", process.env.GAMEDECK_SUPABASE_PUBLISHABLE_KEY);
}

export function getSupabaseSecretKey(): string {
  return required("GAMEDECK_SUPABASE_SECRET_KEY", process.env.GAMEDECK_SUPABASE_SECRET_KEY);
}
