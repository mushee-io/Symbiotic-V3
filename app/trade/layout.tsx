import type { Metadata } from "next";

export const metadata:Metadata={
  title:"Trade | Symbasis",
  description:"Amadeus-native AMA spot terminal for TESTBTC/AMA and TESTUSD/AMA. Read-only verified market state with wallet-approved test-token setup; spot execution remains unavailable.",
};

export default function TradeLayout({children}:{children:React.ReactNode}){
  return children;
}
