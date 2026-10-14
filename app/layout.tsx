import {SessionMigration} from '@/components/SessionMigration';
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { Navigation } from "@/components/Navigation";
import Providers from "@/components/providers";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "G-TV | Premium",
  description: "Plateforme hybride Live & VOD",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      <body
        className={`${inter.className} overflow-hidden bg-background text-white antialiased select-none`}
      >
        <Providers>
          <SessionMigration />
          <div className="fixed inset-0 flex h-[100dvh] w-full flex-col overflow-hidden lg:flex-row">
            <Navigation />

            <main className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden bg-surface/30">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}