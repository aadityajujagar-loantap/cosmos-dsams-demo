/**
 * End-to-end Application-Layer Payload Cryptography (AES-256-GCM)
 *
 * Uses native Web Crypto API (supported in all modern browsers and Node 16+).
 * Automatically encrypts outgoing JSON payloads and decrypts incoming responses.
 */

const DEFAULT_KEY_HEX = "0dfbcc16b1d7dbd24a23dd998575c574ecef75ca3481cee1b2c98fd7dde9dce4";

function getKeyHex(): string {
  return (
    process.env.NEXT_PUBLIC_API_ENCRYPTION_KEY ||
    DEFAULT_KEY_HEX
  );
}

export function isEncryptionEnabled(): boolean {
  const envVal = process.env.NEXT_PUBLIC_API_PAYLOAD_ENCRYPTION;
  if (envVal === "false" || envVal === "0") return false;
  return true;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getCryptoKey(): Promise<CryptoKey> {
  const keyBytes = hexToBytes(getKeyHex());
  return await crypto.subtle.importKey(
    "raw",
    keyBytes as unknown as BufferSource,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export interface EncryptedPayloadEnvelope {
  _enc?: boolean;
  payload: string;
  iv: string;
  tag: string;
}

/**
 * Encrypt a JSON-serializable object into an AES-256-GCM envelope.
 */
export async function encryptPayload(data: unknown): Promise<EncryptedPayloadEnvelope> {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const textEncoder = new TextEncoder();
  const plaintextBytes = textEncoder.encode(JSON.stringify(data));

  // In Web Crypto API, tagLength defaults to 128 bits (16 bytes) and is appended to ciphertext
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as unknown as BufferSource,
      tagLength: 128,
    },
    key,
    plaintextBytes as unknown as BufferSource
  );

  const encryptedBytes = new Uint8Array(encryptedBuffer);
  // Separate ciphertext and 16-byte authentication tag
  const tagBytes = encryptedBytes.slice(encryptedBytes.length - 16);
  const cipherBytes = encryptedBytes.slice(0, encryptedBytes.length - 16);

  return {
    payload: bytesToBase64(cipherBytes),
    iv: bytesToBase64(iv),
    tag: bytesToBase64(tagBytes),
  };
}

/**
 * Decrypt an AES-256-GCM envelope back into original JSON data.
 */
export async function decryptPayload<T = unknown>(envelope: {
  payload: string;
  iv: string;
  tag: string;
}): Promise<T> {
  const key = await getCryptoKey();
  const iv = base64ToBytes(envelope.iv);
  const cipherBytes = base64ToBytes(envelope.payload);
  const tagBytes = base64ToBytes(envelope.tag);

  // Web Crypto API expects ciphertext + tag concatenated
  const combinedBytes = new Uint8Array(cipherBytes.length + tagBytes.length);
  combinedBytes.set(cipherBytes, 0);
  combinedBytes.set(tagBytes, cipherBytes.length);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv as unknown as BufferSource,
      tagLength: 128,
    },
    key,
    combinedBytes as unknown as BufferSource
  );

  const textDecoder = new TextDecoder();
  const jsonStr = textDecoder.decode(decryptedBuffer);
  return JSON.parse(jsonStr) as T;
}
