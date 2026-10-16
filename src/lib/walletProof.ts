import bs58 from "bs58";
import { supabase } from "@/integrations/supabase/client";

/** Message the server verifies: bound to the account, the wallet and a fresh timestamp. */
export function walletProofMessage(userId: string, pubkey: string, issued = new Date()) {
  return ["Rhozeland wallet link", `Account: ${userId}`, `Wallet: ${pubkey}`, `Issued: ${issued.toISOString()}`, "", "Signing proves you control this wallet. It costs nothing and moves no funds."].join("\n");
}

/** Asks Phantom/Solflare to sign, then links the wallet server-side. Throws a friendly error. */
export async function linkWalletWithProof(userId: string): Promise<string> {
  const w: any = (window as any).phantom?.solana ?? (window as any).solflare ?? (window as any).solana;
  if (!w?.signMessage) throw new Error("Open this page with Phantom or Solflare installed to link your wallet.");
  const res = await w.connect();
  const pubkey: string = (res?.publicKey ?? w.publicKey)?.toString();
  if (!pubkey) throw new Error("Wallet didn't share an address.");
  const message = walletProofMessage(userId, pubkey);
  const signed = await w.signMessage(new TextEncoder().encode(message), "utf8");
  const sigBytes: Uint8Array = signed?.signature ?? signed;
  const { data, error } = await supabase.functions.invoke("wallet-replace-external", {
    body: { pubkey, message, signature: bs58.encode(sigBytes) },
  });
  if (error || !data?.pubkey) throw new Error(data?.error || "Couldn't link wallet.");
  return data.pubkey as string;
}
