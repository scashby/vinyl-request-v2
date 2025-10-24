// src/app/api/1001-albums/toggle-listened/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type Body = {
  collection_id: number;
  listened: boolean;
};

export async function POST(req: Request) {
  try {
    const body = await req.json() as Body;
    const { collection_id, listened } = body;

    if (!collection_id) {
      return NextResponse.json({ error: 'collection_id required' }, { status: 400 });
    }

    // Update the listened status in collection_1001_review table
    const { error } = await supabase
      .from('collection_1001_review')
      .update({ listened })
      .eq('collection_id', collection_id);

    if (error) {
      console.error('Error updating listened status:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, listened });

  } catch (error) {
    console.error('Toggle Listened Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}