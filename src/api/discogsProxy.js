export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing release ID' });
  }

  try {
    const discogsRes = await fetch(`https://api.discogs.com/releases/${id}`, {
      headers: {
        'User-Agent': 'VinylRequestApp/1.0',
        'Accept': 'application/json'
      }
    });

    const contentType = discogsRes.headers.get('content-type');
    if (!discogsRes.ok || !contentType.includes('application/json')) {
      const text = await discogsRes.text();
      console.error(`Discogs fetch failed [${id}]:`, text.slice(0, 200));
      return res.status(500).json({ error: 'Invalid JSON returned from Discogs' });
    }

    const data = await discogsRes.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('Discogs Proxy Error:', err);
    return res.status(500).json({ error: 'Discogs fetch failed' });
  }
}
