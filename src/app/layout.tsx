import type { Metadata, Viewport } from "next";
import { Fraunces, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./prototype.css";
import "./globals.css";
import Toaster from "@/components/Toaster";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-fraunces" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-jakarta" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Seja Seu Guia",
  description: "O roteiro que se ajusta a você, até no meio da viagem.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#101B3B" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${jakarta.variable} ${jetbrains.variable}`}>
      <body>
        <div id="root">{children}</div>
        <Toaster />
      </body>
    </html>
  );
}
