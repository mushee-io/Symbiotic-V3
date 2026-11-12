import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Interactive AMA Trading Demo | Symbasis",
  description: "Immediately usable browser-local simulated TESTBTC/AMA and TESTUSD/AMA spot trading and market making. Real native testnet settlement remains separate.",
};

export default function TradeLayout({children}:{children:React.ReactNode}) {
  return children;
}
