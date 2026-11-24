// =============================================================================
// CRIPTOGRAFIA DE IDENTIDADE DO BACKEND LOCAL — WORKFORCE ERP v9.0
// Implementa usando exclusivamente `node:crypto`:
//   1. Hashing de senhas com `scrypt` (N=16384, r=8, p=1, salt 16B, chave 64B)
//      e comparação em tempo constante (`timingSafeEqual`).
//   2. Assinatura e validação de JWT `HS256` (HMAC-SHA256) com expiração (`exp`).
//   3. Segundo fator TOTP padrão RFC 6238 / RFC 4226 (Base32 + HMAC-SHA1, 6 dígitos,
//      janela de 30s) compatível com Google Authenticator, Microsoft Authenticator e 1Password.
// =============================================================================

import crypto from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// -----------------------------------------------------------------------------
// 1. SENHAS (scrypt + salt aleatório; zero texto puro)
// -----------------------------------------------------------------------------
export function hashPasswordScrypt(plainPassword) {
  const pwd = String(plainPassword || "");
  if (!pwd) throw new Error("Senha vazia não permitida.");
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(pwd, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export function verifyPasswordScrypt(plainPassword, storedHash) {
  if (!plainPassword || !storedHash || !String(storedHash).startsWith("scrypt$")) {
    return false;
  }
  const parts = String(storedHash).split("$");
  if (parts.length !== 3) return false;
  const [, salt, expectedHex] = parts;
  try {
    const expectedBuf = Buffer.from(expectedHex, "hex");
    const actualBuf = crypto.scryptSync(String(plainPassword), salt, expectedBuf.length, {
      N: 16384,
      r: 8,
      p: 1,
    });
    if (actualBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// 2. TOKENS DE USO ÚNICO (convites e recuperação — apenas SHA-256 armazenado)
// -----------------------------------------------------------------------------
export function generateOneTimeToken() {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashOneTimeToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashOneTimeToken(rawToken) {
  return crypto.createHash("sha256").update(String(rawToken || ""), "utf8").digest("hex");
}

// -----------------------------------------------------------------------------
// 3. JWT HMAC-SHA256 (HS256)
// -----------------------------------------------------------------------------
export function signJwtHs256(payload, secret, expiresInSeconds = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    iat: now,
    exp: now + expiresInSeconds,
    ...payload,
  };
  const headerB64 = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const bodyB64 = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signingInput = `${headerB64}.${bodyB64}`;
  const sigB64 = crypto.createHmac("sha256", secret).update(signingInput).digest("base64url");
  return `${signingInput}.${sigB64}`;
}

export function verifyJwtHs256(token, secret) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, bodyB64, sigB64] = parts;
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(`${headerB64}.${bodyB64}`)
    .digest();

  let providedSig;
  try {
    providedSig = Buffer.from(sigB64, "base64url");
  } catch {
    return null;
  }
  if (providedSig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(providedSig, expectedSig)) return null;

  try {
    const payload = JSON.parse(Buffer.from(bodyB64, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp < now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// 4. TOTP RFC 6238 (Base32 + HMAC-SHA1)
// -----------------------------------------------------------------------------
export function encodeBase32(buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function decodeBase32(base32Str) {
  const clean = String(base32Str || "")
    .toUpperCase()
    .replace(/=+$/g, "")
    .replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("Segredo Base32 inválido.");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret() {
  return encodeBase32(crypto.randomBytes(20));
}

export function buildOtpAuthUri({ secret, email, issuer = "UniaoWorkforceERP" }) {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const iss = encodeURIComponent(issuer);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${iss}&algorithm=SHA1&digits=6&period=30`;
}

export function computeTotpAtStep(secretBase32, counterStep) {
  const key = decodeBase32(secretBase32);
  const buf = Buffer.alloc(8);
  let tmp = BigInt(counterStep);
  for (let i = 7; i >= 0; i--) {
    buf[i] = Number(tmp & 0xffn);
    tmp >>= 8n;
  }
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binCode % 1_000_000).padStart(6, "0");
}

export function generateCurrentTotpCode(secretBase32, nowMs = Date.now()) {
  const step = Math.floor(nowMs / 1000 / 30);
  return computeTotpAtStep(secretBase32, step);
}

export function verifyTotpCode(secretBase32, candidateCode, nowMs = Date.now(), windowSteps = 1) {
  const clean = String(candidateCode || "").replace(/\D/g, "");
  if (clean.length !== 6) return false;
  const currentStep = Math.floor(nowMs / 1000 / 30);
  for (let offset = -windowSteps; offset <= windowSteps; offset++) {
    const expected = computeTotpAtStep(secretBase32, currentStep + offset);
    if (
      crypto.timingSafeEqual(Buffer.from(clean, "utf8"), Buffer.from(expected, "utf8"))
    ) {
      return true;
    }
  }
  return false;
}
