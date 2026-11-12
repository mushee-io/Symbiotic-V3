export const TEST_ASSETS = ["TESTBTC","TESTUSD"] as const;
export const MARKETS = TEST_ASSETS.map((base) => ({id:base+"-AMA",base,quote:"AMA" as const,label:base+" / AMA",enabled:false}));
export const COMING_SOON = ["Perpetuals","RWA","Notional","Options"] as const;
