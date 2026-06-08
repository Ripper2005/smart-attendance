/**
 * API Route: GET /api/faculty/dashboard
 * Returns summary stats and today's sessions for the faculty dashboard.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, extractBearerToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const cookieToken = req.cookies.get("access_token")?.value;
    const headerToken = extractBearerToken(req.headers.get("authorization"));
    const rawToken = cookieToken ?? headerToken;
    const payload = await verifyToken(rawToken ?? "");
    if (!payload || payload.role !== "FACULTY") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const facultyId = payload.sub;

    // Start/end of today (local server time)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Fetch all faculty's courses
    const courses = await prisma.course.findMany({
      where: { facultyId },
      select: { id: true },
    });
    const courseIds = courses.map((c) => c.id);

    // Total attendance records across all faculty sessions
    const totalAttendanceRecords = await prisma.attendanceLog.count({
      where: { session: { courseId: { in: courseIds } } },
    });

    // Sessions today (active or started today)
    const todaySessions = await prisma.classSession.findMany({
      where: {
        courseId: { in: courseIds },
        OR: [
          { status: "ACTIVE" },
          { startedAt: { gte: todayStart, lte: todayEnd } },
        ],
      },
      include: {
        course: { select: { courseCode: true, courseName: true } },
        classroom: { select: { name: true } },
      },
      orderBy: { startedAt: "desc" },
    });

    return NextResponse.json({
      totalCourses: courses.length,
      activeSessionsToday: todaySessions.filter((s) => s.status === "ACTIVE").length,
      totalAttendanceRecords,
      todaySessions: todaySessions.map((s) => ({
        id: s.id,
        courseCode: s.course.courseCode,
        courseName: s.course.courseName,
        classroomName: s.classroom.name,
        status: s.status,
        startedAt: s.startedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error("[/api/faculty/dashboard] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
