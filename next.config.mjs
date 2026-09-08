/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

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
