import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// IMPORTANT: the "build" script in package.json MUST stay `next build --webpack`.
// Serwist 9.x uses a webpack plugin and does NOT support Next 16's default
// Turbopack bundler — a plain `next build` silently emits NO service worker,
// so /sw.js 404s and all PWA caching disappears with no error. Keep Vercel's
// Build Command as `npm run build` (not a hardcoded `next build`). Remove the
// --webpack flag only once Serwist supports Turbopack (serwist/serwist#54).

const nextConfig: NextConfig = {
  /* config options here */
};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Disable in dev to avoid stale-cache confusion during local work.
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
