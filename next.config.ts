import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the dev badge clear of the scroll cue in the bottom-left corner.
  devIndicators: { position: "bottom-right" },
  images: {
    formats: ["image/avif", "image/webp"],
    // The portrait on the badge is served at a higher quality than the default.
    qualities: [75, 90],
  },
};

export default nextConfig;
