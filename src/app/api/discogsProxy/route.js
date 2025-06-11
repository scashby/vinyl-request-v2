// API route: /api/discogsProxy?releaseId=xxxx
// Proxies requests to Discogs API using server-side token.

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const releaseId = searchParams.get('releaseId');
  const token = process.env.DISCOGS_TOKEN; // Should be set in .env.local

  if (!releaseId) {
    return Response.json({ error: 'Missing releaseId' }, { status: 400 });
  }
  if (!token) {
    return Response.json({ error: 'Discogs token missing from environment' }, { status: 500 });
  }

  const url = `https://api.discogs.com/releases/${releaseId}?token=${token}`;
  try {
    const apiRes = await fetch(url);
    if (!apiRes.ok) {
      return Response.json({ error: 'Discogs API error' }, { status: apiRes.status });
    }
    const data = await apiRes.json();
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: 'Server error', detail: err.message }, { status: 500 });
  }
}
