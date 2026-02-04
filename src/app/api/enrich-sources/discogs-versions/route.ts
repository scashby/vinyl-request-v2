import { NextResponse } from "next/server";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";

const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN ?? process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
const USER_AGENT = process.env.APP_USER_AGENT || 'DeadwaxDialogues/1.0 (https://deadwaxdialogues.com)';

type DiscogsVersionsResponse = {
  versions?: Array<{
    id: number;
    title?: string;
    catno?: string;
    country?: string;
    format?: string;
    year?: number;
    label?: string;
  }>;
};

async function fetchDiscogsVersions(masterId: string): Promise<DiscogsVersionsResponse> {
  const url = `https://api.discogs.com/masters/${masterId}/versions?per_page=100`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Authorization': `Discogs token=${DISCOGS_TOKEN}`
    }
  });
  if (!res.ok) throw new Error(`Discogs versions returned ${res.status}`);
  return await res.json();
}

export async function POST(req: Request) {
  const supabase = supabaseServer(getAuthHeader(req));
  try {
    const body = await req.json();
    const { albumId } = body;

    if (!albumId) {
      return NextResponse.json({ success: false, error: 'albumId required' }, { status: 400 });
    }

    if (!DISCOGS_TOKEN) {
      return NextResponse.json({ success: false, error: 'Discogs token not configured' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('inventory')
      .select('id, release:releases ( master:masters ( discogs_master_id, title ) )')
      .eq('id', albumId)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: 'Album not found' }, { status: 404 });
    }

    const release = Array.isArray(data.release) ? data.release[0] : data.release;
    const master = Array.isArray(release?.master) ? release?.master[0] : release?.master;
    const masterId = master?.discogs_master_id;

    if (!masterId) {
      return NextResponse.json({ success: false, error: 'No Discogs master ID on this album' }, { status: 400 });
    }

    const versions = await fetchDiscogsVersions(masterId);
    return NextResponse.json({
      success: true,
      data: {
        albumId,
        masterId,
        versions: versions.versions ?? []
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
