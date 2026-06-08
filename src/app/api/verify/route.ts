/**
 * API Route: POST /api/verify
 * THE TRIPLE-LOCK VERIFICATION ENGINE — the heart of the system.
 *
 * Validates all three locks simultaneously for a student's attendance claim:
 *   Lock 1 — Time Token  : TOTP derived from session secret (≤5s window)
 *   Lock 2 — Location    : GPS Haversine (≤radiusMeters) OR campus IP match
 *   Lock 3 — Identity    : WebAuthn FIDO2 biometric signature verification
 *
 * All three must pass for status = PRESENT.
 * Partial failures are recorded in the audit log for investigation.
 */

import { NextRequest, NextResponse } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { prisma } from "@/lib/db";
import { verifyToken, extractBearerToken } from "@/lib/auth";
import { verifyOtpToken } from "@/lib/security/otp";
import { isWithinGeofence } from "@/lib/security/geofence";
import { getClientIp, isCampusNetwork } from "@/lib/security/ip";
import { getRpConfig } from "@/lib/webauthn";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface VerifyBody {
  sessionId: string;
  token: string;
  latitude: number | null;
  longitude: number | null;
  webAuthnResponse: AuthenticationResponseJSON;
  deviceFingerprint?: string;
}

interface UpsertLogData {
  sessionId: string;
  studentId: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "OVERRIDE";
  lock1: boolean;
  lock2GpsPassed: boolean;
  lock2WifiPassed: boolean;
  lock3: boolean;
  distanceMeters: number | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  clientIpAddress: string | null;
  deviceFingerprint?: string;
}

// ──────────────────────────────────────────────────────────────
// Helper: Upsert attendance log (one log per student per session)
// ──────────────────────────────────────────────────────────────

async function upsertAttendanceLog(data: UpsertLogData) {
  const commonFields = {
    status: data.status,
    verifiedAt: data.status === "PRESENT" ? new Date() : null,
    lock1TokenVerified: data.lock1,
    lock2GpsPassed: data.lock2GpsPassed,
    lock2WifiPassed: data.lock2WifiPassed,
    lock3BiometricVerified: data.lock3,
    // Prisma accepts number for Decimal columns
    gpsLatitude: data.gpsLatitude,
    gpsLongitude: data.gpsLongitude,
    distanceMeters: data.distanceMeters,
    clientIpAddress: data.clientIpAddress,
    deviceFingerprint: data.deviceFingerprint ?? null,
  };

  return prisma.attendanceLog.upsert({
    where: {
      sessionId_studentId: {
        sessionId: data.sessionId,
        studentId: data.studentId,
      },
    },
    create: {
      sessionId: data.sessionId,
      studentId: data.studentId,
      ...commonFields,
    },
    update: commonFields,
  });
}

