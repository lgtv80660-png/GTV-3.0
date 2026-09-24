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
      <body className={`${inter.className} bg-background text-white antialiased overflow-hidden select-none`}>
        <Providers>
          {/* LE VERROU GLOBAL : fixed inset-0 et h-[100dvh] empêchent le scroll élastique et le bug de la barre Safari */}
          <div className="fixed inset-0 w-full h-[100dvh] flex flex-col md:flex-row overflow-hidden">
            
            {/* La navigation est maintenant un enfant Flex direct */}
            <Navigation />
            
            {/* CONTENEUR PRINCIPAL : min-h-0 et min-w-0 forcent les enfants à respecter les limites de l'écran */}
            <main className="flex-1 flex min-h-0 min-w-0 relative bg-surface/30">
              {children}
            </main>
            
          </div>
        </Providers>
      </body>
    </html>
  );
}