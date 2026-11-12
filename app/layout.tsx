import type { Metadata } from "next";
import "./globals.css";
import "./terminal.css";

export const metadata: Metadata = {
  title: "Symbiotic V3 | Native Amadeus Spot Research",
  description: "Evidence-first Amadeus public testnet spot research for TESTBTC/AMA and TESTUSD/AMA. Read-only terminal and risk dashboard; live swaps disabled.",
};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
