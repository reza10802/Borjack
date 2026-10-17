import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import ThemeProvider from "@/context/ThemeProvider";
import SWRegister from "./sw-register";
import InstallPrompt from "@/components/pwa/InstallPrompt";

const BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://borjak.site"
).replace(/\/+$/, "");

const SITE_TITLE =
  "برجک | فروشگاه اینترنتی موبایل، لپ‌تاپ و پوشاک";

const SITE_DESCRIPTION =
  "در فروشگاه اینترنتی برجک، محصولات دیجیتال و پوشاک را بررسی کنید، مشخصات و قیمت محصولات را ببینید و گزینه مناسب خود را انتخاب کنید.";

const SHARE_IMAGE = "/images/adsLogo.png";

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "برجک",
  alternateName: ["Borjak", "borjak.site"],
  url: `${BASE_URL}/`,
  potentialAction: {
    "@type": "SearchAction",
    target: `${BASE_URL}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "برجک",
  alternateName: "Borjak",
  description:
    "فروشگاه اینترنتی برجک برای بررسی و خرید محصولات دیجیتال و پوشاک.",
  url: `${BASE_URL}/`,
  logo: `${BASE_URL}/images/logo.png`,
  sameAs: [
    "https://instagram.com/borjaklab",
    "https://t.me/borjaklabs",
  ],
};

export const metadata = {
  metadataBase: new URL(BASE_URL),

  title: {
    default: SITE_TITLE,
    template: "%s | برجک",
  },

  description: SITE_DESCRIPTION,

  openGraph: {
    type: "website",
    locale: "fa_IR",
    url: `${BASE_URL}/`,
    siteName: "برجک",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: SHARE_IMAGE,
        width: 1200,
        height: 630,
        alt: "پیش‌نمایش فروشگاه اینترنتی برجک",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: SHARE_IMAGE,
        alt: "پیش‌نمایش فروشگاه اینترنتی برجک",
      },
    ],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col">
        <SWRegister />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteJsonLd),
          }}
        />

        <ThemeProvider>
          <AuthProvider>
            <CartProvider>
              {children}
              <InstallPrompt />
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}