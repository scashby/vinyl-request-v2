export async function enrichWithLastFM(artist: string, track: string) {
  console.log(`[LastFM] Enriching: ${artist} - ${track}`);
  return {
    listeners: 12345,
    tags: ['rock', 'vinyl'],
    image: 'https://via.placeholder.com/300',
  };
}
