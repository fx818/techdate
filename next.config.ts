import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

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
