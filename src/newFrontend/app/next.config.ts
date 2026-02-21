import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@ocelescope/core",
    "@ocelescope/api-base",
    "@ocelescope/api-client",
    "@ocelescope/api-config",
    "@ocelescope/resources",
  ],
  //TODO: Find another way of doing this
  experimental: {
    proxyClientMaxBodySize: "1000gb",
  },
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
