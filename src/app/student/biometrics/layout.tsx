import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register Biometric — SmartAttend",
  description: "Link your device biometrics (FaceID / Fingerprint) to your SmartAttend account for secure attendance verification.",
};

export default function BiometricsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-animated-gradient min-h-screen">
      {children}
    </div>
  );
}
