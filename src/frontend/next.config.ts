import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  reactStrictMode: true,
  transpilePackages: ["@rjsf/mantine", "@rjsf/core", "@rjsf/utils"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  rewrites: async () => {
    return [
      {
        source: "/api/:path*",
        destination: "http://backend:8000/:path*",
      },
    ];
  },
};

export default nextConfig;
