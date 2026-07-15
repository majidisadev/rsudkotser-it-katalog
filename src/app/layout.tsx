import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Katalog IT RSUD Kotser",
  description: "Katalog & peminjaman barang unit IT RSUD Kotser.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning className={inter.variable}>
      <body>
        <NextTopLoader color="#0066CC" height={3} showSpinner={false} shadow="0 0 8px #0066CC" />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
