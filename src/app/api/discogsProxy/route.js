// API route: /api/discogsProxy?releaseId=xxxx
// FIXED: Updated environment variable priority and removed deprecated VITE_DISCOGS_TOKEN

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const releaseId = searchParams.get("releaseId");
    
    console.log("Proxy called with releaseId:", releaseId);
    
    if (!releaseId) {
      console.log("Missing releaseId parameter");
      return new Response("Missing releaseId parameter", { status: 400 });
    }

    // Check what environment variables are available
    console.log("Available DISCOGS env vars:", Object.keys(process.env).filter(k => k.includes('DISCOGS')));
    
    // FIXED: Updated priority order and removed deprecated VITE_DISCOGS_TOKEN
    // Try environment variable names in order of preference
    const token = process.env.NEXT_PUBLIC_DISCOGS_TOKEN || 
                  process.env.DISCOGS_TOKEN;
    
    console.log("Token found:", !!token);
    console.log("Token starts with:", token ? token.substring(0, 10) + "..." : "none");
    
    if (!token) {
      console.log("No Discogs token found - check NEXT_PUBLIC_DISCOGS_TOKEN or DISCOGS_TOKEN environment variables");
      return new Response("Missing Discogs token", { status: 500 });
    }

    const url = `https://api.discogs.com/releases/${releaseId}`;
    console.log("Fetching URL:", url);

    const res = await fetch(url, {
      headers: {
        "Authorization": `Discogs token=${token}`,
        "User-Agent": "DeadwaxDialogues/1.0 +https://yourwebsite.com",
      },
    });

    console.log("Discogs response status:", res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.log("Discogs error response:", errorText);
      return new Response(errorText, { status: res.status });
    }

    const data = await res.json();
    console.log("Discogs data received, has images:", !!data.images);
    console.log("Discogs data received, has tracklist:", !!data.tracklist);
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Proxy error:", err);
    return new Response(`Server error: ${err.message}`, { status: 500 });
  }
}