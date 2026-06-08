/**
 * lib/webauthn.ts
 * Server-side WebAuthn (FIDO2) helper library using @simplewebauthn/server v13.
 * Used for biometric registration (Phase 1) and authentication during verification (Phase 4).
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type VerifiedRegistrationResponse,
} from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";

// ─────────────────────────────────────────────────────────────
// RP (Relying Party) Configuration
// ─────────────────────────────────────────────────────────────

export interface RpConfig {
  rpID: string;
  rpName: string;
  origin: string;
}

/**
 * Returns the WebAuthn Relying Party configuration from environment variables.
 * Throws a descriptive error if any required variable is missing.
 */
export function getRpConfig(): RpConfig {
  const rpID   = process.env.WEBAUTHN_RPID;
  const rpName = process.env.WEBAUTHN_RP_NAME;
  const origin = process.env.WEBAUTHN_ORIGIN;

  if (!rpID)   throw new Error("Missing env var: WEBAUTHN_RPID");
  if (!rpName) throw new Error("Missing env var: WEBAUTHN_RP_NAME");
  if (!origin) throw new Error("Missing env var: WEBAUTHN_ORIGIN");

  return { rpID, rpName, origin };
}

// ─────────────────────────────────────────────────────────────
// Registration Options
// ─────────────────────────────────────────────────────────────

interface UserInfo {
  id: string;
  email: string;
  fullName: string;
}

interface ExistingCredential {
  credentialId: string;
}

/**
 * Generates WebAuthn registration options to send to the browser.
 * The browser's startRegistration() call requires these options.
 *
 * @param user               - The authenticated user (id, email, fullName)
 * @param existingCredentials - Already registered credentials to exclude (prevents duplicates)
 */
export async function buildRegistrationOptions(
  user: UserInfo,
  existingCredentials: ExistingCredential[]
) {
  const { rpID, rpName } = getRpConfig();

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    // userID must be a Uint8Array — encode the UUID as UTF-8 bytes
    userID: new TextEncoder().encode(user.id),
    userName: user.email,
    userDisplayName: user.fullName,
    // 'none' attestation: we don't need manufacturer certificates
    attestationType: "none",
    authenticatorSelection: {
      // Prefer passkey-style (discoverable) credentials
      residentKey: "preferred",
      // REQUIRED: force biometric/PIN verification for Lock 3
      userVerification: "required",
    },
    // Prevent re-registering an already-registered credential on the same device
    excludeCredentials: existingCredentials.map((c) => ({
      id: c.credentialId,
      type: "public-key" as const,
    })),
  });

  return options;
}

// ─────────────────────────────────────────────────────────────
// Registration Verification
// ─────────────────────────────────────────────────────────────

/**
 * Verifies the registration response sent back from the browser after
 * the user completes the biometric prompt.
 *
 * @param response          - The RegistrationResponseJSON from the browser
 * @param expectedChallenge - The challenge we stored server-side before sending options
 * @returns VerifiedRegistrationResponse with { verified, registrationInfo }
 */
export async function verifyRegistration(
  response: RegistrationResponseJSON,
  expectedChallenge: string
): Promise<VerifiedRegistrationResponse> {
  const { origin, rpID } = getRpConfig();

  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });

  return result;
}
