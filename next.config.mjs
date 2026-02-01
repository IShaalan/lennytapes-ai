/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disabled in dev to prevent double LLM calls (effects run twice in strict mode)
  // Re-enable periodically to catch React bugs
  reactStrictMode: false,

  // Optimize images from external sources
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/vi/**",
      },
    ],
  },
};

export default nextConfig;
