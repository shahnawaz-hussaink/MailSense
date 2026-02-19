import CryptoJS from 'crypto-js';

const KEY = () => {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key || key.length < 32) throw new Error('TOKEN_ENCRYPTION_KEY must be at least 32 characters');
  return key;
};

/**
 * Encrypts a plaintext string using AES-256.
 * @param {string} plaintext
 * @returns {string} Base64-encoded ciphertext
 */
export function encrypt(plaintext) {
  if (!plaintext) return '';
  return CryptoJS.AES.encrypt(plaintext, KEY()).toString();
}

/**
 * Decrypts an AES-256 encrypted string.
 * @param {string} ciphertext
 * @returns {string} Decrypted plaintext
 */
export function decrypt(ciphertext) {
  if (!ciphertext) return '';
  const bytes = CryptoJS.AES.decrypt(ciphertext, KEY());
  return bytes.toString(CryptoJS.enc.Utf8);
}
