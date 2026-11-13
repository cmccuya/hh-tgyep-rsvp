import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
    loader: "custom",
    loaderFile: "./image-loader.ts",
  },
  trailingSlash: true,
  turbopack: {
    root: process.cwd(),
  },
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
