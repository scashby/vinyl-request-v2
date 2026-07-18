import type { ProviderAdapter, ProviderAdapterRegistry, ProviderAuthorizationResult, ProviderPlaylistSummary, ProviderTrackPage } from "./index";

function notImplemented(provider: string, action: string): Error {
  return new Error(`Provider ${provider} adapter is not implemented yet for ${action}.`);
}

function createStubAdapter(provider: ProviderAdapter["provider"]): ProviderAdapter {
  return {
    provider,
    async authorize(): Promise<ProviderAuthorizationResult> {
      throw notImplemented(provider, "authorize");
    },
    async listPlaylists(): Promise<ProviderPlaylistSummary[]> {
      throw notImplemented(provider, "listPlaylists");
    },
    async fetchPlaylistPage(): Promise<ProviderTrackPage> {
      throw notImplemented(provider, "fetchPlaylistPage");
    },
  };
}

export function createStubProviderRegistry(): ProviderAdapterRegistry {
  const registry = new Map([
    ["spotify", createStubAdapter("spotify")],
    ["apple", createStubAdapter("apple")],
    ["tidal", createStubAdapter("tidal")],
    ["csv", createStubAdapter("csv")],
    ["manual", createStubAdapter("manual")],
  ] as const);

  return {
    get(provider) {
      const adapter = registry.get(provider);
      if (!adapter) {
        throw new Error(`Unsupported provider: ${provider}`);
      }
      return adapter;
    },
  };
}
