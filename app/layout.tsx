import type { Metadata } from "next";
import { Anton, Caveat, DM_Sans, Fraunces, Space_Grotesk } from "next/font/google";
import { headers } from "next/headers";
import { AuthRedirectHandler } from "./components/auth-redirect-handler";
import "./globals.css";

const sans = DM_Sans({ variable: "--font-sans", subsets: ["latin"] });
const serif = Fraunces({ variable: "--font-serif", subsets: ["latin"] });
const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"] });
const hand = Caveat({ variable: "--font-hand", subsets: ["latin"] });
const display = Anton({ variable: "--font-display", weight: "400", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "Brilla — Portafolios para creadoras UGC",
    description: "Crea gratis en 2 minutos un portafolio UGC responsivo con video, métricas, enlace profesional y PDF.",
    openGraph: {
      title: "Brilla — Tu portafolio UGC gratis en 2 minutos",
      description: "Web responsiva, video, métricas y PDF. Todo en un único enlace profesional.",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "Brilla, portafolios para creadoras UGC" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Brilla — Tu portafolio UGC gratis en 2 minutos",
      description: "Web responsiva, video, métricas y PDF. Todo en un único enlace profesional.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${sans.variable} ${serif.variable} ${grotesk.variable} ${hand.variable} ${display.variable}`}><AuthRedirectHandler />{children}</body>
    </html>
  );
}
