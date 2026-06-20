import type { NextConfig } from "next";

const apiBase = process.env.EXTERNAL_API_BASE_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    proxyClientMaxBodySize: "1000gb",
  },
  transpilePackages: [
    "@ocelescope/core",
    "@ocelescope/resources",
    "@ocelescope/ocelot",
    "@ocelescope/plugin",
    "@ocelescope/api-base",
    "@ocelescope/api-client",
    "@ocelescope/filter",
    "@ocelescope/discovery",
    "@ocelescope/log-overview",
    "@ocelescope/management",
  ],
  rewrites: async () => {
    return [
      {
        source: "/api/external/:path*",
        destination: `${apiBase}/:path*`,
      },
    ];
  },
};

export default nextConfig;
