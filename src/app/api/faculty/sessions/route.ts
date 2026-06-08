/**
 * API Route: GET/POST /api/faculty/sessions
 * GET:  Returns all sessions for faculty's courses (optionally filtered by courseId).
 * POST: Creates a new SCHEDULED session with a fresh OTP secret.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, extractBearerToken } from "@/lib/auth";
import { generateSessionSecret } from "@/lib/security/otp";

async function authenticate(req: NextRequest) {
  const cookieToken = req.cookies.get("access_token")?.value;
  const headerToken = extractBearerToken(req.headers.get("authorization"));
  const rawToken = cookieToken ?? headerToken;
  const payload = await verifyToken(rawToken ?? "");
  if (!payload || payload.role !== "FACULTY") return null;
  return payload;
}

// ── GET ────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const payload = await authenticate(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const courseIdFilter = searchParams.get("courseId");

    // Get all courseIds belonging to this faculty
    const courses = await prisma.course.findMany({
      where: { facultyId: payload.sub },
      select: { id: true },
    });
    const facultyCourseIds = courses.map((c) => c.id);

    const sessions = await prisma.classSession.findMany({
      where: {
        courseId: courseIdFilter
          ? (facultyCourseIds.includes(courseIdFilter) ? courseIdFilter : "__none__")
          : { in: facultyCourseIds },
      },
      include: {
        course: { select: { courseCode: true, courseName: true } },
        classroom: { select: { name: true, building: true } },
        _count: {
          select: { attendance: { where: { status: "PRESENT" } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        courseId: s.courseId,
        courseCode: s.course.courseCode,
        courseName: s.course.courseName,
        classroomName: s.classroom.name,
        classroomBuilding: s.classroom.building,
        status: s.status,
        startedAt: s.startedAt?.toISOString() ?? null,
        endedAt: s.endedAt?.toISOString() ?? null,
        presentCount: s._count.attendance,
      })),
    });
  } catch (error) {
    console.error("[GET /api/faculty/sessions] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// ── POST ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const payload = await authenticate(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const body = await req.json();
    const { courseId, classroomId, durationMinutes } = body;

    if (!courseId || !classroomId) {
      return NextResponse.json({ error: "courseId and classroomId are required." }, { status: 400 });
    }

    // Validate course belongs to faculty
    const course = await prisma.course.findFirst({ where: { id: courseId, facultyId: payload.sub } });
    if (!course) return NextResponse.json({ error: "Course not found or access denied." }, { status: 403 });

    // Validate classroom exists
    const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
    if (!classroom) return NextResponse.json({ error: "Classroom not found." }, { status: 404 });

    // Generate a fresh per-session TOTP secret — NEVER returned to client
    const otpSecret = await generateSessionSecret();

    const session = await prisma.classSession.create({
      data: {
        courseId,
        classroomId,
        otpSecret,
        status: "SCHEDULED",
        scheduledEndAt: new Date(Date.now() + (durationMinutes ?? 90) * 60 * 1000),
      },
    });

    return NextResponse.json({
      session: {
        id: session.id,
        courseId: session.courseId,
        classroomId: session.classroomId,
        status: session.status,
        createdAt: session.createdAt.toISOString(),
        // otpSecret is deliberately NOT included in response
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/faculty/sessions] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
