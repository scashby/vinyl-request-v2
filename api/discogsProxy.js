export async function fetchDiscogsRelease(releaseId) {
  const token = process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
  const url = `https://api.discogs.com/masters/${releaseId}?token=${token}`;

  try {
    const res = await fetch(url);

    if (!res || typeof res.status !== 'number') {
      throw new Error(`Discogs fetch failed: No response or invalid status`);
    }

    if (res.status !== 200) {
      throw new Error(`Discogs fetch failed: ${res.status}`);
    }

    const data = await res.json();

    if (!data || typeof data !== 'object') {
      throw new Error('Discogs fetch returned empty or invalid data');
    }

    return data;
  } catch (err) {
    console.error('Discogs proxy error:', err);
    return null;
  }
}
