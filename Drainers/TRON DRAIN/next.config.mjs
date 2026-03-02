/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.web3modal.com',
        pathname: '/v2/wallet-image/**',
      },
    ],
  },
}

export default nextConfig