// ──────────────────────────────────────────────────────────────
// Main route handler
// ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ══════════════════════════════════════════════════════════
    // STEP 1 — Auth & Input Validation
    // ══════════════════════════════════════════════════════════
    const cookieToken = req.cookies.get("access_token")?.value;
    const headerToken = extractBearerToken(req.headers.get("authorization"));
    const rawToken = cookieToken ?? headerToken;
    const payload = await verifyToken(rawToken ?? "");

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }
    if (payload.role !== "STUDENT") {
      return NextResponse.json({ error: "Access denied. Students only." }, { status: 403 });
    }

    const studentId = payload.sub;

    let body: VerifyBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { sessionId, token, latitude, longitude, webAuthnResponse, deviceFingerprint } = body;

    if (!sessionId || !token) {
      return NextResponse.json({ error: "sessionId and token are required." }, { status: 400 });
    }
    if (!webAuthnResponse || typeof webAuthnResponse !== "object") {
      return NextResponse.json({ error: "webAuthnResponse is required." }, { status: 400 });
    }

    // ══════════════════════════════════════════════════════════
    // STEP 2 — Load Session
    // ══════════════════════════════════════════════════════════
    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
      include: {
        classroom: true,
        course: {
          include: {
            enrollments: {
              where: { studentId },
            },
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }
    if (session.status !== "ACTIVE") {
      return NextResponse.json({
        success: false, status: "FAILED",
        lock1: false, lock2: false, lock3: false,
        error: "This session is not currently active.",
      }, { status: 422 });
    }

    // Auto-expire: reject if past scheduled end time
    if (session.scheduledEndAt && new Date() > new Date(session.scheduledEndAt)) {
      // Silently complete the session
      await prisma.classSession.update({
        where: { id: sessionId },
        data: { status: "COMPLETED", endedAt: new Date() },
      });
      return NextResponse.json({
        success: false, status: "FAILED",
        lock1: false, lock2: false, lock3: false,
        error: "This session has expired. The faculty session window has closed.",
      }, { status: 422 });
    }
    if (session.course.enrollments.length === 0) {
      return NextResponse.json({
        success: false, status: "FAILED",
        lock1: false, lock2: false, lock3: false,
        error: "You are not enrolled in this course. Please contact your faculty.",
      }, { status: 403 });
    }

    const clientIp = getClientIp(req.headers);

    // ══════════════════════════════════════════════════════════
    // STEP 3 — LOCK 1: Time Token Verification (TOTP)
    // ══════════════════════════════════════════════════════════
    const lock1Passed = await verifyOtpToken(session.otpSecret, token);

    if (!lock1Passed) {
      // Short-circuit — expired QR is the most common proxy attempt
      return NextResponse.json({
        success: false,
        status: "FAILED",
        lock1: false,
        lock2: false,
        lock3: false,
        error: "QR code has expired or is invalid. Please scan the current QR code displayed by your faculty.",
      }, { status: 422 });
    }

    // ══════════════════════════════════════════════════════════
    // STEP 4 — LOCK 2: Location Verification
    // ══════════════════════════════════════════════════════════
    let lock2GpsPassed  = false;
    let lock2WifiPassed = false;
    let distanceMeters: number | null = null;

    // GPS check using Haversine formula
    if (latitude != null && longitude != null) {
      const centerLat = session.dynamicLatitude ? Number(session.dynamicLatitude) : Number(session.classroom.latitude);
      const centerLon = session.dynamicLongitude ? Number(session.dynamicLongitude) : Number(session.classroom.longitude);

      const geoResult = isWithinGeofence(
        { latitude, longitude },
        {
          latitude:  centerLat,
          longitude: centerLon,
        },
        session.classroom.radiusMeters
      );
      lock2GpsPassed  = geoResult.withinFence;
      distanceMeters  = geoResult.distanceMeters;
    }

    // Wi-Fi / Campus IP check (OR logic — either is sufficient)
    lock2WifiPassed = isCampusNetwork(clientIp, session.classroom.campusPublicIp ?? null);

    const lock2Passed = lock2GpsPassed || lock2WifiPassed;

    if (!lock2Passed) {
      // Record the failed attempt for audit
      await upsertAttendanceLog({
        sessionId, studentId, status: "ABSENT",
        lock1: true,
        lock2GpsPassed, lock2WifiPassed, lock3: false,
        distanceMeters, gpsLatitude: latitude, gpsLongitude: longitude,
        clientIpAddress: clientIp, deviceFingerprint,
      });

      const radiusMsg = `${session.classroom.radiusMeters}m`;
      const distMsg   = distanceMeters != null ? `${distanceMeters.toFixed(0)}m` : "unknown";
      return NextResponse.json({
        success: false,
        status: "FAILED",
        lock1: true,
        lock2: false,
        lock3: false,
        error: `You appear to be outside the classroom geofence (${distMsg} away, max: ${radiusMsg}). Ensure GPS is enabled and you are physically present.`,
        distanceMeters,
      }, { status: 422 });
    }

    // ══════════════════════════════════════════════════════════
    // STEP 5 — LOCK 3: Biometric (WebAuthn) Verification
    // ══════════════════════════════════════════════════════════

    // Cast — we know this has an `id` field (credential ID)
    const authResp = webAuthnResponse as AuthenticationResponseJSON;

    // Find the registered credential
    const authenticator = await prisma.userAuthenticator.findUnique({
      where: { credentialId: authResp.id },
    });

    if (!authenticator || authenticator.userId !== studentId) {
      await upsertAttendanceLog({
        sessionId, studentId, status: "ABSENT",
        lock1: true, lock2GpsPassed, lock2WifiPassed, lock3: false,
        distanceMeters, gpsLatitude: latitude, gpsLongitude: longitude,
        clientIpAddress: clientIp, deviceFingerprint,
      });
      return NextResponse.json({
        success: false,
        status: "FAILED",
        lock1: true, lock2: true, lock3: false,
        error: "Biometric credential not found. Please re-register your device in the Biometric tab.",
      }, { status: 422 });
    }

    // Read the challenge that was stored when the browser called
    // /api/webauthn/authenticate/options during the scan flow
    const expectedChallenge = req.cookies.get("webauthn_auth_challenge")?.value;
    if (!expectedChallenge) {
      return NextResponse.json({
        success: false,
        status: "FAILED",
        lock1: true, lock2: true, lock3: false,
        error: "Biometric session expired. Please restart the attendance process from the beginning.",
      }, { status: 422 });
    }

    let lock3Passed = false;
    let newCounter  = 0;

    try {
      const { origin, rpID } = getRpConfig();
      const { verified, authenticationInfo } = await verifyAuthenticationResponse({
        response: authResp,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: authenticator.credentialId,
          publicKey: new Uint8Array(Buffer.from(authenticator.publicKey)),
          counter: Number(authenticator.counter),
        },
      });
      lock3Passed = verified;
      if (verified) newCounter = authenticationInfo.newCounter;
    } catch (bioErr) {
      console.error("[/api/verify] Lock 3 verification error:", bioErr);
      lock3Passed = false;
    }

    if (!lock3Passed) {
      await upsertAttendanceLog({
        sessionId, studentId, status: "ABSENT",
        lock1: true, lock2GpsPassed, lock2WifiPassed, lock3: false,
        distanceMeters, gpsLatitude: latitude, gpsLongitude: longitude,
        clientIpAddress: clientIp, deviceFingerprint,
      });
      return NextResponse.json({
        success: false,
        status: "FAILED",
        lock1: true, lock2: true, lock3: false,
        error: "Biometric verification failed. Ensure you are using the same device used to register your biometrics.",
      }, { status: 422 });
    }

    // ══════════════════════════════════════════════════════════
    // STEP 6 — All 3 Locks Passed → Record PRESENT
    // ══════════════════════════════════════════════════════════

    // Update authenticator counter (prevents replay attacks)
    await prisma.userAuthenticator.update({
      where: { credentialId: authResp.id },
      data: {
        counter: BigInt(newCounter),
        lastUsedAt: new Date(),
      },
    });

    // Record attendance as PRESENT
    await upsertAttendanceLog({
      sessionId, studentId, status: "PRESENT",
      lock1: true, lock2GpsPassed, lock2WifiPassed, lock3: true,
      distanceMeters, gpsLatitude: latitude, gpsLongitude: longitude,
      clientIpAddress: clientIp, deviceFingerprint,
    });

    console.info(
      `[ATTENDANCE] PRESENT: student=${studentId} session=${sessionId} dist=${distanceMeters?.toFixed(1)}m ip=${clientIp}`
    );

    // Build success response — clear the biometric challenge cookie
    const successResponse = NextResponse.json({
      success: true,
      status: "PRESENT",
      lock1: true,
      lock2: true,
      lock3: true,
      distanceMeters,
    }, { status: 200 });

    successResponse.cookies.set("webauthn_auth_challenge", "", {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 0,
      path: "/",
    });

    return successResponse;

  } catch (error) {
    console.error("[POST /api/verify] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
