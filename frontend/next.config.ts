import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',  // 靜態導出，適合 Cloudflare Pages
  images: {
    unoptimized: true,  // 靜態導出需要禁用圖片優化
  },
};

export default nextConfig;
