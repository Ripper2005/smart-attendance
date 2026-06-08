/**
 * API Route: GET /api/faculty/classrooms
 * Returns all classrooms for the classroom dropdown when creating a session.
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

    const classrooms = await prisma.classroom.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, building: true, latitude: true, longitude: true, radiusMeters: true },
    });

    return NextResponse.json({
      classrooms: classrooms.map((c) => ({
        id: c.id,
        name: c.name,
        building: c.building,
        latitude: Number(c.latitude),
        longitude: Number(c.longitude),
        radiusMeters: c.radiusMeters,
      })),
    });
  } catch (error) {
    console.error("[GET /api/faculty/classrooms] Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
