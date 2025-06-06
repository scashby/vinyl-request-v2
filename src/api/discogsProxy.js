export async function fetchDiscogsRelease(releaseId) {
  const res = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
    headers: {
      'User-Agent': 'DeadWaxDialogues/1.0',
      Authorization: `Discogs token=KVVAFUlIzOPCUFNhtVXZJenwBHhGmFrmkwYgzQXD`, // Required if you're rate-limited
    },
  });

  if (!res.ok) {
    throw new Error(`Discogs fetch failed: ${res.status}`);
  }

  return await res.json();
}
