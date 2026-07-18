const baseUrl = process.env.STANDALONE_TEST_BASE_URL || "http://localhost:3000";
const tenantId = process.env.X_TENANT_ID || "demo-tenant";
const userId = process.env.X_USER_ID || "demo-user";
const entitlements =
  process.env.X_ENTITLEMENTS || "game:bingo,bundle:core-games,addon:premium-connectors";

const defaultHeaders = {
  "content-type": "application/json",
  "x-tenant-id": tenantId,
  "x-user-id": userId,
  "x-entitlements": entitlements,
};

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${JSON.stringify(json)}`);
  }

  return json;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  console.log(`Smoke test base URL: ${baseUrl}`);

  const health = await request("/api/v1/health", { method: "GET" });
  assert(health?.ok === true, "Health endpoint did not return ok=true");
  console.log("health ok");

  const playlist = await request("/api/v1/playlists", {
    method: "POST",
    body: JSON.stringify({
      provider: "manual",
      name: `Smoke Playlist ${Date.now()}`,
      description: "Standalone smoke test playlist",
    }),
  });
  const playlistId = playlist?.data?.id;
  assert(playlistId, "Playlist creation did not return an id");
  console.log("playlist ok", playlistId);

  const snapshot = await request("/api/v1/playlists/snapshots", {
    method: "POST",
    body: JSON.stringify({
      tenantPlaylistId: playlistId,
      snapshotName: `Smoke Snapshot ${Date.now()}`,
    }),
  });
  const snapshotId = snapshot?.data?.id;
  assert(snapshotId, "Snapshot creation did not return an id");
  console.log("snapshot ok", snapshotId);

  const session = await request("/api/v1/games/bingo/sessions", {
    method: "POST",
    body: JSON.stringify({
      playlistSnapshotId: snapshotId,
      roundCount: 3,
      cardCount: 40,
      gameMode: "single_line",
      callIntervalSeconds: 45,
    }),
  });
  assert(session?.data?.id, "Bingo session creation did not return an id");
  console.log("bingo session ok", session.data.id);

  const csvJob = await request("/api/v1/imports/jobs/run", {
    method: "POST",
    body: JSON.stringify({
      provider: "csv",
      jobType: "playlist_import",
      source: {
        uploadName: "smoke.csv",
        csvText: "title,artist,album\nDreams,Fleetwood Mac,Rumours\nBlue Monday,New Order,Substance",
      },
      playlistName: `CSV Smoke ${Date.now()}`,
    }),
  });
  assert(csvJob?.data?.job?.id, "CSV import job did not return a job id");
  console.log("csv import ok", csvJob.data.job.id);

  const spotifyPlaylistId = process.env.STANDALONE_SPOTIFY_PLAYLIST_ID || "";
  const spotifyAccessToken = process.env.STANDALONE_SPOTIFY_ACCESS_TOKEN || "";
  const providerConnectionId = process.env.STANDALONE_PROVIDER_CONNECTION_ID || "";

  if (spotifyPlaylistId && (spotifyAccessToken || providerConnectionId)) {
    const spotifyPayload = {
      provider: "spotify",
      jobType: "playlist_import",
      source: {
        providerPlaylistId: spotifyPlaylistId,
        ...(spotifyAccessToken ? { accessToken: spotifyAccessToken } : {}),
        ...(providerConnectionId ? { providerConnectionId } : {}),
      },
    };

    const spotifyJob = await request("/api/v1/imports/jobs/run", {
      method: "POST",
      body: JSON.stringify(spotifyPayload),
    });
    assert(spotifyJob?.data?.job?.id, "Spotify import job did not return a job id");
    console.log("spotify import ok", spotifyJob.data.job.id);
  } else {
    console.log("spotify import skipped");
  }

  console.log("smoke test complete");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});