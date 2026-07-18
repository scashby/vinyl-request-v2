import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";

function getRawKey(): string {
  const key = process.env.STANDALONE_TOKEN_ENCRYPTION_KEY;
  if (!key || key.trim().length === 0) {
    throw new Error(
      "Missing STANDALONE_TOKEN_ENCRYPTION_KEY. Set this for provider token encryption."
    );
  }
  return key.trim();
}

function deriveKeyBuffer(raw: string): Buffer {
  // Accept arbitrary key text and derive a stable 32-byte key.
  return createHash("sha256").update(raw).digest();
}

export function encryptToken(plainText: string): string {
  const value = String(plainText ?? "").trim();
  if (!value) return "";

  const key = deriveKeyBuffer(getRawKey());
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptToken(cipherText: string): string {
  const value = String(cipherText ?? "").trim();
  if (!value) return "";

  const [ivB64, tagB64, payloadB64] = value.split(".");
  if (!ivB64 || !tagB64 || !payloadB64) {
    // Backward compatibility for legacy rows that stored plaintext tokens.
    return value;
  }

  const key = deriveKeyBuffer(getRawKey());
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const payload = Buffer.from(payloadB64, "base64");

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
  return decrypted.toString("utf8");
}
