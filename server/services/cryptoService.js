import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey() {
  const secret = process.env.ENCRYPTION_SECRET || process.env.JWT_SECRET || "bookdoctor_emergency_secret_key_32_bytes!";
  return crypto.createHash("sha256").update(String(secret)).digest();
}

export function encryptText(plainText) {
  if (!plainText) return "";
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine iv + tag + encrypted ciphertext as base64
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptText(cipherText) {
  if (!cipherText) return "";
  try {
    const raw = Buffer.from(cipherText, "base64");
    if (raw.length < IV_LENGTH + TAG_LENGTH) return "";
    const iv = raw.subarray(0, IV_LENGTH);
    const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = raw.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted, undefined, "utf8") + decipher.final("utf8");
  } catch (err) {
    console.error("Decryption error:", err.message);
    return "";
  }
}
