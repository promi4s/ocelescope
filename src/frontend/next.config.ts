import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  reactStrictMode: true,
  transpilePackages: ["@rjsf/mantine", "@rjsf/core", "@rjsf/utils"],
  ignoreBuildErrors: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
