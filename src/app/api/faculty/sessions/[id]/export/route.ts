/**
 * API Route: GET /api/faculty/sessions/[id]/export
 * Exports the attendance log for a session as a CSV file.
 * Escapes commas and quotes in all string fields per CSV spec (RFC 4180).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, extractBearerToken } from "@/lib/auth";

/** Escapes a CSV field value: wraps in quotes if it contains comma, quote, or newline. */
function csvEscape(value: string | null | undefined): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

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

    // Fetch session and validate ownership
    const session = await prisma.classSession.findUnique({
      where: { id },
      include: { course: { select: { facultyId: true, courseCode: true } } },
    });

    if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
    if (session.course.facultyId !== payload.sub) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    // Fetch all enrolled students with their attendance logs
    const enrollments = await prisma.courseEnrollment.findMany({
      where: { courseId: session.courseId },
      include: { student: { select: { fullName: true, studentRegNumber: true } } },
    });

    const logs = await prisma.attendanceLog.findMany({
      where: { sessionId: id },
    });
    const logMap = new Map(logs.map((l) => [l.studentId, l]));

    // Build CSV
    const HEADERS = [
      "Student Name",
      "Registration Number",
      "Status",
      "Verified At",
      "Lock1 Time",
      "Lock2 GPS",
      "Lock2 WiFi",
      "Lock3 Biometric",
      "Distance (m)",
      "IP Address",
      "Override Reason",
    ].join(",");

    const rows = enrollments.map((e) => {
      const log = logMap.get(e.studentId);
      return [
        csvEscape(e.student.fullName),
        csvEscape(e.student.studentRegNumber),
        csvEscape(log?.status ?? "ABSENT"),
        csvEscape(log?.verifiedAt?.toISOString() ?? ""),
        csvEscape(log?.lock1TokenVerified ? "PASS" : "FAIL"),
        csvEscape(log?.lock2GpsPassed ? "PASS" : "FAIL"),
        csvEscape(log?.lock2WifiPassed ? "PASS" : "FAIL"),
        csvEscape(log?.lock3BiometricVerified ? "PASS" : "FAIL"),
        csvEscape(log?.distanceMeters != null ? Number(log.distanceMeters).toFixed(2) : ""),
        csvEscape(log?.clientIpAddress ?? ""),
        csvEscape(log?.overrideReason ?? ""),
      ].join(",");
    });

    const csvContent = [HEADERS, ...rows].join("\r\n");
    const filename = `session-${id}-attendance.csv`;

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[GET /api/faculty/sessions/[id]/export] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
