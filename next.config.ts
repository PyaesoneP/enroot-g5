import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The wall's stop-word list is read from disk at runtime
  // (src/lib/stopwords.ts); make sure the function bundle carries it.
  outputFileTracingIncludes: {
    "/api/wall": ["./content/stopwords.txt"],
  },
};

export default nextConfig;
