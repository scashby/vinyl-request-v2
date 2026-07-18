import { NextResponse } from "next/server";
import { getTenantRequestContext } from "@/lib/tenantContext";
import { getRequestEntitlements } from "@/lib/entitlements";

export async function GET() {
  try {
    const ctx = await getTenantRequestContext();
    const entitlements = await getRequestEntitlements(ctx.tenantId);

    return NextResponse.json({
      ok: true,
      data: {
        tenantId: entitlements.tenantId,
        products: entitlements.products,
      },
      note: "Header-based entitlement parsing scaffold. Replace with billing store integration.",
    });
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
