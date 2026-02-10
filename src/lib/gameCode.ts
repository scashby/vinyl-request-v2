const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const generateGameCode = (length = 4): string => {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * ALPHABET.length);
    code += ALPHABET[index];
  }
  return code;
};
