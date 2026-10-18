import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // UserGuiding imports can upload the account's JSON file (often several MB).
    serverActions: { bodySizeLimit: "20mb" },
  },
  async headers() {
    return [
      {
        // The embed script is loaded cross-origin by customer sites.
        source: "/sdk.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=300" },
        ],
      },
    ];
  },
};

export default nextConfig;
