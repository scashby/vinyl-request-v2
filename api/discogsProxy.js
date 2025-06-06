export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const releaseId = url.searchParams.get('releaseId');

  if (!releaseId) {
    return res.status(400).json({ error: 'Missing releaseId' });
  }

  try {
    const response = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
      headers: { 'User-Agent': 'vinyl-request-v2/1.0' },
    });

    if (!response || !response.ok) {
      const status = response?.status || 500;
      return res.status(status).json({ error: 'Discogs API error' });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Fetch failed', details: err.message });
  }
}
