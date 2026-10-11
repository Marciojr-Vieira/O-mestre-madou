import type { NextConfig } from 'next';
const config: NextConfig = {
  async rewrites() {
    if(process.env.NETLIFY==='true'||process.env.NODE_ENV==='production')return [];
    return [{ source: '/v1/:path*', destination: `http://127.0.0.1:${process.env.ELO_API_PORT || 4000}/v1/:path*` }];
  },
};
export default config;
