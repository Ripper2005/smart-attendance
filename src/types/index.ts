/**
 * types/index.ts
 * Shared TypeScript interfaces for the Smart Attendance system.
 * Used across API routes, components, and service layers.
 */

// ── Auth ────────────────────────────────────────────────────

export type UserRole = "FACULTY" | "STUDENT";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  studentRegNumber: string | null;
  avatarUrl: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ── Verification (Triple-Lock) ───────────────────────────────

export interface VerifyAttendanceRequest {
  /** Extracted from QR code payload */
  sessionId: string;
  /** TOTP token from QR code (Lock 1) */
  token: string;

  /** GPS coordinates from device (Lock 2) */
  latitude: number | null;
  longitude: number | null;

  /** WebAuthn credential response (Lock 3) */
  webAuthnResponse: object;

  /** Device fingerprint for anti-replay logging */
  deviceFingerprint?: string;
}

export interface VerifyAttendanceResponse {
  success: boolean;
  status: "PRESENT" | "FAILED";
  details: {
    lock1Time:      { passed: boolean; reason?: string };
    lock2Location:  { passed: boolean; distanceMeters?: number; wifiMatched?: boolean; reason?: string };
    lock3Identity:  { passed: boolean; reason?: string };
  };
}

// ── Attendance ──────────────────────────────────────────────

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "OVERRIDE";

export interface AttendanceLogEntry {
  id: string;
  studentId: string;
  studentName: string;
  studentRegNumber: string | null;
  status: AttendanceStatus;
  verifiedAt: string | null;
  distanceMeters: number | null;
  lock1TokenVerified: boolean;
  lock2GpsPassed: boolean;
  lock2WifiPassed: boolean;
  lock3BiometricVerified: boolean;
  overrideReason: string | null;
}

// ── Sessions ────────────────────────────────────────────────

export type SessionStatus = "SCHEDULED" | "ACTIVE" | "COMPLETED";

export interface SessionSummary {
  id: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  classroomName: string;
  status: SessionStatus;
  startedAt: string | null;
  endedAt: string | null;
  presentCount: number;
  totalStudents: number;
}

// ── QR Code ─────────────────────────────────────────────────

export interface QRPayload {
  sessionId: string;
  token: string;
  ts: number;
}

// ── API Responses ────────────────────────────────────────────

export interface ApiError {
  error: string;
  code?: string;
}

export type ApiResponse<T> = T | ApiError;
