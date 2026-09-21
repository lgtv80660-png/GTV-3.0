import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Navigation } from "@/components/Navigation";
import Providers from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "G-TV | Premium",
  description: "Plateforme hybride Live & VOD",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      {/* Correction appliquée sur la ligne suivante : ajout des backticks */}
      <body className={${inter.className} bg-background text-white antialiased overflow-hidden select-none}>
        <Providers>
          <div className="flex h-screen w-full relative">
            
            <Navigation/>
            
            <main className="flex-1 relative overflow-y-auto pb-16 md:pb-0 md:ml-16 bg-surface/30">
              {children}
            </main>
            
          </div>
        </Providers>
      </body>
    </html>
  );
}
