/**
 * API Route: GET/PATCH /api/faculty/sessions/[id]
 * GET:   Returns a single session with full attendance log (student names, lock flags).
 * PATCH: Updates session status ("start" → ACTIVE, "stop" → COMPLETED).
 *        Never returns otpSecret.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, extractBearerToken } from "@/lib/auth";

async function authenticate(req: NextRequest) {
  const cookieToken = req.cookies.get("access_token")?.value;
  const headerToken = extractBearerToken(req.headers.get("authorization"));
  const rawToken = cookieToken ?? headerToken;
  const payload = await verifyToken(rawToken ?? "");
  if (!payload || payload.role !== "FACULTY") return null;
  return payload;
}

// ── GET ────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await authenticate(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { id } = await params;

    const session = await prisma.classSession.findUnique({
      where: { id },
      include: {
        course: { select: { courseCode: true, courseName: true, facultyId: true } },
        classroom: { select: { name: true, building: true, radiusMeters: true } },
        attendance: {
          include: {
            student: { select: { fullName: true, studentRegNumber: true, email: true } },
          },
          orderBy: { verifiedAt: "desc" },
        },
      },
    });

    if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
    if (session.course.facultyId !== payload.sub) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    // Also get all enrolled students to show absent ones
    const enrollments = await prisma.courseEnrollment.findMany({
      where: { courseId: session.courseId },
      include: { student: { select: { id: true, fullName: true, studentRegNumber: true } } },
    });

    const attendanceMap = new Map(session.attendance.map((a) => [a.studentId, a]));

    const roster = enrollments.map((e) => {
      const log = attendanceMap.get(e.studentId);
      return {
        studentId: e.studentId,
        studentName: e.student.fullName,
        studentRegNumber: e.student.studentRegNumber,
        status: log?.status ?? "ABSENT",
        verifiedAt: log?.verifiedAt?.toISOString() ?? null,
        lock1TokenVerified: log?.lock1TokenVerified ?? false,
        lock2GpsPassed: log?.lock2GpsPassed ?? false,
        lock2WifiPassed: log?.lock2WifiPassed ?? false,
        lock3BiometricVerified: log?.lock3BiometricVerified ?? false,
        distanceMeters: log?.distanceMeters ? Number(log.distanceMeters) : null,
        clientIpAddress: log?.clientIpAddress ?? null,
        overrideReason: log?.overrideReason ?? null,
      };
    });

    return NextResponse.json({
      session: {
        id: session.id,
        courseCode: session.course.courseCode,
        courseName: session.course.courseName,
        classroomName: session.classroom.name,
        classroomBuilding: session.classroom.building,
        status: session.status,
        startedAt: session.startedAt?.toISOString() ?? null,
        endedAt: session.endedAt?.toISOString() ?? null,
        scheduledEndAt: session.scheduledEndAt?.toISOString() ?? null,
        dynamicLatitude: session.dynamicLatitude ? Number(session.dynamicLatitude) : null,
        dynamicLongitude: session.dynamicLongitude ? Number(session.dynamicLongitude) : null,
        // otpSecret is deliberately NOT included
      },
      roster,
      totalStudents: enrollments.length,
      presentCount: roster.filter((r) => r.status === "PRESENT").length,
    });
  } catch (error) {
    console.error("[GET /api/faculty/sessions/[id]] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// ── PATCH ──────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await authenticate(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { action, latitude, longitude } = body;

    if (!["start", "stop"].includes(action)) {
      return NextResponse.json({ error: "action must be 'start' or 'stop'." }, { status: 400 });
    }

    // Verify session belongs to faculty
    const session = await prisma.classSession.findUnique({
      where: { id },
      include: { course: { select: { facultyId: true } } },
    });

    if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
    if (session.course.facultyId !== payload.sub) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const updated = await prisma.classSession.update({
      where: { id },
      data:
        action === "start"
          ? {
              status: "ACTIVE",
              startedAt: new Date(),
              dynamicLatitude: latitude !== undefined && latitude !== null ? Number(latitude) : null,
              dynamicLongitude: longitude !== undefined && longitude !== null ? Number(longitude) : null,
            }
          : { status: "COMPLETED", endedAt: new Date() },
    });

    return NextResponse.json({
      session: {
        id: updated.id,
        status: updated.status,
        startedAt: updated.startedAt?.toISOString() ?? null,
        endedAt: updated.endedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("[PATCH /api/faculty/sessions/[id]] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
