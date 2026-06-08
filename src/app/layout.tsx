import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartAttend — Anti-Proxy Attendance System",
  description:
    "Foolproof university attendance with Triple-Lock security: Dynamic QR codes, GPS geofencing, and biometric verification.",
  manifest: "/manifest.json",
  keywords: ["attendance", "anti-proxy", "university", "QR code", "biometric", "geofencing"],
};

export const viewport: Viewport = {
  themeColor: "#6C63FF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // Prevents accidental zoom on mobile scan UI
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-animated-gradient min-h-full">
        {children}
      </body>
    </html>
  );
}
