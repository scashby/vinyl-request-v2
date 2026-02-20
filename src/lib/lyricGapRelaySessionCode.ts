const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateLyricGapRelaySessionCode(): string {
  let result = "";
  for (let i = 0; i < 6; i += 1) {
    result += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return result;
}
