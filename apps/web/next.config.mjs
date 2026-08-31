/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * Workspace packages are shipped as TypeScript source, so Next must run
   * them through its own compiler. This is the web-side counterpart of the
   * Metro config in the mobile app: both bundlers treat internal packages as
   * source, neither requires a prior build, and the two stay in step.
   */
  transpilePackages: [
    "@indiagate/core",
    "@indiagate/contracts",
    "@indiagate/queries",
    "@indiagate/ui",
  ],

  experimental: {
    // Trims the server bundle in the Docker image by tracing from the
    // monorepo root rather than the app directory.
    outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  },

  // Standalone output so the container ships only what is traced, not the
  // whole pnpm store.
  output: "standalone",

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.indiagate.sg" },
      { protocol: "https", hostname: "*.cloudfront.net" },
    ],
    formats: ["image/avif", "image/webp"],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
