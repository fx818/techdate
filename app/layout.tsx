import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import AwaitSplash from "@/components/AwaitSplash";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Await — where connections are worth the await",
  description: "A platform for tech professionals to discuss, connect, and date. Earn your way in, then meet someone who builds like you do.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${hanken.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <link rel="preconnect" href="https://ynfkwndtmoajcmjppftp.supabase.co" crossOrigin="" />
        <link rel="dns-prefetch" href="https://ynfkwndtmoajcmjppftp.supabase.co" />
        <AwaitSplash />
        {children}
      </body>
    </html>
  );
}
