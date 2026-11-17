import {
  Serwist,
  NetworkFirst,
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
} from "serwist";

// Never cache authenticated / personal / payment pages or API responses (shared devices, logout).
const SENSITIVE_PATHS = [
  "/admin", "/profile", "/checkout", "/login", "/register", "/verify-phone", "/forgot-password", "/reset-password",
  "/api/auth", "/api/cart", "/api/order", "/api/payment", "/api/profile", "/api/admin", "/api/wishlist",
  "/api/adress", "/api/assistant", "/api/internal",
];
const isSensitive = (pathname) =>
  SENSITIVE_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,

  skipWaiting: true,
  clientsClaim: true,

  runtimeCaching: [
    {
      matcher: ({ url }) => isSensitive(url.pathname),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "borjak-pages",
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24,
          }),
        ],
      }),
    },

    {
      matcher: ({ request }) => request.destination === "image",
      handler: new CacheFirst({
        cacheName: "borjak-images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          }),
        ],
      }),
    },

    {
      matcher: ({ url, request }) =>
        request.method === "GET" &&
        url.pathname.startsWith("/api/products"),

      handler: new NetworkFirst({
        cacheName: "borjak-products",
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24,
          }),
        ],
      }),
    },

    {
      matcher: ({ url, request }) =>
        request.method === "GET" &&
        url.pathname === "/api/categories",

      handler: new NetworkFirst({
        cacheName: "borjak-categories",
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24,
          }),
        ],
      }),
    },

    {
      matcher: ({ url, request }) =>
        request.method === "GET" &&
        url.pathname === "/api/brands",

      handler: new NetworkFirst({
        cacheName: "borjak-brands",
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24,
          }),
        ],
      }),
    },

    {
      matcher: ({ url, request }) =>
        request.method === "GET" &&
        url.pathname === "/api/tags",

      handler: new NetworkFirst({
        cacheName: "borjak-tags",
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24,
          }),
        ],
      }),
    },
  ],
});

serwist.addEventListeners();