export default async function handler(req, res) {
  const { releaseId } = req.query;

  if (!releaseId) {
    return res.status(400).json({ error: 'Missing releaseId' });
  }

  try {
    const discogsRes = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
      headers: {
        'User-Agent': 'VinylRequestApp/1.0',
        Accept: 'application/json'
      }
    });

    const contentType = discogsRes.headers.get('content-type') || '';
    if (!discogsRes.ok || !contentType.includes('application/json')) {
      const text = await discogsRes.text();
      return res.status(502).json({ error: 'Non-JSON response', preview: text.slice(0, 200) });
    }

    const data = await discogsRes.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Discogs fetch failed', detail: err.message });
  }
}
