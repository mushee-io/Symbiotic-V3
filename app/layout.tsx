import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata={title:"Symbiotic V3 | Amadeus Native Spot",description:"Two AMA-paired spot test markets. Native Amadeus testnet."};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>;}
