// Real Solana wallet connection (Phantom + Solflare) for public release pages.
import { Buffer } from "buffer";
if (typeof window !== "undefined" && !(window as any).Buffer) (window as any).Buffer = Buffer;

import { useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import "@solana/wallet-adapter-react-ui/styles.css";

export function SolanaWalletProvider({ children, onError }: { children: ReactNode; onError?: () => void }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint="https://api.mainnet-beta.solana.com">
      <WalletProvider wallets={wallets} autoConnect onError={() => onError?.()}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

// Balance via our backend lookup (reliable RPC), never exposes raw errors.
export async function fetchTokenBalance(owner: string, mint: string): Promise<number> {
  const base = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/wallet-lookup`;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const r = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ address: owner, mint }),
  });
  if (!r.ok) throw new Error("lookup");
  const j = await r.json();
  if (typeof j?.balance !== "number") throw new Error("lookup");
  return j.balance;
}
