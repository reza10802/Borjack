import { withSerwist } from "@serwist/turbopack";

const nextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
};

export default withSerwist(nextConfig);