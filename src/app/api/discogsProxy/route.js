// API route: /api/discogsProxy?releaseId=xxxx
// Proxies requests to Discogs API using server-side token.
// Ensures valid headers and avoids frontend rate limiting.

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const releaseId = searchParams.get("releaseId");
  if (!releaseId) {
    return new Response("Missing releaseId parameter", { status: 400 });
  }

  const token = process.env.DISCOGS_TOKEN;
  if (!token) {
    return new Response("Missing Discogs token", { status: 500 });
  }

  const url = `https://api.discogs.com/releases/${releaseId}`;

  try {
    const res = await fetch(url, {
      headers: {
        "Authorization": `Discogs token=${token}`,
        "User-Agent": "DeadWaxDialogues/1.0 +https://deadwaxdialogues.com",
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      return new Response(errorText, { status: res.status });
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Proxy error:", err);
    return new Response("Server error", { status: 500 });
  }
}
