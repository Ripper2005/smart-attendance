import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SmartAttend — Stop Proxy Attendance Forever",
  description:
    "Triple-Lock security: Dynamic QR codes refresh every 5 seconds. GPS geofencing within 10 meters. Device biometric verification. Ghost students have nowhere to hide.",
};

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* ── Navbar ─────────────────────────────────────────── */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          padding: "16px 40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(10, 10, 15, 0.8)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(108, 99, 255, 0.1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: 36,
              height: 36,
              background: "linear-gradient(135deg, #6C63FF, #22D3EE)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            🛡️
          </div>
          <span style={{ fontSize: "1.1rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Smart<span className="gradient-text">Attend</span>
          </span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/auth/login" className="btn btn-ghost btn-sm">
            Sign In
          </Link>
          <Link href="/auth/register" className="btn btn-primary btn-sm">
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "140px 24px 80px",
        }}
      >
        {/* Badge */}
        <div
          className="animate-fadeInUp"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 16px",
            background: "rgba(108, 99, 255, 0.1)",
            border: "1px solid rgba(108, 99, 255, 0.25)",
            borderRadius: 9999,
            fontSize: "0.78rem",
            fontWeight: 600,
            color: "var(--color-primary-light)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 32,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#22D3EE",
              boxShadow: "0 0 8px #22D3EE",
              display: "inline-block",
              animation: "pulse-ring 1.5s ease-out infinite",
            }}
          />
          Triple-Lock Security · Zero Proxy Tolerance
        </div>

        {/* Headline */}
        <h1
          className="animate-fadeInUp"
          style={{
            fontSize: "clamp(2.4rem, 6vw, 4.5rem)",
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            maxWidth: 820,
            marginBottom: 24,
            animationDelay: "0.1s",
          }}
        >
          Ghost Students Have{" "}
          <span className="gradient-text">Nowhere</span> to Hide
        </h1>

        {/* Subheadline */}
        <p
          className="animate-fadeInUp text-secondary"
          style={{
            fontSize: "clamp(1rem, 2vw, 1.2rem)",
            maxWidth: 580,
            marginBottom: 48,
            lineHeight: 1.7,
            animationDelay: "0.2s",
          }}
        >
          SmartAttend combines{" "}
          <strong style={{ color: "var(--color-text-primary)" }}>dynamic QR codes</strong>,{" "}
          <strong style={{ color: "var(--color-text-primary)" }}>GPS geofencing</strong>, and{" "}
          <strong style={{ color: "var(--color-text-primary)" }}>device biometrics</strong> into a
          single 2-second verification — making proxy attendance technically impossible.
        </p>

        {/* CTA Buttons */}
        <div
          className="animate-fadeInUp"
          style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", animationDelay: "0.3s" }}
        >
          <Link href="/auth/register?role=faculty" className="btn btn-primary btn-lg">
            🏫 I&apos;m a Faculty
          </Link>
          <Link href="/auth/register?role=student" className="btn btn-secondary btn-lg">
            🎓 I&apos;m a Student
          </Link>
        </div>
      </section>

      {/* ── Triple-Lock Cards ───────────────────────────────── */}
      <section style={{ padding: "0 24px 100px", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
        <p
          className="text-muted"
          style={{ textAlign: "center", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 40, fontWeight: 600 }}
        >
          How the Triple-Lock Works
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 24,
          }}
        >
          {[
            {
              icon: "⏱️",
              number: "01",
              color: "#6C63FF",
              title: "Time Lock",
              subtitle: "Dynamic QR Token",
              desc: "The QR code refreshes every 5 seconds using TOTP cryptography. Screenshots become worthless instantly.",
            },
            {
              icon: "📍",
              number: "02",
              color: "#22D3EE",
              title: "Location Lock",
              subtitle: "10-Meter GPS Geofence",
              desc: "The student's GPS must be within 10 meters of the classroom. Campus Wi-Fi IP is verified as a secondary check.",
            },
            {
              icon: "🧬",
              number: "03",
              color: "#10B981",
              title: "Identity Lock",
              subtitle: "WebAuthn Biometrics",
              desc: "FaceID or Fingerprint verification via WebAuthn (FIDO2) confirms the registered student is physically present.",
            },
          ].map((lock) => (
            <div
              key={lock.number}
              className="glass glass-hover"
              style={{ padding: 32 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <span style={{ fontSize: "2rem" }}>{lock.icon}</span>
                <span style={{ fontSize: "2.5rem", fontWeight: 900, color: lock.color, opacity: 0.2, fontVariantNumeric: "tabular-nums" }}>
                  {lock.number}
                </span>
              </div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: 4 }}>
                {lock.title}
              </h3>
              <p style={{ fontSize: "0.78rem", color: lock.color, fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {lock.subtitle}
              </p>
              <p className="text-secondary" style={{ fontSize: "0.9rem", lineHeight: 1.65 }}>
                {lock.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid var(--color-border)",
          padding: "24px 40px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <p className="text-muted" style={{ fontSize: "0.82rem" }}>
          SmartAttend · Built for secure university attendance · 2025
        </p>
      </footer>
    </main>
  );
}
