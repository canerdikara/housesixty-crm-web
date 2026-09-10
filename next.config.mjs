/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

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
