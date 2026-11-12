import {NextResponse} from "next/server";
import {nativeTestnetSdk} from "@/lib/amadeus";
export const dynamic="force-dynamic";
export async function GET(){
try{const tip=await nativeTestnetSdk().chain.getTip(); const height=Number(tip.entry.header.height);
if(!Number.isSafeInteger(height)||height<0)throw new Error("Invalid height");
return NextResponse.json({status:"connected",network:"amadeus-testnet",height},{headers:{"Cache-Control":"no-store"}});
}catch{return NextResponse.json({status:"unavailable",network:"amadeus-testnet",height:null},{status:503,headers:{"Cache-Control":"no-store"}});}
}
