import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    tsconfigPath: "./tsconfig.json"
  },
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse"]
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("pdf-parse");
    }
    return config;
  }
};

export default nextConfig;
