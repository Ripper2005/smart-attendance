/**
 * API Route: GET /api/webauthn/register/options
 * Generates WebAuthn registration options for the authenticated student.
 *
 * Flow:
 * 1. Verify JWT → get userId
 * 2. Fetch user + existing credentials from DB
 * 3. Build registration options via SimpleWebAuthn
 * 4. Store challenge in an HttpOnly cookie (no Redis needed)
 * 5. Return options JSON to browser (fed into startRegistration())
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, extractBearerToken } from "@/lib/auth";
import { buildRegistrationOptions } from "@/lib/webauthn";

export async function GET(req: NextRequest) {
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

    // ── 2. Fetch user + existing credentials ──────────────────
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        authenticators: {
          select: { credentialId: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // ── 3. Generate registration options ──────────────────────
    const options = await buildRegistrationOptions(user, user.authenticators);

    // ── 4. Persist challenge in HttpOnly cookie ───────────────
    // No Redis required — cookie is HttpOnly so client JS cannot tamper with it.
    // MaxAge: 300 = 5 minutes, enough time to complete the biometric prompt.
    const response = NextResponse.json(options, { status: 200 });
    response.cookies.set("webauthn_challenge", options.challenge, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 300,
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("[/api/webauthn/register/options] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
