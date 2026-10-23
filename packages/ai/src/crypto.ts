const ALGO = "AES-GCM"
const KEY_BITS = 256
const IV_BYTES = 12
const SCHEMA_VERSION = 1 as const

export type EncryptedBlob = { ct: string; iv: string }
export type StoredConfig = {
  v: typeof SCHEMA_VERSION
  dek: EncryptedBlob
  cfg: EncryptedBlob
}

let masterKeyPromise: Promise<CryptoKey> | null = null

function getMasterKeyRaw(): ArrayBuffer {
  const b64 = process.env.INTEGRATIONS_MASTER_KEY
  if (!b64) {
    throw new Error(
      "INTEGRATIONS_MASTER_KEY is not set. Generate one with: openssl rand -base64 32",
    )
  }
  const bytes = Buffer.from(b64, "base64")
  if (bytes.byteLength !== KEY_BITS / 8) {
    throw new Error(
      `INTEGRATIONS_MASTER_KEY must decode to ${KEY_BITS / 8} bytes (got ${bytes.byteLength})`,
    )
  }
  const buf = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buf).set(bytes)
  return buf
}

export function getMasterKey(): Promise<CryptoKey> {
  if (!masterKeyPromise) {
    masterKeyPromise = crypto.subtle.importKey("raw", getMasterKeyRaw(), ALGO, false, [
      "encrypt",
      "decrypt",
    ])
  }
  return masterKeyPromise
}

export function resetMasterKeyCache(): void {
  masterKeyPromise = null
}

async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: ALGO, length: KEY_BITS }, true, ["encrypt", "decrypt"])
}

function toBase64(buf: ArrayBuffer): string {
  const view = new Uint8Array(buf)
  let bin = ""
  for (let i = 0; i < view.byteLength; i++) bin += String.fromCharCode(view[i]!)
  return btoa(bin)
}

function fromBase64(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const buf = new ArrayBuffer(bin.length)
  const out = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return buf
}

function randomBytes(n: number): ArrayBuffer {
  const buf = new ArrayBuffer(n)
  crypto.getRandomValues(new Uint8Array(buf))
  return buf
}

function utf8Encode(s: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(s)
  const buf = new ArrayBuffer(encoded.byteLength)
  new Uint8Array(buf).set(encoded)
  return buf
}

async function encryptWithKey(plaintext: string, key: CryptoKey): Promise<EncryptedBlob> {
  const iv = randomBytes(IV_BYTES)
  const ct = await crypto.subtle.encrypt({ name: ALGO, iv }, key, utf8Encode(plaintext))
  return { ct: toBase64(ct), iv: toBase64(iv) }
}

async function decryptWithKey(blob: EncryptedBlob, key: CryptoKey): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    { name: ALGO, iv: fromBase64(blob.iv) },
    key,
    fromBase64(blob.ct),
  )
  return new TextDecoder().decode(pt)
}

export async function encryptJson(value: unknown): Promise<StoredConfig> {
  const dek = await generateDek()
  const masterKey = await getMasterKey()
  const plaintext = JSON.stringify(value)
  const cfg = await encryptWithKey(plaintext, dek)
  const dekRaw = await crypto.subtle.exportKey("raw", dek)
  const dekBlob = await encryptWithKey(toBase64(dekRaw), masterKey)
  return { v: SCHEMA_VERSION, dek: dekBlob, cfg }
}

export async function decryptJson<T = unknown>(stored: StoredConfig): Promise<T> {
  if (stored.v !== SCHEMA_VERSION) {
    throw new Error(
      `Unsupported integration config version: ${stored.v}. Expected ${SCHEMA_VERSION}.`,
    )
  }
  const masterKey = await getMasterKey()
  const dekB64 = await decryptWithKey(stored.dek, masterKey)
  const dek = await crypto.subtle.importKey("raw", fromBase64(dekB64), ALGO, false, [
    "encrypt",
    "decrypt",
  ])
  const json = await decryptWithKey(stored.cfg, dek)
  return JSON.parse(json) as T
}
