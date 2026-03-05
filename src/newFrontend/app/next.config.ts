import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    proxyClientMaxBodySize: "1000gb",
  },
  transpilePackages: [
    "@ocelescope/core",
    "@ocelescope/resources",
    "@ocelescope/ocelot",
    "@ocelescope/api-base",
    "@ocelescope/api-client",
    "@ocelescope/filter",
  ],
  rewrites: async () => {
    return [
      {
        source: "/api/external/:path*",
        destination: "http://backend:8000/:path*",
      },
    ];
  },
};

export default nextConfig;
