import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://granary-one.vercel.app"),
  title: {
    default: "Granary — Validate, enrich, and edit massive product catalogs",
    template: "%s · Granary",
  },
  description:
    "A full-stack workspace for high-volume product data. 500,000-row virtualized catalog, AI enrichment over Claude, validation queues, real-time SSE — built end-to-end in Next.js + Supabase.",
  applicationName: "Granary",
  authors: [{ name: "Thiago Costa" }],
  keywords: [
    "product data",
    "e-commerce",
    "data validation",
    "data enrichment",
    "virtualized table",
    "Next.js",
    "TypeScript",
    "Supabase",
    "Claude",
  ],
  openGraph: {
    type: "website",
    siteName: "Granary",
    title: "Granary — Validate, enrich, and edit massive product catalogs at speed",
    description:
      "500,000-row virtualized catalog, AI enrichment over Claude, validation queues, real-time SSE. Built end-to-end in Next.js + Supabase.",
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Granary — Validate, enrich, and edit massive product catalogs at speed",
    description:
      "500,000-row virtualized catalog, AI enrichment, validation queues, real-time SSE. Next.js + Supabase, end-to-end.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#141414",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground flex flex-col">
        <QueryProvider>
          <TooltipProvider>
            {children}
            <Toaster
              position="bottom-right"
              theme="dark"
              toastOptions={{
                classNames: {
                  toast:
                    "border border-border bg-popover text-popover-foreground",
                },
              }}
            />
          </TooltipProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
