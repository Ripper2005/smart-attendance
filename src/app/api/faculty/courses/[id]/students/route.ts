/**
 * API Route: GET /api/faculty/courses/[id]/students
 * Returns the list of enrolled students for a course.
 * Auth: FACULTY JWT — must own the course.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, extractBearerToken } from "@/lib/auth";

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

    const { id: courseId } = await params;

    // Verify course belongs to faculty
    const course = await prisma.course.findFirst({
      where: { id: courseId, facultyId: payload.sub },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found or access denied." }, { status: 403 });
    }

    const enrollments = await prisma.courseEnrollment.findMany({
      where: { courseId },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            email: true,
            studentRegNumber: true,
          },
        },
      },
      orderBy: { enrolledAt: "asc" },
    });

    return NextResponse.json({
      students: enrollments.map((e) => ({
        enrollmentId: e.id,
        studentId: e.student.id,
        fullName: e.student.fullName,
        email: e.student.email,
        studentRegNumber: e.student.studentRegNumber,
        enrolledAt: e.enrolledAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[GET /api/faculty/courses/[id]/students] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
