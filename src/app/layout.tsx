import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RemoveServiceWorkers } from "@/components/remove-service-workers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Locatify Guides",
  description: "Product tours, checklists, announcements and hotspots for your app.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <RemoveServiceWorkers />
        {children}
      </body>
    </html>
  );
}
