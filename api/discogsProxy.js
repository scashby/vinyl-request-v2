export default async function handler(req, res) {
  const { releaseId } = req.query;
  const token = process.env.VITE_DISCOGS_TOKEN; // <-- USE ENV VAR

  if (!releaseId) {
    res.status(400).json({ error: 'Missing releaseId' });
    return;
  }

  if (!token) {
    res.status(500).json({ error: 'Discogs token missing from environment' });
    return;
  }

  const url = `https://api.discogs.com/releases/${releaseId}?token=${token}`;

  try {
    const apiRes = await fetch(url);
    if (!apiRes.ok) {
      res.status(apiRes.status).json({ error: 'Discogs API error' });
      return;
    }
    const data = await apiRes.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
