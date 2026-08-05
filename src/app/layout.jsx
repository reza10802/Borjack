import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import ThemeProvider from "@/context/ThemeProvider";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",

  name: "برجک",

  url: BASE_URL,

  potentialAction: {
    "@type": "SearchAction",

    target: `${BASE_URL}/products?search={search_term_string}`,

    "query-input": "required name=search_term_string",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",

  name: "برجک",

  url: BASE_URL,

  logo: `${BASE_URL}/images/logo.png`,

  sameAs: [
    "https://instagram.com/borjaklab",
    "https://t.me/borjaklabs",
  ],
};

export const metadata = {
  metadataBase: new URL(BASE_URL),

  title: {
    default: "برجک",
    template: "%s | برجک",
  },

  description: "خرید آنلاین با بهترین قیمت",

  openGraph: {
    type: "website",
    locale: "fa_IR",
    url: BASE_URL,

    siteName: "برجک",

    images: [
      {
        url: "/images/adsLogo.png",
        width: 1200,
        height: 630,
        alt: "Borjak Store",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",

    images: ["/images/adsLogo.png"],
  },
};

export default function RootLayout({ children }) {

  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col">
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
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}