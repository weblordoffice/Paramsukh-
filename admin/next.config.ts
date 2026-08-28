import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactStrictMode: true,

    output: "standalone",

    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "res.cloudinary.com",
            },
            {
                protocol: "https",
                hostname: "images.unsplash.com",
            },
            {
                protocol: "https",
                hostname: "lh3.googleusercontent.com",
            },
        ],
    },

    env: {
        NEXT_PUBLIC_API_URL:
            process.env.NEXT_PUBLIC_API_URL ||
            "http://127.0.0.1:3000",
    },
};

export default nextConfig;