export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
  const releaseId = searchParams.get('releaseId');

  if (!releaseId) {
    return res.status(400).json({ error: 'Missing releaseId' });
  }

  try {
    const response = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
      headers: {
        'User-Agent': 'vinyl-request-v2/1.0',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Discogs API error' });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Fetch failed', details: err.message });
  }
}
