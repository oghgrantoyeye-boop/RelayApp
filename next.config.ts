import type { NextConfig } from "next";

const config: NextConfig = {
  // PGlite ships WASM and data files; load it from node_modules at runtime instead of bundling.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default config;
