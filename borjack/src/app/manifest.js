export default function manifest() {
  return {
    name: "برجک",
    short_name: "برجک",

    description: "فروشگاه آنلاین برجک",

    start_url: "/",

    display: "standalone",

    background_color: "#ffffff",

    theme_color: "#f97316",

    lang: "fa",

    dir: "rtl",

    icons: [
      {
        src: "/images/logo3.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/images/logo2.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}