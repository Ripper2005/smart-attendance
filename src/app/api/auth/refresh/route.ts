/**
 * API Route: POST /api/auth/refresh
 * Uses the refresh_token HttpOnly cookie to issue a new access token.
 * This extends the user's session without requiring re-login.
 *
 * The refresh token (7-day expiry) is set as an HttpOnly cookie scoped
 * to /api/auth/refresh by the login and register routes.
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { signAccessToken } from "@/lib/auth";

// Reuse the same fail-fast pattern from lib/auth.ts
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "FATAL: JWT_SECRET environment variable is not set. " +
      "Please add it to your .env.local file."
    );
  }
  return new TextEncoder().encode(secret);
}

const JWT_SECRET = getJwtSecret();

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get("refresh_token")?.value;
    if (!refreshToken) {
      return NextResponse.json({ error: "No refresh token." }, { status: 401 });
    }

    // Verify the refresh token
    let payload: Record<string, unknown>;
    try {
      const result = await jwtVerify(refreshToken, JWT_SECRET);
      payload = result.payload as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid or expired refresh token." }, { status: 401 });
    }

    // Ensure it's a refresh token (not an access token being reused)
    if (payload.type !== "refresh" || !payload.sub) {
      return NextResponse.json({ error: "Invalid token type." }, { status: 401 });
    }

    // Look up the user (they might have been deleted since token was issued)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 401 });
    }

    // Issue a fresh access token
    const newAccessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role as "FACULTY" | "STUDENT",
    });

    // Set the new access token as an HttpOnly cookie + return in body for localStorage
    const response = NextResponse.json({
      accessToken: newAccessToken,
      user: { id: user.id, email: user.email, role: user.role },
    });

    const isProduction = process.env.NODE_ENV === "production";
    response.cookies.set("access_token", newAccessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    });

    return response;
  } catch (error) {
    console.error("[POST /api/auth/refresh] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
