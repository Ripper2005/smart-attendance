/**
 * API Route: GET /api/webauthn/authenticate/options
 * Generates WebAuthn authentication options for the student's biometric challenge.
 *
 * This is the counterpart to /api/webauthn/register/options —
 * it starts the authentication ceremony (not registration).
 * The browser uses these options to challenge the student's stored private key.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { prisma } from "@/lib/db";
import { verifyToken, extractBearerToken } from "@/lib/auth";
import { getRpConfig } from "@/lib/webauthn";

export async function GET(req: NextRequest) {
  try {
    // ── 1. Authenticate (any role — student or faculty can use biometrics) ──
    const cookieToken = req.cookies.get("access_token")?.value;
    const headerToken = extractBearerToken(req.headers.get("authorization"));
    const rawToken = cookieToken ?? headerToken;
    const payload = await verifyToken(rawToken ?? "");
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const userId = payload.sub;

    // ── 2. Fetch registered credentials for this user ──────────────────────
    const userAuthenticators = await prisma.userAuthenticator.findMany({
      where: { userId },
      select: { credentialId: true },
    });

    if (userAuthenticators.length === 0) {
      return NextResponse.json(
        { error: "No biometric devices registered. Please register a device first." },
        { status: 400 }
      );
    }

    // ── 3. Generate authentication options ─────────────────────────────────
    const { rpID } = getRpConfig();

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
      // Only accept credentials that were registered by this user
      allowCredentials: userAuthenticators.map((auth) => ({
        id: auth.credentialId,
        type: "public-key" as const,
      })),
    });

    // ── 4. Store challenge in HttpOnly cookie ──────────────────────────────
    const response = NextResponse.json(options, { status: 200 });
    response.cookies.set("webauthn_auth_challenge", options.challenge, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 300, // 5 minutes
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("[/api/webauthn/authenticate/options] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
