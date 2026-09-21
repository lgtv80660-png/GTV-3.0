import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/Navigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "G-TV 3.0",
  description: "IPTV Streaming Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      <body className={`${inter.className} bg-[#080b10] text-white antialiased overflow-hidden h-screen w-screen flex`}>
        <Navigation />
        <main className="flex-1 h-full min-w-0 relative overflow-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}