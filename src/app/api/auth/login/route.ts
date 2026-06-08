/**
 * API Route: POST /api/auth/login
 * Authenticates a user and issues JWT tokens.
 *
 * Security:
 * - bcrypt.compare prevents timing attacks vs plain string comparison
 * - Generic error message prevents user enumeration
 * - Returns access token (1h) + refresh token (7d)
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signAccessToken, signRefreshToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // ── Input validation ──────────────────────────────────────
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    // ── Lookup user ───────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Generic error: don't reveal whether email exists or not
    if (!user) {
      // Run a dummy bcrypt compare to prevent timing-based user enumeration
      await bcrypt.compare(password, "$2b$12$invalidhashpadding000000000000000000000000000000000000");
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    // ── Verify password ───────────────────────────────────────
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    // ── Issue JWT tokens ──────────────────────────────────────
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken({ sub: user.id, email: user.email, role: user.role }),
      signRefreshToken(user.id),
    ]);

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        studentRegNumber: user.studentRegNumber,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken,
    });

    // Set HttpOnly cookies — immune to XSS document.cookie theft
    const isProduction = process.env.NODE_ENV === "production";
    response.cookies.set("access_token", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    });
    response.cookies.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      path: "/api/auth/refresh",
      maxAge: 604800,
    });

    return response;
  } catch (error) {
    console.error("[/api/auth/login] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
