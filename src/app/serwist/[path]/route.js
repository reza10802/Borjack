import { createSerwistRoute } from "@serwist/turbopack";

const handler = createSerwistRoute({
  swSrc: "src/app/sw.js",
});

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;

export const generateStaticParams = handler.generateStaticParams;

export const GET = handler.GET;