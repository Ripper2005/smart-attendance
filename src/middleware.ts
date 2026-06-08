/**
 * middleware.ts
 * Next.js Middleware — runs before every matched request.
 *
 * Responsibilities:
 * 1. Protects /faculty/* routes — requires FACULTY JWT
 * 2. Protects /student/* routes — requires STUDENT JWT
 * 3. Redirects authenticated users away from /auth pages
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractBearerToken } from "@/lib/auth";

// Routes that require authentication
const FACULTY_ROUTES = ["/faculty"];
const STUDENT_ROUTES = ["/student"];
const AUTH_ROUTES    = ["/auth"];

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get token from cookie (page navigations) or Authorization header (API calls)
  const cookieToken = request.cookies.get("access_token")?.value;
  const headerToken = extractBearerToken(request.headers.get("authorization"));
  const token = cookieToken ?? headerToken;

  const payload = token ? await verifyToken(token) : null;

  // ── Protect Faculty routes ────────────────────────────────
  if (FACULTY_ROUTES.some((r) => pathname.startsWith(r))) {
    if (!payload) {
      return NextResponse.redirect(
        new URL("/auth/login?redirect=" + encodeURIComponent(pathname), request.url)
      );
    }
    if (payload.role !== "FACULTY") {
      // A student trying to access faculty pages → redirect to student dashboard
      return NextResponse.redirect(new URL("/student/dashboard", request.url));
    }
  }

  // ── Protect Student routes ────────────────────────────────
  if (STUDENT_ROUTES.some((r) => pathname.startsWith(r))) {
    if (!payload) {
      return NextResponse.redirect(
        new URL("/auth/login?redirect=" + encodeURIComponent(pathname), request.url)
      );
    }
    if (payload.role !== "STUDENT") {
      return NextResponse.redirect(new URL("/faculty/dashboard", request.url));
    }
  }

  // ── Redirect authenticated users away from /auth pages ────
  if (AUTH_ROUTES.some((r) => pathname.startsWith(r)) && payload) {
    const destination =
      payload.role === "FACULTY" ? "/faculty/dashboard" : "/student/dashboard";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/faculty/:path*", "/student/:path*", "/auth/:path*"],
};
