import type { NextConfig } from "next";
import { localizedSegments } from "./src/lib/i18n";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Politique de sécurité du contenu. Le site ne charge aucun script ni police
 * de tiers : tout est servi depuis le même domaine.
 * 'unsafe-inline' reste nécessaire pour les scripts d'hydratation de Next.js
 * en rendu statique (une CSP à nonce imposerait un rendu dynamique).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Les dossiers de pages portent le segment anglais ; on redirige l'anglais
  // vers le français sous /fr (et inversement sous /en) pour une seule URL canonique.
  async redirects() {
    return localizedSegments.flatMap(({ fr, en }) => [
      { source: `/fr/${en}`, destination: `/fr/${fr}`, permanent: true },
      { source: `/fr/${en}/:path*`, destination: `/fr/${fr}/:path*`, permanent: true },
      { source: `/en/${fr}`, destination: `/en/${en}`, permanent: true },
      { source: `/en/${fr}/:path*`, destination: `/en/${en}/:path*`, permanent: true },
    ]);
  },
  async rewrites() {
    return localizedSegments.flatMap(({ fr, en }) => [
      { source: `/fr/${fr}`, destination: `/fr/${en}` },
      { source: `/fr/${fr}/:path*`, destination: `/fr/${en}/:path*` },
    ]);
  },
};

export default nextConfig;
