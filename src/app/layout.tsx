import type { Metadata, Viewport } from "next";
import { Geist_Mono, Roboto } from "next/font/google";
import { AccountProvider } from "@/components/providers/account-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";
import "./globals.css";

const roboto = Roboto({ variable: "--font-roboto", subsets: ["latin"], weight: ["300", "400", "500", "700"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Land in Coorg — Verified Coffee Estates, Farmland & Plots for Sale",
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Find verified coffee estates, agricultural farmland, residential plots, and plantation bungalows for sale across Coorg (Kodagu), Karnataka. Legal RTC Pahani, Kaveri EC & title verified.",
  applicationName: SITE_NAME,
  keywords: [
    "Land in Coorg",
    "Coffee estates for sale in Coorg",
    "Farmland for sale in Coorg",
    "Agricultural land in Kodagu",
    "Buy coffee plantation in Coorg",
    "Plots for sale in Madikeri",
    "Properties in Kushalnagar",
    "Land in Virajpet",
    "Somwarpet estates",
    "Gonikoppal farmland",
    "Jamma Bane land Coorg",
    "Kodagu RTC Pahani verification",
    "Homestays for sale in Coorg",
    "Plantation bungalows Coorg",
    "Karnataka farmland purchase rules",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "Land in Coorg — Verified Coffee Estates, Farmland & Plots for Sale",
    description:
      "Browse 100+ verified coffee plantations, farmland, residential plots, and estate homes across Coorg (Kodagu). Every listing is legally reviewed before publishing.",
    locale: "en_IN",
    url: siteUrl("/"),
    images: [
      {
        url: "/images/hero-coorg-landscape.webp",
        width: 1200,
        height: 800,
        alt: "Verified Coffee Estates and Farmland in Coorg, Karnataka",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Land in Coorg — Verified Coffee Estates, Farmland & Plots",
    description:
      "Browse verified coffee plantations, farmland, residential plots, and estate homes across Coorg (Kodagu).",
    images: ["/images/hero-coorg-landscape.webp"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  other: {
    "geo.region": "IN-KA",
    "geo.placename": "Coorg, Kodagu, Karnataka, India",
    "geo.position": "12.4244;75.7382",
    ICBM: "12.4244, 75.7382",
  },
};

export const viewport: Viewport = {
  themeColor: "#24553b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${roboto.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <AccountProvider>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </AccountProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
