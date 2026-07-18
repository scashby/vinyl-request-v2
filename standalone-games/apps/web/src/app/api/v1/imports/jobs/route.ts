import { NextRequest, NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getRequestEntitlements, hasEntitlement } from "@/lib/entitlements";
import {
  type ImportJobType,
  type ImportProvider,
} from "@/lib/importJobsRepo";
import { getImportJobsRepository } from "@/lib/importJobsRepositoryFactory";

interface CreateImportJobBody {
  provider?: ImportProvider;
  jobType?: ImportJobType;
  source?: {
    providerConnectionId?: string;
    providerPlaylistId?: string;
    uploadName?: string;
  };
}

function isValidProvider(value: unknown): value is ImportProvider {
  return value === "spotify" || value === "apple" || value === "tidal" || value === "csv";
}

function isValidJobType(value: unknown): value is ImportJobType {
  return value === "playlist_import" || value === "library_import" || value === "manual_upload";
}

export async function GET() {
  try {
    const ctx = await getTenantRequestContext();
    const entitlements = await getRequestEntitlements(ctx.tenantId);

    if (!hasEntitlement(entitlements, "addon:premium-connectors")) {
      return NextResponse.json(
        { ok: false, error: "Missing entitlement: addon:premium-connectors" },
        { status: 403 }
      );
    }

    const repo = getImportJobsRepository();
    const jobs = await repo.listByTenant(ctx.tenantId);
    return NextResponse.json({ ok: true, data: jobs });
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

    if (!hasEntitlement(entitlements, "addon:premium-connectors")) {
      return NextResponse.json(
        { ok: false, error: "Missing entitlement: addon:premium-connectors" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as CreateImportJobBody;

    if (!isValidProvider(body.provider)) {
      return NextResponse.json(
        { ok: false, error: "provider must be one of spotify, apple, tidal, csv." },
        { status: 400 }
      );
    }

    if (!isValidJobType(body.jobType)) {
      return NextResponse.json(
        { ok: false, error: "jobType must be one of playlist_import, library_import, manual_upload." },
        { status: 400 }
      );
    }

    const repo = getImportJobsRepository();
    const job = await repo.create({
      tenantId: ctx.tenantId,
      requestedByUserId: ctx.userId,
      provider: body.provider,
      jobType: body.jobType,
      source: body.source ?? {},
    });

    return NextResponse.json({ ok: true, data: job }, { status: 201 });
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
