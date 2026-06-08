"use client";

/**
 * /auth/register
 * Registration page for Faculty and Students.
 * Supports ?role=faculty or ?role=student pre-selection via URL param.
 */

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedRole = searchParams.get("role")?.toUpperCase();

  const [role, setRole]           = useState<"FACULTY" | "STUDENT">(
    preselectedRole === "FACULTY" ? "FACULTY" : "STUDENT"
  );
  const [fullName, setFullName]   = useState("");
  const [email, setEmail]         = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          fullName,
          role,
          studentRegNumber: role === "STUDENT" ? regNumber : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Registration failed. Please try again.");
        return;
      }

      // Store tokens in localStorage for Bearer header API calls
      localStorage.setItem("access_token", data.accessToken);
      localStorage.setItem("refresh_token", data.refreshToken);
      localStorage.setItem("user", JSON.stringify(data.user));
      // HttpOnly cookies are now set by the server via Set-Cookie header

      // After registration, students should register their biometric device first
      const destination =
        data.user.role === "FACULTY" ? "/faculty/dashboard" : "/student/biometrics";
      router.push(destination);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div className="glass animate-fadeInUp" style={{ width: "100%", maxWidth: 460, padding: "40px 36px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 52,
              height: 52,
              background: "linear-gradient(135deg, #6C63FF, #22D3EE)",
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              margin: "0 auto 14px",
            }}
          >
            🛡️
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
            Create Account
          </h1>
          <p className="text-secondary" style={{ fontSize: "0.88rem", marginTop: 6 }}>
            Join SmartAttend as Faculty or Student
          </p>
        </div>

        {/* Role Toggle */}
        <div
          style={{
            display: "flex",
            background: "var(--color-surface-2)",
            borderRadius: 12,
            padding: 4,
            marginBottom: 24,
          }}
        >
          {(["FACULTY", "STUDENT"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              style={{
                flex: 1,
                padding: "9px 0",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.85rem",
                transition: "all 0.2s ease",
                background: role === r ? "linear-gradient(135deg, #6C63FF, #4F46E5)" : "transparent",
                color: role === r ? "#fff" : "var(--color-text-secondary)",
                boxShadow: role === r ? "0 4px 12px rgba(108, 99, 255, 0.3)" : "none",
              }}
            >
              {r === "FACULTY" ? "🏫 Faculty" : "🎓 Student"}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: "12px 16px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 10,
              color: "#EF4444",
              fontSize: "0.87rem",
              marginBottom: 20,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="fullName">Full Name</label>
            <input
              id="fullName"
              type="text"
              className="form-input"
              placeholder="Dr. Jane Smith"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Email Address</label>
            <input
              id="reg-email"
              type="email"
              className="form-input"
              placeholder="you@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {/* Student Registration Number */}
          {role === "STUDENT" && (
            <div className="form-group">
              <label className="form-label" htmlFor="regNumber">Registration Number</label>
              <input
                id="regNumber"
                type="text"
                className="form-input"
                placeholder="e.g. 21CS1234"
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              type="password"
              className="form-input"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
            <input
              id="confirm-password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <button
            id="register-submit"
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ marginTop: 8, width: "100%", justifyContent: "center" }}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Creating account…
              </>
            ) : (
              `Create ${role === "FACULTY" ? "Faculty" : "Student"} Account →`
            )}
          </button>
        </form>

        <div className="divider" style={{ margin: "24px 0" }}>or</div>

        <p className="text-secondary" style={{ textAlign: "center", fontSize: "0.88rem" }}>
          Already have an account?{" "}
          <Link
            href="/auth/login"
            style={{ color: "var(--color-primary-light)", fontWeight: 600, textDecoration: "none" }}
          >
            Sign in
          </Link>
        </p>

        <p style={{ textAlign: "center", marginTop: 12 }}>
          <Link
            href="/"
            style={{ color: "var(--color-text-muted)", fontSize: "0.8rem", textDecoration: "none" }}
          >
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
