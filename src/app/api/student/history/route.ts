/**
 * API Route: GET /api/student/history
 * Returns all attendance records for the authenticated student.
 * Includes session/course info and all Triple-Lock results.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, extractBearerToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    // ── Auth — STUDENT only ───────────────────────────────────────────────
    const cookieToken = req.cookies.get("access_token")?.value;
    const headerToken = extractBearerToken(req.headers.get("authorization"));
    const rawToken = cookieToken ?? headerToken;
    const payload = await verifyToken(rawToken ?? "");
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (payload.role !== "STUDENT") {
      return NextResponse.json({ error: "Access denied. Students only." }, { status: 403 });
    }

    const studentId = payload.sub;

    // ── Fetch all attendance logs for this student ─────────────────────────
    const logs = await prisma.attendanceLog.findMany({
      where: { studentId },
      include: {
        session: {
          include: {
            course: { select: { courseCode: true, courseName: true } },
            classroom: { select: { name: true } },
          },
        },
      },
      orderBy: { verifiedAt: "desc" },
    });

    // ── Build summary ─────────────────────────────────────────────────────
    const total   = logs.length;
    const present = logs.filter((l) => l.status === "PRESENT").length;
    const absent  = logs.filter((l) => l.status === "ABSENT").length;
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

    return NextResponse.json({
      history: logs.map((l) => ({
        id: l.id,
        sessionId: l.sessionId,
        courseName: l.session.course.courseName,
        courseCode: l.session.course.courseCode,
        classroomName: l.session.classroom.name,
        status: l.status,
        verifiedAt: l.verifiedAt?.toISOString() ?? null,
        lock1TokenVerified: l.lock1TokenVerified,
        lock2GpsPassed: l.lock2GpsPassed,
        lock2WifiPassed: l.lock2WifiPassed,
        lock3BiometricVerified: l.lock3BiometricVerified,
        distanceMeters: l.distanceMeters != null ? Number(l.distanceMeters) : null,
        sessionDate: (l.session.startedAt ?? l.session.createdAt).toISOString(),
      })),
      summary: { total, present, absent, attendanceRate },
    });
  } catch (error) {
    console.error("[GET /api/student/history] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
