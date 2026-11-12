import type { Metadata } from "next";

export const metadata:Metadata={
  title:"Spot Trading Terminal | Symbiotic V3",
  description:"Amadeus-native AMA spot terminal for TESTBTC/AMA and TESTUSD/AMA. Read-only verified market state; native trading, minting and signing not yet enabled.",
};

export default function TradeLayout({children}:{children:React.ReactNode}){
  return children;
}
