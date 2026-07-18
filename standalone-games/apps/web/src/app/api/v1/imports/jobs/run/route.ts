import { NextRequest, NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getRequestEntitlements, hasEntitlement } from "@/lib/entitlements";
import { getImportJobsRepository } from "@/lib/importJobsRepositoryFactory";
import { importTracksToTenantPlaylist } from "@/lib/importToTenantPlaylist";
import { importCsvPlaylistTracks } from "@/lib/csvPlaylistImporter";
import { importSpotifyPlaylistTracks } from "@/lib/spotifyPlaylistImporter";
import { getProviderConnectionsRepository } from "@/lib/providerConnectionsRepositoryFactory";
import type { ImportJobType, ImportProvider } from "@/lib/importJobsRepo";

interface RunImportJobBody {
  provider?: ImportProvider;
  jobType?: ImportJobType;
  source?: {
    providerPlaylistId?: string;
    providerConnectionId?: string;
    accessToken?: string;
    csvText?: string;
    uploadName?: string;
  };
  playlistName?: string;
  maxTracks?: number;
}

function isValidProvider(value: unknown): value is ImportProvider {
  return value === "spotify" || value === "apple" || value === "tidal" || value === "csv";
}

function isValidJobType(value: unknown): value is ImportJobType {
  return value === "playlist_import" || value === "library_import" || value === "manual_upload";
}

