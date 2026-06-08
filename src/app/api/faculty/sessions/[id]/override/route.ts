/**
 * API Route: POST /api/faculty/sessions/[id]/override
 * Allows faculty to manually override a student's attendance status.
 * The overrideBy field being non-null marks this as a faculty override.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, extractBearerToken } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── Auth ──────────────────────────────────────────────────
    const cookieToken = req.cookies.get("access_token")?.value;
    const headerToken = extractBearerToken(req.headers.get("authorization"));
    const rawToken = cookieToken ?? headerToken;
    const payload = await verifyToken(rawToken ?? "");
    if (!payload || payload.role !== "FACULTY") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { id: sessionId } = await params;

    // ── Verify session belongs to faculty ─────────────────────
    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
      include: { course: { select: { facultyId: true, id: true } } },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }
    if (session.course.facultyId !== payload.sub) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    // ── Parse + validate body ─────────────────────────────────
    const body = await req.json();
    const { studentId, status, reason } = body;

    if (!studentId || !status || !reason?.trim()) {
      return NextResponse.json(
        { error: "studentId, status, and reason are required." },
        { status: 400 }
      );
    }

    const allowedStatuses = ["PRESENT", "ABSENT", "EXCUSED", "LATE"];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${allowedStatuses.join(", ")}.` },
        { status: 400 }
      );
    }

    if (reason.trim().length < 3) {
      return NextResponse.json(
        { error: "Reason must be at least 3 characters." },
        { status: 400 }
      );
    }

    // ── Verify student is enrolled ────────────────────────────
    const enrollment = await prisma.courseEnrollment.findFirst({
      where: { courseId: session.course.id, studentId },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: "Student is not enrolled in this course." },
        { status: 400 }
      );
    }

    // ── Upsert attendance log with override data ──────────────
    await prisma.attendanceLog.upsert({
      where: {
        sessionId_studentId: { sessionId, studentId },
      },
      create: {
        sessionId,
        studentId,
        status,
        overrideBy: payload.sub,
        overrideReason: reason.trim(),
        overriddenAt: new Date(),
        verifiedAt: new Date(),
        lock1TokenVerified: false,
        lock2GpsPassed: false,
        lock2WifiPassed: false,
        lock3BiometricVerified: false,
      },
      update: {
        status,
        overrideBy: payload.sub,
        overrideReason: reason.trim(),
        overriddenAt: new Date(),
        verifiedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, message: "Override applied successfully." });
  } catch (error) {
    console.error("[POST /api/faculty/sessions/[id]/override] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
