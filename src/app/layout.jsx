import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import ThemeProvider from "@/context/ThemeProvider";
import SWRegister from "./sw-register";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import CustomerAssistant from "@/components/assistant/CustomerAssistant";
import { safeJsonLd } from "@/lib/json-ld";
import { UIProvider } from "@/context/UIContext";

const BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://borjak.site"
).replace(/\/+$/, "");

const SITE_TITLE = "برجک | فروشگاه اینترنتی Borjak";

const SITE_DESCRIPTION =
  "برجک (Borjak)، فروشگاه اینترنتی برای مشاهده، بررسی و خرید کالاهای متنوع از فروشندگان مختلف. محصولات و قیمت‌ها را بررسی کنید و سفارش خود را آنلاین ثبت کنید.";

const SHARE_IMAGE = "/images/og-image.png";


const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${BASE_URL}/#organization`,
  name: "برجک",
  alternateName: "Borjak",
  description:
    "برجک (Borjak)، فروشگاه اینترنتی برای مشاهده و خرید کالاهای متنوع از فروشندگان مختلف.",
  url: `${BASE_URL}/`,
  logo: `${BASE_URL}/images/logo.png`,
  sameAs: [
    "https://instagram.com/borjaklab",
    "https://t.me/borjaklabs",
  ],
  contactPoint: [
    {
      "@type": "ContactPoint",
      telephone: "+989116001260",
      contactType: "customer service",
      areaServed: "IR",
      availableLanguage: "fa",
    },
    {
      "@type": "ContactPoint",
      telephone: "+989038775616",
      contactType: "customer service",
      areaServed: "IR",
      availableLanguage: "fa",
    },
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${BASE_URL}/#website`,
  name: "برجک",
  alternateName: ["Borjak", "borjak.site"],
  url: `${BASE_URL}/`,
  publisher: {
    "@id": `${BASE_URL}/#organization`,
  },
};


export const metadata = {
  metadataBase: new URL(BASE_URL),

  applicationName: "برجک",

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
        alt: "فروشگاه اینترنتی برجک",
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
        alt: "فروشگاه اینترنتی برجک",
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
            __html: safeJsonLd(organizationJsonLd),
          }}
        />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd(websiteJsonLd),
          }}
        />

        <ThemeProvider>
          <UIProvider>
            <AuthProvider>
              <CartProvider>
                {children}
                <InstallPrompt />
                <CustomerAssistant />
              </CartProvider>
            </AuthProvider>
          </UIProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}