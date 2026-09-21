import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";

export const metadata: Metadata = {
  title: "G-TV 3.0",
  description: "Plateforme de streaming hybride premium",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="antialiased bg-black text-white min-h-screen">
        <Navigation />
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}