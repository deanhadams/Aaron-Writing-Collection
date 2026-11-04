import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// Next blocks its dev connection from any address but localhost, and then the
// page never starts: it looks right, but no button works. These are this
// machine's own addresses, for opening the site another way or from a phone.
const ownAddresses = Object.values(networkInterfaces())
  .flat()
  .flatMap((address) => (address?.family === "IPv4" ? [address.address] : []));

const nextConfig: NextConfig = {
  allowedDevOrigins: ownAddresses,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
