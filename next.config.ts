import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(__dirname),
  typescript: {
    tsconfigPath: "./tsconfig.json"
  },
  serverExternalPackages: ["pdf-parse"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("pdf-parse");
    }
    return config;
  }
};

export default nextConfig;
