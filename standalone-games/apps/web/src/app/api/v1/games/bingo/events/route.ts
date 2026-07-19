import { NextRequest, NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getRequestEntitlements, hasEntitlement } from "@/lib/entitlements";
import { getStandaloneEventsRepository } from "@/lib/standaloneEventsRepositoryFactory";

export async function GET() {
  try {
    const ctx = await getTenantRequestContext();
    const entitlements = await getRequestEntitlements(ctx.tenantId);
    if (!hasEntitlement(entitlements, "game:bingo")) {
      return NextResponse.json({ ok: false, error: "Missing entitlement: game:bingo" }, { status: 403 });
    }

    const repo = getStandaloneEventsRepository();
    const events = await repo.listByTenant(ctx.tenantId);
    return NextResponse.json({ ok: true, data: events });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unexpected error" }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantRequestContext();
    const entitlements = await getRequestEntitlements(ctx.tenantId);
    if (!hasEntitlement(entitlements, "game:bingo")) {
      return NextResponse.json({ ok: false, error: "Missing entitlement: game:bingo" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      date?: string;
      time?: string;
      location?: string;
      venue_logo_url?: string;
    };

    if (!body.title?.trim() || !body.date?.trim()) {
      return NextResponse.json({ ok: false, error: "title and date are required." }, { status: 400 });
    }

    const repo = getStandaloneEventsRepository();
    const event = await repo.create({
      tenantId: ctx.tenantId,
      title: body.title.trim(),
      date: body.date.trim(),
      time: body.time?.trim() || null,
      location: body.location?.trim() || null,
      venueLogoUrl: body.venue_logo_url?.trim() || null,
    });

    return NextResponse.json({ ok: true, data: event }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unexpected error" }, { status: 400 });
  }
}
