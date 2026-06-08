"use client";

/**
 * /student/scan
 * The core student attendance marking page.
 *
 * Orchestrates all 3 locks in sequence:
 *   STEP 1 — GPS (Lock 2 prep)    — navigator.geolocation
 *   STEP 2 — QR Scan (Lock 1 prep) — getUserMedia + jsQR canvas decoding
 *   STEP 3 — Biometric (Lock 3)   — WebAuthn authentication ceremony
 *   STEP 4 — Submit               — POST /api/verify (Phase 4)
 *
 * Camera stream is tracked via useRef and cleaned up on unmount.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type ScanState = "idle" | "gps" | "scanning" | "biometric" | "submitting" | "success" | "error";

interface QRPayload {
  sessionId: string;
  token: string;
  ts: number;
}

interface LockResult {
  lock1: boolean;
  lock2: boolean;
  lock3: boolean;
}

/** Non-cryptographic device fingerprint for logging purposes only. */
function generateFingerprint(): string {
  const raw = `${navigator.userAgent}|${screen.width}x${screen.height}|${navigator.language}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

/** Wraps getCurrentPosition in a Promise for async/await usage. */
function getGPSPosition(options?: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export default function ScanPage() {
  const router = useRouter();

  const [scanState, setScanState]     = useState<ScanState>("idle");
  const [error, setError]             = useState<string>("");
  const [locks, setLocks]             = useState<LockResult>({ lock1: false, lock2: false, lock3: false });

  // Refs — don't cause re-renders, safe to use in intervals
  const latRef          = useRef<number | null>(null);
  const lonRef          = useRef<number | null>(null);
  const streamRef       = useRef<MediaStream | null>(null);
  const videoRef        = useRef<HTMLVideoElement | null>(null);
  const canvasRef       = useRef<HTMLCanvasElement | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrPayloadRef    = useRef<QRPayload | null>(null);
  const authResponseRef = useRef<unknown>(null);

  // ── Cleanup camera on unmount ─────────────────────────
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  function stopCamera() {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function resetToIdle() {
    stopCamera();
    latRef.current = null;
    lonRef.current = null;
    qrPayloadRef.current = null;
    authResponseRef.current = null;
    setError("");
    setLocks({ lock1: false, lock2: false, lock3: false });
    setScanState("idle");
  }

  // ── Main scan orchestration flow ──────────────────────
  const handleScan = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setError("Not authenticated. Please log in again.");
      setScanState("error");
      return;
    }

    try {
      // ════════════════════════════════════════════════
      // STEP 1 — GPS (Lock 2 prep)
      // ════════════════════════════════════════════════
      setScanState("gps");

      let position: GeolocationPosition;
      try {
        position = await getGPSPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
        latRef.current = position.coords.latitude;
        lonRef.current = position.coords.longitude;
      } catch {
        setError("Location access denied. GPS is required to mark attendance.");
        setScanState("error");
        return;
      }

      // ════════════════════════════════════════════════
      // STEP 2 — QR Scan (Lock 1 prep)
      // ════════════════════════════════════════════════
      setScanState("scanning");

      // Request camera — prefer rear camera on mobile
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch {
        setError("Camera access denied. Please allow camera permission and try again.");
        setScanState("error");
        return;
      }
      streamRef.current = stream;

      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Decode QR from canvas frames
      const qrPayload = await new Promise<QRPayload>((resolve, reject) => {
        let settled = false;

        scanIntervalRef.current = setInterval(async () => {
          if (settled) return;
          const video  = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;

          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          canvas.width  = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          // Dynamically import jsQR (client-only, avoids SSR issues)
          const { default: jsQR } = await import("jsqr");
          const result = jsQR(imageData.data, imageData.width, imageData.height);

          if (result && result.data) {
            if (settled) return;
            settled = true;
            clearInterval(scanIntervalRef.current!);
            scanIntervalRef.current = null;
            try {
              const parsed: QRPayload = JSON.parse(result.data);
              if (!parsed.sessionId || !parsed.token) {
                reject(new Error("Invalid QR code format."));
              } else {
                resolve(parsed);
              }
            } catch {
              reject(new Error("Invalid QR code format — could not parse payload."));
            }
          }
        }, 100);

        // Timeout after 45 seconds
        setTimeout(() => {
          if (settled) return;
          settled = true;
          clearInterval(scanIntervalRef.current!);
          scanIntervalRef.current = null;
          reject(new Error("QR scan timed out. Please try again."));
        }, 45000);
      });

      // QR decoded — stop camera
      stopCamera();
      qrPayloadRef.current = qrPayload;

      // ════════════════════════════════════════════════
      // STEP 3 — Biometric Authentication (Lock 3)
      // ════════════════════════════════════════════════
      setScanState("biometric");

      // Get authentication options from server
      const optRes = await fetch("/api/webauthn/authenticate/options", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!optRes.ok) {
        const errData = await optRes.json().catch(() => ({}));
        throw new Error(
          errData.error ?? "Failed to get biometric options. Please register a device first."
        );
      }
      const optionsJSON = await optRes.json();

      // Trigger browser biometric prompt (FaceID / Fingerprint / PIN)
      const { startAuthentication } = await import("@simplewebauthn/browser");
      let authResponse: unknown;
      try {
        authResponse = await startAuthentication({ optionsJSON });
      } catch (bioErr: unknown) {
        if (bioErr instanceof Error && bioErr.name === "NotAllowedError") {
          throw new Error("Biometric prompt was cancelled. Please try again.");
        }
        throw new Error("Biometric authentication failed. Please try again.");
      }
      authResponseRef.current = authResponse;

      // ════════════════════════════════════════════════
      // STEP 4 — Submit Triple-Lock payload to /api/verify
      // ════════════════════════════════════════════════
      setScanState("submitting");

      const submitRes = await fetch("/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: qrPayloadRef.current.sessionId,
          token: qrPayloadRef.current.token,
          latitude: latRef.current,
          longitude: lonRef.current,
          webAuthnResponse: authResponseRef.current,
          deviceFingerprint: generateFingerprint(),
        }),
      });

      const result = await submitRes.json();

      if (submitRes.status === 404) {
        // Phase 4 not built yet — treat gracefully in dev
        throw new Error("Verification engine not yet available (Phase 4). QR & biometric OK.");
      }

      if (!submitRes.ok) {
        throw new Error(result.error ?? result.details ?? "Attendance verification failed.");
      }

      // ✅ All 3 locks passed!
      setLocks({
        lock1: result.lock1 ?? true,
        lock2: result.lock2 ?? true,
        lock3: result.lock3 ?? true,
      });
      setScanState("success");

    } catch (err: unknown) {
      stopCamera();
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setScanState("error");
    }
  }, []);

  // ─────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────
  return (
    <div style={{ padding: "24px 20px", maxWidth: 480, margin: "0 auto" }}>

      {/* ── IDLE ───────────────────────────────────────── */}
      {scanState === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 0" }}>
          <div style={{
            width: 100, height: 100, borderRadius: 24,
            background: "linear-gradient(135deg, rgba(108,99,255,0.2), rgba(34,211,238,0.2))",
            border: "2px solid rgba(108,99,255,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 44, marginBottom: 28,
          }}>📷</div>

          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 10, textAlign: "center" }}>
            Mark My <span className="gradient-text">Attendance</span>
          </h1>
          <p className="text-secondary" style={{ fontSize: "0.88rem", lineHeight: 1.7, textAlign: "center", marginBottom: 36, maxWidth: 320 }}>
            Have the classroom QR code ready. GPS location and biometric will be requested automatically.
          </p>

          <button
            onClick={handleScan}
            className="btn btn-primary btn-lg"
            style={{ width: "100%", justifyContent: "center", maxWidth: 320 }}
          >
            📷 Start Attendance
          </button>

          {/* How it works */}
          <div style={{ marginTop: 36, width: "100%", maxWidth: 320 }}>
            {[
              { icon: "📍", text: "GPS location is captured" },
              { icon: "📷", text: "Scan the classroom QR code" },
              { icon: "🧬", text: "Verify your identity biometrically" },
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem",
                }}>
                  {step.icon}
                </div>
                <span className="text-secondary" style={{ fontSize: "0.85rem" }}>
                  <strong style={{ color: "var(--color-text-primary)" }}>Step {i + 1}:</strong> {step.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── GPS ACQUIRING ──────────────────────────────── */}
      {scanState === "gps" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 0" }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20, marginBottom: 24,
            background: "rgba(34,211,238,0.12)", border: "2px solid rgba(34,211,238,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36,
            animation: "pulse-ring 1.5s ease-out infinite",
          }}>📍</div>
          <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3, marginBottom: 20 }} />
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 8 }}>Acquiring GPS Location…</h2>
          <p className="text-secondary" style={{ fontSize: "0.88rem", textAlign: "center" }}>
            Please wait while we determine your precise location.
          </p>
        </div>
      )}

      {/* ── SCANNING ──────────────────────────────────── */}
      {scanState === "scanning" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 16, alignSelf: "flex-start" }}>
            📷 Scan QR Code
          </h2>

          {/* Video viewfinder */}
          <div style={{
            position: "relative", width: "100%", maxWidth: 360,
            borderRadius: 16, overflow: "hidden",
            border: "2px solid rgba(108,99,255,0.4)",
            boxShadow: "0 0 30px rgba(108,99,255,0.2)",
          }}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: "100%", display: "block", borderRadius: 14 }}
            />
            {/* Scanning overlay frame */}
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none",
            }}>
              <div style={{
                width: 200, height: 200, borderRadius: 8,
                border: "2px solid rgba(108,99,255,0.8)",
                boxShadow: "inset 0 0 0 1000px rgba(0,0,0,0.25)",
              }}>
                {/* Corner brackets */}
                {[
                  { top: -1, left: -1, borderTop: "3px solid #6C63FF", borderLeft: "3px solid #6C63FF" },
                  { top: -1, right: -1, borderTop: "3px solid #6C63FF", borderRight: "3px solid #6C63FF" },
                  { bottom: -1, left: -1, borderBottom: "3px solid #6C63FF", borderLeft: "3px solid #6C63FF" },
                  { bottom: -1, right: -1, borderBottom: "3px solid #6C63FF", borderRight: "3px solid #6C63FF" },
                ].map((s, i) => (
                  <div key={i} style={{ position: "absolute", width: 20, height: 20, borderRadius: 2, ...s }} />
                ))}
              </div>
            </div>
          </div>

          {/* Hidden canvas for frame sampling */}
          <canvas ref={canvasRef} style={{ display: "none" }} />

          <p className="text-secondary" style={{ fontSize: "0.85rem", textAlign: "center", marginTop: 16 }}>
            Point your camera at the classroom QR code displayed by your faculty.
          </p>
          <p className="text-muted" style={{ fontSize: "0.78rem", marginTop: 6 }}>
            QR rotates every 5 seconds — scan quickly!
          </p>
        </div>
      )}

      {/* ── BIOMETRIC ─────────────────────────────────── */}
      {scanState === "biometric" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 0" }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20, marginBottom: 24,
            background: "rgba(108,99,255,0.12)", border: "2px solid rgba(108,99,255,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36,
          }}>🧬</div>
          <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3, marginBottom: 20 }} />
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 8 }}>Verifying Your Identity…</h2>
          <p className="text-secondary" style={{ fontSize: "0.88rem", textAlign: "center" }}>
            Complete the biometric prompt on your device (FaceID, Fingerprint, or PIN).
          </p>
        </div>
      )}

      {/* ── SUBMITTING ────────────────────────────────── */}
      {scanState === "submitting" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 0" }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20, marginBottom: 24,
            background: "rgba(245,158,11,0.12)", border: "2px solid rgba(245,158,11,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36,
          }}>⏳</div>
          <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3, marginBottom: 20 }} />
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 8 }}>Recording Attendance…</h2>
          <p className="text-secondary" style={{ fontSize: "0.88rem", textAlign: "center" }}>
            Validating all three security checks simultaneously.
          </p>
        </div>
      )}

      {/* ── SUCCESS ───────────────────────────────────── */}
      {scanState === "success" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 0" }}>
          <div style={{
            width: 90, height: 90, borderRadius: "50%", marginBottom: 24,
            background: "rgba(16,185,129,0.15)", border: "2px solid rgba(16,185,129,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40,
            boxShadow: "0 0 40px rgba(16,185,129,0.3)",
          }}>✅</div>

          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "#10B981", marginBottom: 8, textAlign: "center" }}>
            Attendance Marked!
          </h1>
          <p className="text-secondary" style={{ fontSize: "0.88rem", marginBottom: 32, textAlign: "center" }}>
            All three security locks verified successfully.
          </p>

          {/* Lock results */}
          <div style={{ display: "flex", gap: 12, marginBottom: 36, flexWrap: "wrap", justifyContent: "center" }}>
            {[
              { icon: "🕐", label: "QR Token", pass: locks.lock1 },
              { icon: "📍", label: "Location", pass: locks.lock2 },
              { icon: "🧬", label: "Biometric", pass: locks.lock3 },
            ].map((lock) => (
              <div key={lock.label} style={{
                padding: "12px 16px", borderRadius: 12, textAlign: "center", minWidth: 90,
                background: lock.pass ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${lock.pass ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
              }}>
                <div style={{ fontSize: "1.4rem", marginBottom: 4 }}>{lock.icon}</div>
                <div style={{ fontSize: "0.7rem", fontWeight: 600, color: lock.pass ? "#10B981" : "#EF4444", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {lock.label}
                </div>
                <div style={{ fontSize: "0.65rem", color: lock.pass ? "#10B981" : "#EF4444" }}>
                  {lock.pass ? "✓ PASS" : "✗ FAIL"}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => router.push("/student/history")}
            className="btn btn-primary btn-lg"
            style={{ width: "100%", maxWidth: 320, justifyContent: "center" }}
          >
            View My History →
          </button>
          <button
            onClick={resetToIdle}
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 12 }}
          >
            Mark Another
          </button>
        </div>
      )}

      {/* ── ERROR ─────────────────────────────────────── */}
      {scanState === "error" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 0" }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%", marginBottom: 24,
            background: "rgba(239,68,68,0.12)", border: "2px solid rgba(239,68,68,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36,
            boxShadow: "0 0 20px rgba(239,68,68,0.2)",
          }}>❌</div>

          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 14 }}>Something Went Wrong</h2>

          <div style={{
            padding: "12px 16px", background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10,
            color: "#EF4444", fontSize: "0.85rem", marginBottom: 28,
            lineHeight: 1.6, textAlign: "center", maxWidth: 320,
          }}>
            {error}
          </div>

          <button
            onClick={resetToIdle}
            className="btn btn-primary btn-lg"
            style={{ width: "100%", maxWidth: 320, justifyContent: "center" }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
