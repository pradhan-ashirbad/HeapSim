import type { NextConfig } from "next";
const config: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1"],
  experimental: { cpus: 2 },
  outputFileTracingIncludes: { "/api/cad": ["./vendor/libredwg/dxf2dwg"] },
};
export default config;
