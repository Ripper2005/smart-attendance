/**
 * API Route: POST /api/faculty/courses/[id]/enroll
 *            DELETE /api/faculty/courses/[id]/enroll
 *
 * POST:   Enroll a student by studentId or studentEmail.
 * DELETE: Remove a student's enrollment by studentId.
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

async function verifyCourseOwnership(courseId: string, facultyId: string) {
  return prisma.course.findFirst({ where: { id: courseId, facultyId } });
}

// ── POST — Enroll a student ────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await authenticate(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { id: courseId } = await params;
    const course = await verifyCourseOwnership(courseId, payload.sub);
    if (!course) return NextResponse.json({ error: "Course not found or access denied." }, { status: 403 });

    const body = await req.json();
    const { studentId: rawStudentId, studentEmail } = body;

    let studentId: string | undefined = rawStudentId;

    // Resolve email → userId if studentEmail provided
    if (!studentId && studentEmail) {
      const student = await prisma.user.findFirst({
        where: { email: studentEmail.trim().toLowerCase(), role: "STUDENT" },
        select: { id: true },
      });
      if (!student) {
        return NextResponse.json({ error: "No student found with that email address." }, { status: 404 });
      }
      studentId = student.id;
    }

    if (!studentId) {
      return NextResponse.json({ error: "studentId or studentEmail is required." }, { status: 400 });
    }

    // Check if student exists and has STUDENT role
    const student = await prisma.user.findFirst({
      where: { id: studentId, role: "STUDENT" },
      select: { id: true, fullName: true, email: true },
    });
    if (!student) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    // Check for existing enrollment
    const existing = await prisma.courseEnrollment.findFirst({
      where: { courseId, studentId },
    });
    if (existing) {
      return NextResponse.json({ error: "Student is already enrolled in this course." }, { status: 409 });
    }

    await prisma.courseEnrollment.create({
      data: { courseId, studentId },
    });

    return NextResponse.json({
      success: true,
      enrollment: {
        studentName: student.fullName,
        studentEmail: student.email,
        courseCode: course.courseCode,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/faculty/courses/[id]/enroll] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// ── DELETE — Remove enrollment ─────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await authenticate(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { id: courseId } = await params;
    const course = await verifyCourseOwnership(courseId, payload.sub);
    if (!course) return NextResponse.json({ error: "Course not found or access denied." }, { status: 403 });

    const body = await req.json();
    const { studentId } = body;

    if (!studentId) {
      return NextResponse.json({ error: "studentId is required." }, { status: 400 });
    }

    const enrollment = await prisma.courseEnrollment.findFirst({
      where: { courseId, studentId },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "Enrollment not found." }, { status: 404 });
    }

    await prisma.courseEnrollment.delete({ where: { id: enrollment.id } });

    return NextResponse.json({ success: true, message: "Student removed from course." });
  } catch (error) {
    console.error("[DELETE /api/faculty/courses/[id]/enroll] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
