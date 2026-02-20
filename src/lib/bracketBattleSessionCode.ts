const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateBracketBattleSessionCode(length = 6): string {
  let output = "";
  for (let i = 0; i < length; i += 1) {
    output += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return output;
}
