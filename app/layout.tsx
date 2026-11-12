import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Symbiotic V3 | Amadeus AI Spot Trading",
  description: "Native Amadeus testnet spot trading with AMA-denominated tokens. AI liquidity agents, perpetuals and RWA on the roadmap.",
};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
