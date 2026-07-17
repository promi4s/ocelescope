import type { NextConfig } from "next";

const apiBase = process.env.EXTERNAL_API_BASE_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    proxyClientMaxBodySize: "1000gb",
  },
  transpilePackages: [
    "@mantine/charts",
    "recharts",
    "@r4pm/components",
    "@ocelescope/resources",
    "@ocelescope/plugin",
    "@ocelescope/filter",
    "@ocelescope/discovery",
    "@ocelescope/exploration",
    "@ocelescope/log-overview",
    "@ocelescope/management",
    "@ocelescope/variants",
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
