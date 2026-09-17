/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Baked in at build time rather than read from the environment at runtime.
  //
  // On Amplify the build writes these into `.env.production` (see amplify.yml), which
  // Next loads when the server starts — but that depends on the file being packaged
  // into the SSR bundle, and when it is not, `process.env.CRM_API_BASE_URL` is simply
  // empty in the Lambda. The panel then reports "Sunucuya ulaşılamadı" on every call,
  // which reads as the backend being down rather than as a variable that never arrived.
  // Inlining removes the question: whatever the build saw is what the server uses.
  //
  // Safe to inline because neither value is a secret — one is a public hostname, the
  // other a feature flag. A credential must never be added to this block; it would be
  // embedded in the bundle. The cost is that changing either needs a redeploy, which
  // was already true of the .env.production route.
  env: {
    CRM_API_BASE_URL: process.env.CRM_API_BASE_URL ?? "",
    CRM_FEATURE_WAREHOUSE: process.env.CRM_FEATURE_WAREHOUSE ?? "false",
  },

  // Next 16 writes its own AGENTS.md and CLAUDE.md into the project root on every dev
  // run. They describe Next, not House Sixty — and a CLAUDE.md here would be loaded as
  // project instructions in preference to the real handover docs, which is a worse
  // outcome than not having one. The House Sixty context lives in
  // `~/Desktop/this_one/crm/HANDOVER.md` and the repo root CLAUDE.md.
  agentRules: false,

  // The panel is an internal tool behind a login. None of it should ever be indexed,
  // cached by an intermediary, or framed by another origin. Set here rather than in
  // middleware so the headers apply to every response including static assets.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};
export default nextConfig;
