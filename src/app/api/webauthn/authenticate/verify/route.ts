/**
 * API Route: POST /api/webauthn/authenticate/verify
 * Verifies the WebAuthn authentication response from the browser.
 *
 * This completes Lock 3 of the Triple-Lock system.
 * The student's device signed the server challenge with its stored private key —
 * we verify it matches the stored public key and update the counter.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { prisma } from "@/lib/db";
import { verifyToken, extractBearerToken } from "@/lib/auth";
import { getRpConfig } from "@/lib/webauthn";

export async function POST(req: NextRequest) {
  try {
    // ── 1. Authenticate ────────────────────────────────────────────────────
    const cookieToken = req.cookies.get("access_token")?.value;
    const headerToken = extractBearerToken(req.headers.get("authorization"));
    const rawToken = cookieToken ?? headerToken;
    const payload = await verifyToken(rawToken ?? "");
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const userId = payload.sub;

    // ── 2. Read challenge from cookie ──────────────────────────────────────
    const expectedChallenge = req.cookies.get("webauthn_auth_challenge")?.value;
    if (!expectedChallenge) {
      return NextResponse.json(
        { error: "Challenge expired or missing. Please restart authentication." },
        { status: 400 }
      );
    }

    // ── 3. Parse body ──────────────────────────────────────────────────────
    const body: AuthenticationResponseJSON = await req.json();

    // ── 4. Find the matching credential ────────────────────────────────────
    const authenticator = await prisma.userAuthenticator.findUnique({
      where: { credentialId: body.id },
    });

    if (!authenticator) {
      return NextResponse.json({ error: "Credential not found." }, { status: 400 });
    }
    if (authenticator.userId !== userId) {
      return NextResponse.json({ error: "Credential does not belong to this account." }, { status: 403 });
    }

    // ── 5. Verify authentication response ──────────────────────────────────
    const { origin, rpID } = getRpConfig();

    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: authenticator.credentialId,
        // Prisma Bytes → Buffer (may be SharedArrayBuffer-backed).
        // Copy to a fresh Uint8Array<ArrayBuffer> to satisfy strict type constraints.
        publicKey: new Uint8Array(Buffer.from(authenticator.publicKey)),
        counter: Number(authenticator.counter),
      },
    });

    if (!verified) {
      return NextResponse.json({ error: "Biometric authentication failed." }, { status: 400 });
    }

    // ── 6. Update counter + lastUsedAt (prevents replay attacks) ──────────
    await prisma.userAuthenticator.update({
      where: { credentialId: body.id },
      data: {
        counter: BigInt(authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    });

    // ── 7. Clear challenge cookie ──────────────────────────────────────────
    const successResponse = NextResponse.json({ verified: true }, { status: 200 });
    successResponse.cookies.set("webauthn_auth_challenge", "", {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 0,
      path: "/",
    });

    return successResponse;
  } catch (error) {
    console.error("[/api/webauthn/authenticate/verify] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
