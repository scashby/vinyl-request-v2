export default async function handler(req, res) {
  const { releaseId } = req.query;

  if (!releaseId) {
    return res.status(400).json({ error: 'Missing releaseId' });
  }

  try {
    const discogsRes = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
      headers: {
        'User-Agent': 'DeadWaxDialogues/1.0',
        Authorization: `Discogs token=KVVAFUlIzOPCUFNhtVXZJenwBHhGmFrmkwYgzQXD`,
      },
    });

    if (!discogsRes.ok) {
      return res.status(discogsRes.status).json({ error: 'Discogs fetch failed' });
    }

    const data = await discogsRes.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
