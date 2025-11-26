/** @type {import('next').NextConfig} */
const nextConfig = { output: "standalone" };
module.exports = nextConfig;

const path = require('path');

module.exports = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    return config;
  },
};
