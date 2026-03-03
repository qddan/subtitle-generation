/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: process.env.NEXT_EXPORT === "true" ? "export" : undefined,
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
