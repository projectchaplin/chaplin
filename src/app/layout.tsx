import type { Metadata } from "next";
import { Poppins, Playfair_Display, Inter } from "next/font/google";
import "lenis/dist/lenis.css";
import "./globals.css";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
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
  title: "Project Chaplin: Casting Marketplace for AI Characters",
  description:
    "Build characters, cast them into stories, and watch performers build a career of their own.",
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
        <main className="flex-1 flex flex-col relative z-10 pb-24">{children}</main>
        <footer className="border-t border-line relative z-10 pb-24">
          <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-grey">
            <span className="marquee-title text-sm tracking-widest text-ink">
              PROJECT CHAPLIN
            </span>
            <span>A casting marketplace for AI characters. Every character, every audience.</span>
          </div>
        </footer>
        <BottomNav />
      </body>
    </html>
  );
}
