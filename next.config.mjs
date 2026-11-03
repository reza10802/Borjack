import { withSerwist } from "@serwist/turbopack";

const nextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  output: "standalone",
};

export default withSerwist(nextConfig);