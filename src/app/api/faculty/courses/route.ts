/**
 * API Route: GET/POST /api/faculty/courses
 * GET:  Returns all courses for the authenticated faculty with counts.
 * POST: Creates a new course for the faculty.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, extractBearerToken } from "@/lib/auth";

// ── Auth helper ────────────────────────────────────────────
async function authenticate(req: NextRequest) {
  const cookieToken = req.cookies.get("access_token")?.value;
  const headerToken = extractBearerToken(req.headers.get("authorization"));
  const rawToken = cookieToken ?? headerToken;
  const payload = await verifyToken(rawToken ?? "");
  if (!payload || payload.role !== "FACULTY") return null;
  return payload;
}

// ── GET: List all courses ──────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const payload = await authenticate(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const courses = await prisma.course.findMany({
      where: { facultyId: payload.sub },
      include: {
        _count: {
          select: {
            enrollments: true,
            sessions: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      courses: courses.map((c) => ({
        id: c.id,
        courseCode: c.courseCode,
        courseName: c.courseName,
        semester: c.semester,
        enrollmentCount: c._count.enrollments,
        sessionCount: c._count.sessions,
      })),
    });
  } catch (error) {
    console.error("[GET /api/faculty/courses] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// ── POST: Create a course ──────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const payload = await authenticate(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const body = await req.json();
    const { courseCode, courseName, semester } = body;

    if (!courseCode?.trim() || !courseName?.trim()) {
      return NextResponse.json({ error: "courseCode and courseName are required." }, { status: 400 });
    }

    // Check unique courseCode
    const existing = await prisma.course.findUnique({ where: { courseCode: courseCode.trim() } });
    if (existing) {
      return NextResponse.json({ error: `Course code "${courseCode}" is already in use.` }, { status: 409 });
    }

    const course = await prisma.course.create({
      data: {
        courseCode: courseCode.trim().toUpperCase(),
        courseName: courseName.trim(),
        semester: semester?.trim() || null,
        facultyId: payload.sub,
      },
    });

    return NextResponse.json({ course: { id: course.id, courseCode: course.courseCode, courseName: course.courseName, semester: course.semester } }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/faculty/courses] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
