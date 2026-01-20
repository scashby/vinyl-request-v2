import { NextRequest, NextResponse } from 'next/server';

interface DiscogsImage {
  uri: string;
  height?: number;
  width?: number;
  resource_url?: string;
  type?: string;
  uri150?: string;
}

interface DiscogsArtist {
  name: string;
  anv?: string;
  join?: string;
  role?: string;
  tracks?: string;
  id?: number;
  resource_url?: string;
}

interface DiscogsTrack {
  position: string;
  title: string;
  duration: string;
  artists?: DiscogsArtist[];
  type_?: string;
}

interface DiscogsRelease {
  id: number;
  title: string;
  artists?: DiscogsArtist[];
  images?: DiscogsImage[];
  tracklist?: DiscogsTrack[];
  year?: number;
  master_id?: number;
  master_url?: string;
  genres?: string[];
  styles?: string[];
}

interface DiscogsVersion {
  id: number;
  title: string;
  format?: string;
  label?: string;
  country?: string;
  released?: string;
  catno?: string;
  resource_url?: string;
  thumb?: string;
  status?: string;
}

interface MasterVersionsResponse {
  pagination: {
    per_page: number;
    pages: number;
    page: number;
    items: number;
    urls: {
      last?: string;
      next?: string;
    }
  };
  versions: DiscogsVersion[];
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const releaseId = searchParams.get("releaseId");
    const masterId = searchParams.get("masterId");
    const checkVersions = searchParams.get("checkVersions") === "true";
    
    console.log("Proxy called with:", { releaseId, masterId, checkVersions });
    
    // Get token
    const token = process.env.NEXT_PUBLIC_DISCOGS_TOKEN || 
                  process.env.DISCOGS_TOKEN;
    
    if (!token) {
      console.log("No Discogs token found");
      return new NextResponse("Missing Discogs token", { status: 500 });
    }

    // NEW: Handle master release versions request
    if (masterId && checkVersions) {
      console.log("Fetching master release versions for masterId:", masterId);
      
      // Rate limiting
      await sleep(1000);
      
      const url = `https://api.discogs.com/masters/${masterId}/versions?per_page=100`;
      console.log("Fetching URL:", url);

      const res = await fetch(url, {
        headers: {
          "Authorization": `Discogs token=${token}`,
          "User-Agent": "DeadwaxDialogues/1.0 +https://yourwebsite.com",
        },
      });

      console.log("Discogs master versions response status:", res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.log("Discogs error response:", errorText);
        return new NextResponse(errorText, { status: res.status });
      }

      const data = (await res.json()) as MasterVersionsResponse;
      console.log("Master versions received, count:", data.versions?.length || 0);
      
      return NextResponse.json(data);
    }

    // EXISTING: Handle single release request (backward compatible)
    if (releaseId) {
      console.log("Fetching single release for releaseId:", releaseId);
      
      // Rate limiting
      await sleep(1000);
      
      const url = `https://api.discogs.com/releases/${releaseId}`;
      console.log("Fetching URL:", url);

      const res = await fetch(url, {
        headers: {
          "Authorization": `Discogs token=${token}`,
          "User-Agent": "DeadwaxDialogues/1.0 +https://yourwebsite.com",
        },
      });

      console.log("Discogs release response status:", res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.log("Discogs error response:", errorText);
        return new NextResponse(errorText, { status: res.status });
      }

      const data = (await res.json()) as DiscogsRelease;
      console.log("Release data received, has images:", !!data.images);
      console.log("Release data received, has tracklist:", !!data.tracklist);
      
      return NextResponse.json(data);
    }

    // Neither releaseId nor masterId provided
    console.log("Missing required parameters");
    return new NextResponse("Missing releaseId or masterId parameter", { status: 400 });

  } catch (err: unknown) {
    console.error("Proxy error:", err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(`Server error: ${msg}`, { status: 500 });
  }
}