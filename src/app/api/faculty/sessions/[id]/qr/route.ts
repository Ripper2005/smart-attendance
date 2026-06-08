/**
 * API Route: GET /api/faculty/sessions/[id]/qr
 * Generates a fresh QR code PNG for an active session.
 *
 * Security:
 * - Only works when session is ACTIVE (403 otherwise)
 * - Cache-Control: no-store prevents browser caching of old QR codes
 * - The QR payload uses TOTP that changes every 5 seconds
 * - X-Token-TTL header tells client exactly how long until next rotation
 */

import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { verifyToken, extractBearerToken } from "@/lib/auth";
import { generateQRPayload, getTokenTTL } from "@/lib/security/otp";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieToken = req.cookies.get("access_token")?.value;
    const headerToken = extractBearerToken(req.headers.get("authorization"));
    const rawToken = cookieToken ?? headerToken;
    const payload = await verifyToken(rawToken ?? "");
    if (!payload || payload.role !== "FACULTY") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { id } = await params;

    // Fetch session — include otpSecret (server-only, never forwarded)
    const session = await prisma.classSession.findUnique({
      where: { id },
      include: { course: { select: { facultyId: true } } },
    });

    if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
    if (session.course.facultyId !== payload.sub) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }
    if (session.status !== "ACTIVE") {
      return NextResponse.json({ error: "Session is not active." }, { status: 403 });
    }

    // Generate QR payload with current TOTP token
    const qrPayload = await generateQRPayload(session.id, session.otpSecret);

    // Render QR code as PNG buffer
    const buffer = await QRCode.toBuffer(qrPayload, {
      errorCorrectionLevel: "H",
      width: 400,
      margin: 2,
      color: {
        dark: "#0A0A0F",
        light: "#FFFFFF",
      },
    });

    const ttl = getTokenTTL();

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        "X-Token-TTL": String(ttl),
      },
    });
  } catch (error) {
    console.error("[GET /api/faculty/sessions/[id]/qr] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
