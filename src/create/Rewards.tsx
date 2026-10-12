// $RHOZE rewards card: balance, recent activity, and how-to-earn for public accounts.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import "./rewards.css";

const db = supabase as any;

export const REWARD_AMOUNTS = {
  release_published: 500,
  project_like: 25,
  role_application: 100,
  project_payment_per_dollar: 1,
} as const;

export type RewardEntry = {
  id: string;
  kind: string;
  amount: number;
  ref_id: string | null;
  reason: string | null;
  created_at: string;
};

export function formatRhoze(amount: number | null | undefined): string {
  const n = Number(amount ?? 0);
  return `${n.toLocaleString("en-US")} $RHOZE`;
}

const KIND_LABEL: Record<string, string> = {
  release_published: "Release published",
  project_like: "Liked a project",
  role_application: "Role application",
};

export function rewardEntryLabel(entry: Pick<RewardEntry, "kind" | "reason">): string {
  return entry.reason || KIND_LABEL[entry.kind] || entry.kind;
}

export function RewardsCard({ userId }: { userId: string }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [entries, setEntries] = useState<RewardEntry[]>([]);
  const [err, setErr] = useState(false);
  const [sends, setSends] = useState<{ id: string; amount: number; status: string; tx_signature: string | null; created_at: string }[]>([]);
  const [amt, setAmt] = useState("");
  const [wallet, setWallet] = useState("");
  const [sendMsg, setSendMsg] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    db.from("rhoze_send_requests").select("id,amount,status,tx_signature,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10).then(({ data }: any) => setSends(data || []));
  }, [userId, tick]);

  const requestSend = async () => {
    setSendMsg("");
    const n = Math.floor(Number(amt));
    if (!n || n < 1) { setSendMsg("Enter how much $RHOZE to send."); return; }
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet.trim())) { setSendMsg("Enter a valid Solana wallet address."); return; }
    const { error } = await db.rpc("request_rhoze_send", { p_amount: n, p_wallet: wallet.trim() });
    if (error) { setSendMsg(error.message.includes("insufficient") ? "That's more than your balance." : "Couldn't send the request. Try again."); return; }
    setAmt(""); setSendMsg("Request sent. The team will send your $RHOZE and post the transaction here."); setTick((t) => t + 1);
  };

  useEffect(() => {
    let off = false;
    db.rpc("my_rewards").then(({ data, error }: any) => {
      if (off) return;
      if (error || !data) { setErr(true); return; }
      const row = Array.isArray(data) ? data[0] : data;
      setBalance(Number(row?.balance ?? 0));
      setEntries((row?.entries ?? []) as RewardEntry[]);
    });
    return () => { off = true; };
  }, [userId, tick]);

  return (
    <section className="rz-pf-sec rz-rewards-card" aria-label="$RHOZE rewards">
      <h2>$RHOZE rewards</h2>
      <div className="rz-rewards-balance">
        <span className="rz-rewards-balance-label">Your balance</span>
        <strong>{err ? "—" : formatRhoze(balance)}</strong>
      </div>

      <div className="rz-sup-block">
        <h3>Recent activity</h3>
        {err ? (
          <p className="rz-pf-empty">Couldn't load your rewards right now.</p>
        ) : balance === null ? (
          <p className="rz-pf-empty">Loading…</p>
        ) : !entries.length ? (
          <p className="rz-pf-empty">No activity yet. Start earning $RHOZE below.</p>
        ) : (
          <ul className="rz-rewards-list">
            {entries.map((e) => (
              <li key={e.id}>
                <span>{rewardEntryLabel(e)}</span>
                <b>{e.amount < 0 ? "−" : "+"}{formatRhoze(Math.abs(e.amount))}</b>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rz-sup-block">
        <h3>How to earn</h3>
        <ul className="rz-rewards-list rz-rewards-earn">
          <li><span>Get a release published</span><b>+{formatRhoze(REWARD_AMOUNTS.release_published)}</b></li>
          <li><span>Like a project</span><b>+{formatRhoze(REWARD_AMOUNTS.project_like)}</b></li>
          <li><span>Submit a role application</span><b>+{formatRhoze(REWARD_AMOUNTS.role_application)}</b></li>
          <li><span>Pay toward a project (per $1)</span><b>+{formatRhoze(REWARD_AMOUNTS.project_payment_per_dollar)}</b></li>
        </ul>
      </div>

      <div className="rz-sup-block">
        <h3>Send to my wallet</h3>
        <div className="rz-ws-row" style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
          <input className="rz-in" type="number" min={1} placeholder="Amount" value={amt} onChange={(e) => setAmt(e.target.value)} style={{ maxWidth: "8rem" }} aria-label="Amount of $RHOZE" />
          <input className="rz-in" placeholder="Solana wallet address" value={wallet} onChange={(e) => setWallet(e.target.value)} style={{ flex: 1, minWidth: "14rem" }} aria-label="Solana wallet address" />
          <button type="button" className="rz-btn pri" onClick={requestSend}>Request</button>
        </div>
        {sendMsg && <p className="rz-pf-empty">{sendMsg}</p>}
        {sends.length > 0 && (
          <ul className="rz-rewards-list">
            {sends.map((s) => (
              <li key={s.id}>
                <span>{formatRhoze(s.amount)} · {s.status === "pending" ? "Waiting for team" : s.status === "sent" ? "Sent" : "Declined, returned"}</span>
                {s.tx_signature && <a href={`https://solscan.io/tx/${s.tx_signature}`} target="_blank" rel="noreferrer">View transaction</a>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="rz-rewards-note">Real $RHOZE is sent on Solana by the Rhozeland team after review.</p>
    </section>
  );
}
