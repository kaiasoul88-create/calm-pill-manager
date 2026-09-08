// Web Push (RFC 8291 / aes128gcm + VAPID) implemented with Web Crypto so it
// runs in the edge worker runtime. Server-only.

const encoder = new TextEncoder();

function bytesToB64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, data as unknown as ArrayBuffer));
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const prk = await hmac(salt, ikm);
  const okm = await hmac(prk, concat(info, new Uint8Array([1])));
  return okm.slice(0, length);
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

function vapidConfig() {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateJwk = process.env["VAPID_PRIVATE_JWK"];
  const subject = process.env["VAPID_SUBJECT"] ?? "mailto:avisos@pastillero.app";
  if (!publicKey || !privateJwk) return null;
  return { publicKey, privateJwk, subject };
}

export function hasPushConfig(): boolean {
  return vapidConfig() !== null;
}

async function vapidAuthorization(endpoint: string): Promise<string> {
  const config = vapidConfig();
  if (!config) throw new Error("Faltan las claves de avisos.");
  const audience = new URL(endpoint).origin;
  const jwk = JSON.parse(config.privateJwk) as JsonWebKey;
  const key = await crypto.subtle.importKey(
    "jwk",
    { ...jwk, key_ops: ["sign"], ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = bytesToB64Url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64Url(
    encoder.encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: config.subject,
      }),
    ),
  );
  const unsigned = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(unsigned),
  );
  return `vapid t=${unsigned}.${bytesToB64Url(signature)}, k=${config.publicKey}`;
}

export async function encryptPayload(target: PushTarget, payload: string) {
  const uaPublicBytes = b64UrlToBytes(target.p256dh);
  const authSecret = b64UrlToBytes(target.auth);

  const localKeys = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const asPublicBytes = new Uint8Array(await crypto.subtle.exportKey("raw", localKeys.publicKey));
  const uaPublicKey = await crypto.subtle.importKey(
    "raw",
    uaPublicBytes as unknown as ArrayBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaPublicKey }, localKeys.privateKey, 256),
  );

  const keyInfo = concat(
    encoder.encode("WebPush: info\0"),
    uaPublicBytes,
    asPublicBytes,
  );
  const ikm = await hkdf(authSecret, sharedSecret, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cekBytes = await hkdf(salt, ikm, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode("Content-Encoding: nonce\0"), 12);

  const cek = await crypto.subtle.importKey(
    "raw",
    cekBytes as unknown as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const plaintext = concat(encoder.encode(payload), new Uint8Array([2]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as unknown as ArrayBuffer },
      cek,
      plaintext as unknown as ArrayBuffer,
    ),
  );

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  const header = concat(
    salt,
    recordSize,
    new Uint8Array([asPublicBytes.length]),
    asPublicBytes,
  );
  return concat(header, ciphertext);
}

export type PushSendResult = { ok: boolean; status: number; gone: boolean; error?: string };

export async function sendWebPush(
  target: PushTarget,
  payload: Record<string, unknown>,
  ttlSeconds = 3600,
): Promise<PushSendResult> {
  try {
    const body = await encryptPayload(target, JSON.stringify(payload));
    const authorization = await vapidAuthorization(target.endpoint);
    const response = await fetch(target.endpoint, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(ttlSeconds),
        Urgency: "high",
      },
      body: body as unknown as BodyInit,
    });
    if (response.ok) return { ok: true, status: response.status, gone: false };
    const text = await response.text().catch(() => "");
    return {
      ok: false,
      status: response.status,
      gone: response.status === 404 || response.status === 410,
      error: text.slice(0, 300),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      gone: false,
      error: error instanceof Error ? error.message : "error desconocido",
    };
  }
}
