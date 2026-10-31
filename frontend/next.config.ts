import type { NextConfig } from "next";

/*
  Where the FastAPI backend runs. The browser never calls it directly: requests to
  /auth/* and /api/* on this site are forwarded to it (see rewrites below), so the
  login cookie is first-party and no CORS is needed.
  Local default: http://localhost:8000. On Vercel set BACKEND_URL to the deployed backend.
*/
const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      // Same path as the backend so its refresh-token cookie (Path=/auth) is sent back
      { source: "/auth/:path*", destination: `${BACKEND_URL}/auth/:path*` },
      // Every other backend endpoint, e.g. /api/projects -> BACKEND_URL/projects
      { source: "/api/:path*", destination: `${BACKEND_URL}/:path*` },
    ];
  },
};

export default nextConfig;
