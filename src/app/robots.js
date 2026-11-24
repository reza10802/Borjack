const BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://borjak.site"
).replace(/\/+$/, "");

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",

        allow: "/",

        disallow: [
          "/api/",
          "/admin/",
          "/dashboard/",
          "/supplier/",
          "/profile/",
          "/login",
          "/register",
          "/cart",
          "/checkout",
        ],
      },
    ],

    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}