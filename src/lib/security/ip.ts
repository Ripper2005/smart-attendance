/**
 * lib/security/ip.ts
 * Wi-Fi / Network verification for Lock 2 (Location) fallback.
 *
 * Strategy:
 * In a web environment, we cannot read the device's Wi-Fi SSID.
 * Instead, we check if the request originates from the campus public IP.
 * This works because all campus Wi-Fi traffic routes through the campus gateway.
 *
 * Configurable via environment variables:
 *   CAMPUS_PUBLIC_IPS=203.0.113.1,203.0.113.2  (comma-separated)
 */

/**
 * Extracts the real client IP from request headers.
 *
 * TRUST MODEL:
 * - x-forwarded-for is CLIENT-SPOOFABLE unless behind a trusted proxy.
 * - When deployed behind a reverse proxy (Vercel, Nginx, Cloudflare),
 *   set TRUSTED_PROXY_COUNT to the number of proxies in the chain.
 *   The function then reads the IP from the RIGHT side of the chain
 *   (rightmost = last proxy added = most trusted).
 * - When TRUSTED_PROXY_COUNT=0 (default/dev), takes the leftmost
 *   IP (traditional behavior, spoofable but harmless in dev).
 *
 * Examples for x-forwarded-for: "spoofed, real-client, proxy1, proxy2"
 *   TRUSTED_PROXY_COUNT=0 → "spoofed" (leftmost, dev default)
 *   TRUSTED_PROXY_COUNT=2 → "real-client" (2 from the right)
 */
export function getClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const ips = forwarded.split(",").map((ip) => ip.trim());
    const proxyCount = parseInt(process.env.TRUSTED_PROXY_COUNT ?? "0", 10);
    if (proxyCount > 0 && ips.length > proxyCount) {
      // Pick the IP just before the trusted proxies (counting from right)
      return ips[ips.length - proxyCount - 1] ?? ips[0];
    }
    // Dev default: leftmost (first) IP
    return ips[0];
  }

  const vercelIp = headers.get("x-real-ip");
  if (vercelIp) return vercelIp.trim();

  return null;
}

/**
 * Checks if a given IP matches the list of known campus gateway IPs.
 * Campus IPs are configured in env vars (CAMPUS_PUBLIC_IPS).
 *
 * @param clientIp     - The extracted client IP address
 * @param campusIp     - The IP stored for the classroom's campus/building
 * @returns true if the client is on campus Wi-Fi
 */
export function isCampusNetwork(clientIp: string | null, campusIp: string | null): boolean {
  if (!clientIp || !campusIp) return false;

  // Support comma-separated list of campus gateway IPs in env
  const allowedIPs = [
    ...(process.env.CAMPUS_PUBLIC_IPS ?? "").split(",").map((ip) => ip.trim()).filter(Boolean),
    campusIp, // Also include the classroom-specific IP
  ];

  return allowedIPs.includes(clientIp);
}
