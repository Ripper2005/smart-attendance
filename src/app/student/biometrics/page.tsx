"use client";

/**
 * /student/biometrics
 * Biometric device registration page for students.
 *
 * Uses the WebAuthn (FIDO2) API via @simplewebauthn/browser to prompt the
 * device's native biometric authenticator (FaceID / Fingerprint / PIN).
 * The browser library is dynamically imported so it only runs client-side.
 *
 * States: "idle" | "loading" | "success" | "error"
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type PageState = "idle" | "loading" | "success" | "error";

export default function BiometricsPage() {
  const router = useRouter();

  const [pageState, setPageState]           = useState<PageState>("idle");
  const [error, setError]                   = useState<string>("");
  const [userName, setUserName]             = useState<string>("");
  const [devicesRegistered, setDevicesRegistered] = useState<number>(0);

  // ── On mount: check auth & load user from localStorage ─────
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      router.push("/auth/login");
      return;
    }
    try {
      const user = JSON.parse(stored);
      if (user.role !== "STUDENT") {
        router.push("/auth/login");
        return;
      }
      setUserName(user.fullName ?? user.email);
    } catch {
      router.push("/auth/login");
    }
  }, [router]);

  // ── Core registration function ──────────────────────────────
  async function handleRegister() {
    setPageState("loading");
    setError("");

    try {
      const token = localStorage.getItem("access_token");
      if (!token) throw new Error("Not authenticated. Please log in again.");

      // Step 1: Get registration options from server
      const optRes = await fetch("/api/webauthn/register/options", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!optRes.ok) {
        const errData = await optRes.json().catch(() => ({}));
        throw new Error(errData.error ?? "Failed to get registration options.");
      }

      const optionsJSON = await optRes.json();

      // Step 2: Trigger browser native biometric prompt
      // Dynamically imported so it never runs on the server (client-only API)
      const { startRegistration } = await import("@simplewebauthn/browser");
      const registrationResponse = await startRegistration({ optionsJSON });

      // Step 3: Send browser response to server for verification
      const verifyRes = await fetch("/api/webauthn/register/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(registrationResponse),
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}));
        throw new Error(errData.error ?? "Verification failed.");
      }

      // ✅ Success!
      setDevicesRegistered((n) => n + 1);
      setPageState("success");
    } catch (err: unknown) {
      // Handle user cancellation of the biometric prompt
      if (err instanceof Error && err.name === "NotAllowedError") {
        setError("Biometric prompt was cancelled. Please try again.");
      } else {
        setError(err instanceof Error ? err.message : "An unknown error occurred.");
      }
      setPageState("error");
    }
  }

  // ──────────────────────────────────────────────────────────
  // Render helpers
  // ──────────────────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      {/* Back link */}
      <div style={{ position: "absolute", top: 24, left: 24 }}>
        <Link
          href="/student/history"
          style={{
            color: "var(--color-text-muted)",
            fontSize: "0.85rem",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          ← Back to dashboard
        </Link>
      </div>

      <div
        className="glass animate-fadeInUp"
        style={{ width: "100%", maxWidth: 460, padding: "48px 40px", textAlign: "center" }}
      >
        {/* ── IDLE STATE ─────────────────────────────────────── */}
        {pageState === "idle" && (
          <>
            {/* Icon */}
            <div
              style={{
                width: 80,
                height: 80,
                background: "linear-gradient(135deg, rgba(108,99,255,0.2), rgba(34,211,238,0.2))",
                border: "2px solid rgba(108,99,255,0.3)",
                borderRadius: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 36,
                margin: "0 auto 28px",
              }}
            >
              🧬
            </div>

            <h1
              style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 12 }}
            >
              Register Your{" "}
              <span className="gradient-text">Biometric</span>
            </h1>

            {userName && (
              <p className="text-secondary" style={{ fontSize: "0.88rem", marginBottom: 8 }}>
                Hi, <strong style={{ color: "var(--color-text-primary)" }}>{userName}</strong>
              </p>
            )}

            <p
              className="text-secondary"
              style={{ fontSize: "0.92rem", lineHeight: 1.7, marginBottom: 32 }}
            >
              This links your{" "}
              <strong style={{ color: "var(--color-text-primary)" }}>FaceID or Fingerprint</strong>{" "}
              to your account. You will need it every time you mark attendance.
            </p>

            {/* Already registered notice */}
            {devicesRegistered > 0 && (
              <div
                style={{
                  padding: "12px 16px",
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  borderRadius: 10,
                  color: "#10B981",
                  fontSize: "0.87rem",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                ✅ {devicesRegistered} device{devicesRegistered > 1 ? "s" : ""} already registered.
                You can register another.
              </div>
            )}

            <button
              id="register-biometric-btn"
              onClick={handleRegister}
              className="btn btn-primary btn-lg"
              style={{ width: "100%", justifyContent: "center" }}
            >
              Register This Device →
            </button>
          </>
        )}

        {/* ── LOADING STATE ──────────────────────────────────── */}
        {pageState === "loading" && (
          <>
            <div
              style={{
                width: 80,
                height: 80,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 28px",
              }}
            >
              {/* Large custom spinner */}
              <div
                style={{
                  width: 56,
                  height: 56,
                  border: "3px solid rgba(108, 99, 255, 0.2)",
                  borderTop: "3px solid #6C63FF",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
            </div>

            <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 12 }}>
              Waiting for biometric…
            </h2>
            <p className="text-secondary" style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>
              Follow the prompt on your device to complete verification.
              <br />
              <span style={{ fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
                (FaceID, Fingerprint, or PIN)
              </span>
            </p>
          </>
        )}

        {/* ── SUCCESS STATE ──────────────────────────────────── */}
        {pageState === "success" && (
          <>
            <div
              style={{
                width: 80,
                height: 80,
                background: "rgba(16, 185, 129, 0.15)",
                border: "2px solid rgba(16, 185, 129, 0.4)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 36,
                margin: "0 auto 28px",
                boxShadow: "0 0 30px rgba(16, 185, 129, 0.25)",
              }}
            >
              ✅
            </div>

            <h2
              style={{ fontSize: "1.6rem", fontWeight: 800, color: "#10B981", marginBottom: 12 }}
            >
              Biometric Registered!
            </h2>
            <p className="text-secondary" style={{ fontSize: "0.92rem", lineHeight: 1.6, marginBottom: 32 }}>
              Your device biometric is now linked to your account. You&apos;re ready to mark attendance.
            </p>

            <Link
              href="/student/history"
              className="btn btn-primary btn-lg"
              style={{ width: "100%", justifyContent: "center", textDecoration: "none" }}
            >
              Go to My Dashboard →
            </Link>

            <button
              onClick={() => setPageState("idle")}
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 12, width: "100%" }}
            >
              Register another device
            </button>
          </>
        )}

        {/* ── ERROR STATE ────────────────────────────────────── */}
        {pageState === "error" && (
          <>
            <div
              style={{
                width: 80,
                height: 80,
                background: "rgba(239, 68, 68, 0.12)",
                border: "2px solid rgba(239, 68, 68, 0.35)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 36,
                margin: "0 auto 28px",
                boxShadow: "0 0 20px rgba(239, 68, 68, 0.2)",
              }}
            >
              ❌
            </div>

            <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 12 }}>
              Registration Failed
            </h2>

            {error && (
              <div
                style={{
                  padding: "12px 16px",
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  borderRadius: 10,
                  color: "#EF4444",
                  fontSize: "0.87rem",
                  marginBottom: 28,
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={() => setPageState("idle")}
              className="btn btn-primary btn-lg"
              style={{ width: "100%", justifyContent: "center" }}
            >
              Try Again
            </button>
            <Link
              href="/student/history"
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 12, width: "100%", justifyContent: "center", textDecoration: "none" }}
            >
              Skip for now
            </Link>
          </>
        )}

        {/* ── Security Notice (always shown) ─────────────────── */}
        <div
          style={{
            marginTop: 36,
            paddingTop: 20,
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <p
            className="text-muted"
            style={{ fontSize: "0.78rem", lineHeight: 1.6 }}
          >
            🔒 Your biometric data{" "}
            <strong style={{ color: "var(--color-text-secondary)" }}>never leaves your device</strong>.
            We only store a cryptographic key reference, not your face or fingerprint.
          </p>
        </div>
      </div>
    </div>
  );
}
