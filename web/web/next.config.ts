import type { NextConfig } from "next";

const apiProxyTarget = (process.env.PANEL_API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_PROXY_TARGET || "")
  .trim()
  .replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    if (!apiProxyTarget) {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
