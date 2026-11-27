import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM and data files that must load from node_modules at runtime.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
