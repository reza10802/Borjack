import "./globals.css";
import { AuthProvider } from "../context/AuthContext";

export const metadata = {
  title: "فروشگاه آنلاین",
  description: "خرید آنلاین با بهترین قیمت",
};

export default function RootLayout({ children }) {
  return (
    <html dir="rtl" lang="fa">
      <body className="min-h-screen flex flex-col">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}