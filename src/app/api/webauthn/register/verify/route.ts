/**
 * API Route: POST /api/webauthn/register/verify
 * Verifies the browser's biometric registration response and saves the credential.
 *
 * Flow:
 * 1. Verify JWT → get userId
 * 2. Read expected challenge from HttpOnly cookie
 * 3. Call verifyRegistrationResponse (SimpleWebAuthn)
 * 4. Save new UserAuthenticator record to Prisma
 * 5. Clear the challenge cookie
 * 6. Return { success: true, credentialId }
 */

import { NextRequest, NextResponse } from "next/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { prisma } from "@/lib/db";
import { verifyToken, extractBearerToken } from "@/lib/auth";
import { verifyRegistration } from "@/lib/webauthn";

export async function POST(req: NextRequest) {
  try {
    // ── 1. Authenticate ───────────────────────────────────────
    const cookieToken = req.cookies.get("access_token")?.value;
    const headerToken = extractBearerToken(req.headers.get("authorization"));
    const rawToken = cookieToken ?? headerToken;

    if (!rawToken) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const payload = await verifyToken(rawToken);
    if (!payload) {
      return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });
    }

    const userId = payload.sub;

    // ── 2. Read challenge from cookie ─────────────────────────
    const expectedChallenge = req.cookies.get("webauthn_challenge")?.value;
    if (!expectedChallenge) {
      return NextResponse.json(
        { error: "Challenge expired or missing. Please restart registration." },
        { status: 400 }
      );
    }

    // ── 3. Parse body & verify registration ───────────────────
    const body: RegistrationResponseJSON = await req.json();

    const { verified, registrationInfo } = await verifyRegistration(body, expectedChallenge);

    if (!verified || !registrationInfo) {
      return NextResponse.json({ error: "Biometric registration failed." }, { status: 400 });
    }

    // ── 4. Extract credential data from registrationInfo ──────
    // In @simplewebauthn/server v13, the shape is:
    //   registrationInfo.credential = { id, publicKey, counter, transports }
    //   registrationInfo.credentialDeviceType — top-level (not in credential)
    //   registrationInfo.credentialBackedUp   — top-level (not in credential)
    const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;

    const credentialId = credential.id;                             // string (base64url)
    const publicKey    = Buffer.from(credential.publicKey);         // Uint8Array → Buffer (Prisma Bytes)
    const counter      = BigInt(credential.counter);               // number → BigInt
    const deviceType   = credentialDeviceType;                     // "singleDevice" | "multiDevice"
    const backedUp     = credentialBackedUp;                       // boolean

    // transports come from the original browser response
    const transports: string[] = (body.response.transports as string[]) ?? [];

    // ── 5. Persist to database ────────────────────────────────
    await prisma.userAuthenticator.create({
      data: {
        userId,
        credentialId,
        publicKey,
        counter,
        deviceType,
        backedUp,
        transports,
        lastUsedAt: new Date(),
      },
    });

    // ── 6. Clear the challenge cookie ─────────────────────────
    const successResponse = NextResponse.json(
      { success: true, credentialId },
      { status: 201 }
    );
    successResponse.cookies.set("webauthn_challenge", "", {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 0, // Immediately expires
      path: "/",
    });

    return successResponse;
  } catch (error) {
    console.error("[/api/webauthn/register/verify] Error:", error);

    // Check for duplicate credential (unique constraint violation)
    const errMsg = error instanceof Error ? error.message : "";
    if (errMsg.includes("Unique constraint") || errMsg.includes("P2002")) {
      return NextResponse.json(
        { error: "This device is already registered to an account." },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
