// Supporter home: liked projects, held coins, unlocked perks, suggested creators.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SolanaWalletProvider, fetchTokenBalance } from "./SolanaWallet";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { RewardsCard } from "./Rewards";

const db = supabase as any;

function LikedList({ userId }: { userId: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    db.from("project_likes").select("created_at,releases(id,slug,title,creator_name,cover_url,coin_image)")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(12)
      .then(({ data }: any) => setRows((data ?? []).flatMap((l: any) => (l.releases ? [l.releases] : []))));
  }, [userId]);
  if (rows === null) return <p className="rz-pf-empty">Loading…</p>;
  if (!rows.length) return <p className="rz-pf-empty">No liked projects yet. <a className="rz-link" href="/discover">Browse projects to like →</a></p>;
  return (
    <div className="rz-sup-grid">
      {rows.map((r) => (
        <a key={r.id} className="rz-sup-card" href={`/release/${r.slug}`}>
          <span className="rz-sup-cover">{r.cover_url || r.coin_image ? <img src={r.cover_url || r.coin_image} alt="" loading="lazy" /> : <i>{r.title}</i>}</span>
          <b>{r.title}</b><small>{r.creator_name}</small>
        </a>
      ))}
    </div>
  );
}

type Held = { slug: string; title: string; creator_name: string; coin_ticker: string | null };

function WalletCoins() {
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const addr = publicKey?.toBase58() ?? "";
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [held, setHeld] = useState<Held[]>([]);

  useEffect(() => {
    if (!addr) { setState("idle"); setHeld([]); return; }
    let off = false;
    setState("loading");
    db.from("releases").select("slug,title,creator_name,coin_mint,coin_ticker").eq("status", "published").not("coin_mint", "is", null)
      .order("published_at", { ascending: false }).limit(40)
      .then(async ({ data }: any) => {
        const rels = data ?? [];
        const out: Held[] = [];
        for (const r of rels) {
          try {
            const bal = await fetchTokenBalance(addr, r.coin_mint);
            if (bal > 0) out.push({ slug: r.slug, title: r.title, creator_name: r.creator_name, coin_ticker: r.coin_ticker });
          } catch { /* skip unreadable mints */ }
        }
        if (!off) { setHeld(out); setState("done"); }
      });
    return () => { off = true; };
  }, [addr]);

  if (!connected) {
    return (
      <div className="rz-sup-empty">
        <p className="rz-pf-empty">Connect a Solana wallet to see which creator coins you hold.</p>
        <button type="button" className="rz-btn" onClick={() => setVisible(true)}>Connect wallet</button>
      </div>
    );
  }
  if (state === "loading") return <p className="rz-pf-empty">Checking your wallet…</p>;
  if (!held.length) return <p className="rz-pf-empty">No held creator coins yet. <a className="rz-link" href="/discover">Discover projects to support →</a></p>;
  return (
    <>
      <ul className="rz-pf-credits">
        {held.map((h) => (
          <li key={h.slug}><a href={`/release/${h.slug}`}><b>{h.coin_ticker ? `$${h.coin_ticker.replace(/^\$/, "")}` : h.title}</b><span>{h.title} · {h.creator_name}</span></a></li>
        ))}
      </ul>
      <h3 className="rz-sup-sub">Perks unlocked</h3>
      <ul className="rz-pf-credits">
        {held.map((h) => (
          <li key={`perk-${h.slug}`}><a href={`/release/${h.slug}/exclusive`}><b>Exclusive feed</b><span>{h.title} · Unlocked ↗</span></a></li>
        ))}
      </ul>
    </>
  );
}

function Suggested({ userId }: { userId: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    db.from("creator_directory").select("slug,display_name,photo_url,disciplines,account_kind").eq("is_public", true).neq("account_kind", "supporter")
      .order("created_at", { ascending: false }).limit(6)
      .then(({ data }: any) => setRows(data ?? []));
  }, [userId]);
  if (rows === null) return <p className="rz-pf-empty">Loading…</p>;
  if (!rows.length) return <p className="rz-pf-empty">No suggestions yet. <a className="rz-link" href="/discover">Discover creators →</a></p>;
  return (
    <div className="rz-sup-grid">
      {rows.map((c) => (
        <a key={c.slug} className="rz-sup-card" href={`/creator/${c.slug}`}>
          <span className="rz-sup-cover">{c.photo_url ? <img src={c.photo_url} alt="" loading="lazy" /> : <i>{c.display_name}</i>}</span>
          <b>{c.display_name}</b><small>{(c.disciplines ?? []).slice(0, 2).join(" · ")}</small>
        </a>
      ))}
    </div>
  );
}

export function SupporterHome({ userId, heading }: { userId: string; heading: string }) {
  const [walletErr, setWalletErr] = useState(false);
  return (
    <section className="rz-pf-sec rz-sup-home" aria-label={heading}>
      <h2>{heading}</h2>
      <RewardsCard userId={userId} />
      <div className="rz-sup-block"><h3>Projects I liked</h3><LikedList userId={userId} /></div>
      <div className="rz-sup-block">
        <h3>Coins I hold</h3>
        <SolanaWalletProvider onError={() => setWalletErr(true)}><WalletCoins /></SolanaWalletProvider>
        {walletErr && <p className="rz-pf-empty">Couldn't connect to your wallet. Please try again.</p>}
      </div>
      <div className="rz-sup-block"><h3>Suggested creators</h3><Suggested userId={userId} /></div>
    </section>
  );
}
