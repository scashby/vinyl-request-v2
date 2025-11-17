// API route: /api/discogsProxy
// Supports:
// - ?releaseId=xxxx - fetch single release (existing functionality)
// - ?masterId=xxxx&checkVersions=true - fetch all versions of a master release (new)

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(req) {
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
      return new Response("Missing Discogs token", { status: 500 });
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
        return new Response(errorText, { status: res.status });
      }

      const data = await res.json();
      console.log("Master versions received, count:", data.versions?.length || 0);
      
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
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
        return new Response(errorText, { status: res.status });
      }

      const data = await res.json();
      console.log("Release data received, has images:", !!data.images);
      console.log("Release data received, has tracklist:", !!data.tracklist);
      
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Neither releaseId nor masterId provided
    console.log("Missing required parameters");
    return new Response("Missing releaseId or masterId parameter", { status: 400 });

  } catch (err) {
    console.error("Proxy error:", err);
    return new Response(`Server error: ${err.message}`, { status: 500 });
  }
}