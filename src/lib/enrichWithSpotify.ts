export async function enrichWithSpotify(artist: string, track: string) {
  console.log(`[Spotify] Enriching: ${artist} - ${track}`);
  return {
    spotifyUri: 'spotify:track:123',
    album: 'Sample Album',
    popularity: 80,
    image: 'https://via.placeholder.com/300',
  };
}
