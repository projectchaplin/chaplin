import type { Metadata } from "next";
import { Poppins, Playfair_Display, Inter } from "next/font/google";
import "lenis/dist/lenis.css";
import "./globals.css";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";
import SmoothScroll from "@/components/SmoothScroll";

const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["700", "800", "900"],
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Project Chaplin: Casting Marketplace for AI Actors",
  description:
    "Build AI actors, cast them into stories, and watch performers build a career of their own.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${poppins.variable} ${playfair.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <SmoothScroll />
        <div className="ambient-glow" />
        <div className="grain" />
        <Header />
        <main className="flex-1 flex flex-col min-w-0 relative z-10 pb-24">{children}</main>
        <SiteFooter />
        <BottomNav />
      </body>
    </html>
  );
}
