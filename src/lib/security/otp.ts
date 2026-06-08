/**
 * lib/security/otp.ts
 * TOTP-based dynamic QR token generation and verification.
 * Used for Lock 1 (Time) of the Triple-Lock system.
 *
 * Uses the top-level functional API of otplib which is pre-configured
 * with crypto/base32 plugins and works out of the box.
 *
 * How it works:
 * - When a session starts, a unique OTP secret is generated per session.
 * - The QR payload contains: { sessionId, token }
 * - The token is a 6-digit TOTP that changes every 5 seconds.
 * - The backend verifies using the stored session secret, ±1 window tolerance.
 */

import { generate, verify, generateSecret } from "otplib";

// QR code refreshes every 5 seconds — TOTP period is 5 seconds
const TOKEN_PERIOD_SECONDS = 5;

// Allow ±1 window for network/scan latency (~5 seconds tolerance each side)
const TOKEN_WINDOW = 1;

/**
 * Generates a cryptographically random TOTP secret for a new session.
 * This is stored server-side and NEVER sent to the client.
 */
export async function generateSessionSecret(): Promise<string> {
  return generateSecret();
}

/**
 * Generates the current TOTP token for a given session secret.
 * Called by the faculty QR display — this is embedded in the QR code payload.
 */
export async function generateCurrentToken(secret: string): Promise<string> {
  return generate({ secret, period: TOKEN_PERIOD_SECONDS });
}

/**
 * Verifies a student-submitted token against the session secret.
 * Allows ±TOKEN_WINDOW time steps for latency tolerance.
 *
 * @param secret - The session's stored OTP secret (never exposed to client)
 * @param token  - The 6-digit token extracted from the student's scanned QR
 * @returns true if the token is valid and within the acceptable time window
 */
export async function verifyOtpToken(secret: string, token: string): Promise<boolean> {
  const result = await verify({
    token,
    secret,
    period: TOKEN_PERIOD_SECONDS,
    // epochTolerance in seconds — equals one token period on each side
    epochTolerance: TOKEN_PERIOD_SECONDS * TOKEN_WINDOW,
  });
  return result.valid;
}

/**
 * Returns the number of seconds until the current token expires.
 * Useful for showing a countdown timer on the faculty dashboard QR display.
 */
export function getTokenTTL(): number {
  const now = Math.floor(Date.now() / 1000);
  const remaining = TOKEN_PERIOD_SECONDS - (now % TOKEN_PERIOD_SECONDS);
  return remaining;
}

/**
 * Generates a serialized QR payload to be encoded into the QR image.
 *
 * SECURITY: The QR contains ONLY sessionId + token.
 * Location (GPS) and identity (biometrics) are verified separately client-side
 * and submitted together with the QR scan to the /api/verify endpoint.
 */
export async function generateQRPayload(sessionId: string, secret: string): Promise<string> {
  const token = await generateCurrentToken(secret);
  return JSON.stringify({
    sessionId,
    token,
    ts: Date.now(), // Included only for debugging; never trusted server-side
  });
}
