import { NextRequest, NextResponse } from "next/server";
import type { AdminImageSourceType } from "src/lib/adminImageLibraryTypes";
import {
  deleteImageAsset,
  isAdminImageKind,
  listImageAssets,
  requireAdminUser,
  setImageAssetArchived,
  uploadImageAsset,
} from "src/lib/adminImageLibraryServer";

export const runtime = "nodejs";

type MutationBody = {
  imageKind?: unknown;
  publicUrl?: unknown;
  storagePath?: unknown;
  sourceType?: unknown;
  label?: unknown;
  archived?: unknown;
};

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function buildIdentity(body: MutationBody) {
  let sourceType: AdminImageSourceType | undefined;
  if (body.sourceType === "supabase" || body.sourceType === "external") {
    sourceType = body.sourceType;
  }

  if (!isAdminImageKind(body.imageKind)) {
    throw new Error("A valid image kind is required.");
  }
  if (typeof body.publicUrl !== "string" || !body.publicUrl.trim()) {
    throw new Error("A publicUrl is required.");
  }

  return {
    imageKind: body.imageKind,
    publicUrl: body.publicUrl.trim(),
    storagePath:
      typeof body.storagePath === "string" && body.storagePath.trim()
        ? body.storagePath.trim()
        : null,
    sourceType,
    label: typeof body.label === "string" && body.label.trim() ? body.label.trim() : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request);
  } catch {
    return unauthorizedResponse();
  }

  const imageKind = request.nextUrl.searchParams.get("imageKind");
  const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "true";

  if (!isAdminImageKind(imageKind)) {
    return NextResponse.json({ error: "A valid imageKind query parameter is required." }, { status: 400 });
  }

  try {
    const assets = await listImageAssets(imageKind, includeArchived);
    return NextResponse.json({ assets }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load image assets." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminUser(request);
  } catch {
    return unauthorizedResponse();
  }

  const formData = await request.formData();
  const imageKind = formData.get("imageKind");
  const file = formData.get("file");

  if (!isAdminImageKind(imageKind)) {
    return NextResponse.json({ error: "A valid imageKind is required." }, { status: 400 });
  }
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image uploads are supported." }, { status: 400 });
  }

  try {
    const payload = await uploadImageAsset(imageKind, file);
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload image." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminUser(request);
  } catch {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => ({}))) as MutationBody;

  try {
    const identity = buildIdentity(body);
    if (typeof body.archived !== "boolean") {
      return NextResponse.json({ error: "An archived boolean is required." }, { status: 400 });
    }

    const asset = await setImageAssetArchived(identity, body.archived);
    return NextResponse.json({ ok: true, asset }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update image asset." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdminUser(request);
  } catch {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => ({}))) as MutationBody;

  try {
    const identity = buildIdentity(body);
    await deleteImageAsset(identity);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete image asset." },
      { status: 400 }
    );
  }
}
