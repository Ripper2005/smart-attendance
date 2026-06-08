/**
 * API Route: POST /api/auth/register
 * Registers a new user (Faculty or Student).
 *
 * Security:
 * - Password is hashed with bcrypt (cost factor 12)
 * - Returns JWT access + refresh tokens on success
 * - Student registration requires a valid registration number
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signAccessToken, signRefreshToken } from "@/lib/auth";
import { Role } from "@prisma/client";

const BCRYPT_ROUNDS = 12;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email: rawEmail, password, fullName, role, studentRegNumber } = body;

    // Normalize email immediately — before any DB lookups
    const email = rawEmail?.toLowerCase().trim();

    // ── Input validation ──────────────────────────────────────
    if (!email || !password || !fullName || !role) {
      return NextResponse.json(
        { error: "Missing required fields: email, password, fullName, role" },
        { status: 400 }
      );
    }

    if (!["FACULTY", "STUDENT"].includes(role)) {
      return NextResponse.json({ error: "Invalid role. Must be FACULTY or STUDENT." }, { status: 400 });
    }

    if (role === "STUDENT" && !studentRegNumber) {
      return NextResponse.json(
        { error: "studentRegNumber is required for student registration." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    // ── Check for existing user ───────────────────────────────
    const existingUser = await prisma.user.findUnique({ where: { email: email } });
    if (existingUser) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    if (studentRegNumber) {
      const existingReg = await prisma.user.findUnique({ where: { studentRegNumber } });
      if (existingReg) {
        return NextResponse.json({ error: "This registration number is already in use." }, { status: 409 });
      }
    }

    // ── Hash password ─────────────────────────────────────────
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // ── Create user ───────────────────────────────────────────
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: fullName.trim(),
        role: role as Role,
        studentRegNumber: studentRegNumber?.trim() ?? null,
      },
    });

    // ── Issue JWT tokens ──────────────────────────────────────
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken({ sub: user.id, email: user.email, role: user.role }),
      signRefreshToken(user.id),
    ]);

    // Return user info (no passwordHash) + tokens
    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          studentRegNumber: user.studentRegNumber,
        },
        accessToken,
        refreshToken,
      },
      { status: 201 }
    );

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
    console.error("[/api/auth/register] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
