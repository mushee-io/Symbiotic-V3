import * as React from "react";
import { TerminalViewPage } from "@/components/TerminalViews";
export const metadata = { title: "Liquidity | Symbasis", description: "Symbasis terminal on Amadeus Protocol public testnet." };
export default function Page() { return <TerminalViewPage view="liquidity" />; }