export async function POST(request: NextRequest) {
  const now = new Date().toISOString();
  let repo: ReturnType<typeof getImportJobsRepository> | null = null;
  let tenantId = "";
  let createdJobId: string | null = null;

  try {
    const ctx = await getTenantRequestContext();
    tenantId = ctx.tenantId;
    const entitlements = await getRequestEntitlements(ctx.tenantId);

    if (!hasEntitlement(entitlements, "addon:premium-connectors")) {
      return NextResponse.json(
        { ok: false, error: "Missing entitlement: addon:premium-connectors" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as RunImportJobBody;

    if (!isValidProvider(body.provider)) {
      return NextResponse.json(
        { ok: false, error: "provider must be one of spotify, apple, tidal, csv." },
        { status: 400 }
      );
    }

    if (!isValidJobType(body.jobType) || body.jobType !== "playlist_import") {
      return NextResponse.json(
        { ok: false, error: "jobType must be playlist_import for this endpoint." },
        { status: 400 }
      );
    }

    repo = getImportJobsRepository();
    const job = await repo.create({
      tenantId: ctx.tenantId,
      requestedByUserId: ctx.userId,
      provider: body.provider,
      jobType: body.jobType,
      source: {
        providerConnectionId: body.source?.providerConnectionId,
        providerPlaylistId: body.source?.providerPlaylistId,
        uploadName: body.source?.uploadName,
      },
    });
    createdJobId = job.id;

    await repo.update(job.id, ctx.tenantId, {
      status: "running",
      progressPercent: 5,
      summary: "Import started",
      startedAt: now,
    });

    if (body.provider !== "spotify" && body.provider !== "csv") {
      await repo.update(job.id, ctx.tenantId, {
        status: "failed",
        progressPercent: 100,
        summary: `Provider ${body.provider} is not implemented yet for run-import endpoint.`,
        finishedAt: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          ok: false,
          jobId: job.id,
          error: `Provider ${body.provider} is not implemented yet for run-import endpoint.`,
        },
        { status: 501 }
      );
    }

    if (body.provider === "csv") {
      const csvText = String(body.source?.csvText ?? "").trim();
      const playlistName = String(body.playlistName ?? body.source?.uploadName ?? "CSV Import").trim();

      if (!csvText) {
        await repo.update(job.id, ctx.tenantId, {
          status: "failed",
          progressPercent: 100,
          summary: "CSV import requires source.csvText.",
          finishedAt: new Date().toISOString(),
        });

        return NextResponse.json(
          {
            ok: false,
            jobId: job.id,
            error: "CSV import requires source.csvText.",
          },
          { status: 400 }
        );
      }

      await repo.update(job.id, ctx.tenantId, {
        progressPercent: 30,
        summary: "Parsing CSV rows",
      });

      const csvResult = importCsvPlaylistTracks({
        csvText,
        playlistName,
      });

      await repo.update(job.id, ctx.tenantId, {
        progressPercent: 70,
        summary: "Creating tenant playlist and snapshot",
      });

      const importResult = await importTracksToTenantPlaylist({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        provider: "csv",
        providerPlaylistId: null,
        playlistName: csvResult.playlistName,
        description: "Imported from CSV",
        snapshotName: `${csvResult.playlistName} Snapshot`,
        tracks: csvResult.tracks,
      });

      const completedJob = await repo.update(job.id, ctx.tenantId, {
        status: "completed",
        progressPercent: 100,
        summary: `Imported ${csvResult.tracks.length} tracks from CSV.`,
        finishedAt: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          ok: true,
          data: {
            job: completedJob,
            playlist: importResult.playlist,
            snapshot: importResult.snapshot,
            importedTrackCount: csvResult.tracks.length,
          },
        },
        { status: 201 }
      );
    }

    let accessToken = String(body.source?.accessToken ?? "").trim();
    const providerPlaylistId = String(body.source?.providerPlaylistId ?? "").trim();
    const providerConnectionId = String(body.source?.providerConnectionId ?? "").trim();

    if (!accessToken && providerConnectionId) {
      const providerConnectionsRepo = getProviderConnectionsRepository();
      const connection = await providerConnectionsRepo.getById(
        ctx.tenantId,
        providerConnectionId
      );

      if (!connection) {
        await repo.update(job.id, ctx.tenantId, {
          status: "failed",
          progressPercent: 100,
          summary: "Provider connection not found for tenant.",
          finishedAt: new Date().toISOString(),
        });

        return NextResponse.json(
          {
            ok: false,
            jobId: job.id,
            error: "Provider connection not found for tenant.",
          },
          { status: 404 }
        );
      }

      if (connection.provider !== "spotify") {
        await repo.update(job.id, ctx.tenantId, {
          status: "failed",
          progressPercent: 100,
          summary: "Provider connection is not a Spotify connection.",
          finishedAt: new Date().toISOString(),
        });

        return NextResponse.json(
          {
            ok: false,
            jobId: job.id,
            error: "Provider connection is not a Spotify connection.",
          },
          { status: 400 }
        );
      }

      if (connection.connectionStatus !== "active") {
        await repo.update(job.id, ctx.tenantId, {
          status: "failed",
          progressPercent: 100,
          summary: "Provider connection is not active.",
          finishedAt: new Date().toISOString(),
        });

        return NextResponse.json(
          {
            ok: false,
            jobId: job.id,
            error: "Provider connection is not active.",
          },
          { status: 400 }
        );
      }

      accessToken = String(connection.encryptedAccessToken ?? "").trim();
    }

    if (!accessToken || !providerPlaylistId) {
      await repo.update(job.id, ctx.tenantId, {
        status: "failed",
        progressPercent: 100,
        summary:
          "Spotify import requires source.providerPlaylistId plus source.accessToken or source.providerConnectionId.",
        finishedAt: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          ok: false,
          jobId: job.id,
          error:
            "Spotify import requires source.providerPlaylistId plus source.accessToken or source.providerConnectionId.",
        },
        { status: 400 }
      );
    }

    await repo.update(job.id, ctx.tenantId, {
      progressPercent: 30,
      summary: "Fetching Spotify playlist metadata and tracks",
    });

    const spotifyResult = await importSpotifyPlaylistTracks({
      accessToken,
      providerPlaylistId,
      maxTracks: body.maxTracks,
    });

    await repo.update(job.id, ctx.tenantId, {
      progressPercent: 70,
      summary: "Creating tenant playlist and snapshot",
    });

    const importResult = await importTracksToTenantPlaylist({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      provider: "spotify",
      providerPlaylistId: spotifyResult.providerPlaylistId,
      playlistName: String(body.playlistName ?? "").trim() || spotifyResult.playlistName,
      description: "Imported from Spotify",
      snapshotName: `${spotifyResult.playlistName} Snapshot`,
      tracks: spotifyResult.tracks,
    });

    const completedJob = await repo.update(job.id, ctx.tenantId, {
      status: "completed",
      progressPercent: 100,
      summary: `Imported ${spotifyResult.tracks.length} tracks.`,
      finishedAt: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          job: completedJob,
          playlist: importResult.playlist,
          snapshot: importResult.snapshot,
          importedTrackCount: spotifyResult.tracks.length,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (repo && createdJobId && tenantId) {
      try {
        await repo.update(createdJobId, tenantId, {
          status: "failed",
          progressPercent: 100,
          summary: error instanceof Error ? error.message : "Unexpected error",
          finishedAt: new Date().toISOString(),
        });
      } catch {
        // Best effort status update; keep original error response.
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      { status: 400 }
    );
  }
}
