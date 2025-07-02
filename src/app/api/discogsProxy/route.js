// API route: /api/discogsProxy?releaseId=xxxx
// Proxies requests to Discogs API using server-side token.

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const releaseId = searchParams.get('releaseId');

  if (!releaseId) {
    return Response.json({ error: 'Missing releaseId' }, { status: 400 });
  }

  const token = process.env.VITE_DISCOGS_TOKEN;

  if (!token) {
    return Response.json({ error: 'Discogs token missing from environment' }, { status: 500 });
  }

  const url = `https://api.discogs.com/releases/${releaseId}`;
  const headers = {
    'User-Agent': 'DeadWaxDialogues/1.0 +https://deadwaxdialogues.com',
    'Authorization': `Discogs token=${token}`
  };

  try {
    const apiRes = await fetch(url, { headers });

    if (!apiRes.ok) {
      const errorText = await apiRes.text();
      console.error('Discogs API error:', errorText);
      return Response.json({ error: errorText }, { status: apiRes.status });
    }

    const data = await apiRes.json();
    return Response.json(data);
  } catch (err) {
    console.error('Discogs proxy failed:', err);
    return Response.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
