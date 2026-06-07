import crypto from 'crypto';

// Ключ из переменной окружения TOKEN_ENCRYPTION_KEY.
// Если не задан — используется производный ключ из JWT_SECRET (fallback).
function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || 'rsu4u-default-key';
  // Приводим к 32 байтам через SHA-256
  return crypto.createHash('sha256').update(raw).digest();
}

const ALGO = 'aes-256-gcm';

export const OAuthHelper = {
  // Шифрует строку, возвращает base64(iv|authTag|ciphertext)
  encrypt(plain: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  },

  // Расшифровывает base64(iv|authTag|ciphertext)
  decrypt(payload: string): string {
    const data = Buffer.from(payload, 'base64');
    const iv = data.subarray(0, 12);
    const authTag = data.subarray(12, 28);
    const ciphertext = data.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  },
};
