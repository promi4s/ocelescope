import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const apiBase = process.env.EXTERNAL_API_BASE_URL ?? "http://localhost:8000";
const appDir = dirname(fileURLToPath(import.meta.url));

const singletonPackages = [
  "@mantine/core",
  "@mantine/hooks",
  "@mantine/notifications",
  "@mantine/dates",
  "@mantine/charts",
  "@mantine/dropzone",
] as const;

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
    "@ocelescope/log-overview",
    "@ocelescope/management",
    "@ocelescope/variants",
  ],
  turbopack: {},
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      ...Object.fromEntries(
        singletonPackages.map((packageName) => [
          packageName,
          join(appDir, "node_modules", packageName),
        ]),
      ),
    };
    return config;
  },
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
