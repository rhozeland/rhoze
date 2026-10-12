// $RHOZE rewards card: balance, recent activity, and how-to-earn for public accounts.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import "./rewards.css";

const db = supabase as any;

export const REWARD_AMOUNTS = {
  release_published: 500,
  project_like: 25,
  role_application: 100,
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
  }, [userId]);

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
                <b>+{formatRhoze(e.amount)}</b>
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
        </ul>
      </div>

      <p className="rz-rewards-note">
        Use rewards for discounts on Rhozeland projects — coming soon. Withdraw to your wallet — coming soon.
      </p>
    </section>
  );
}
