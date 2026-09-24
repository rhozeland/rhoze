import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shell, money } from "./shared";

export default function ReleasePage({ slug }: { slug: string }) {
  const [r, setR] = useState<any>(undefined);

  useEffect(() => {
    (supabase.from as any)("releases")
      .select("title,creator_name,answers,budget_cents,artist_pct,fee_pct,cause_pct,cause_name,milestones,coin_mint,coin_ticker,coin_name,coin_image,published_at")
      .eq("slug", slug).eq("status", "published").maybeSingle()
      .then(({ data }: any) => {
        setR(data ?? null);
        if (data) document.title = `${data.title} — Rhozeland`;
      });
  }, [slug]);

  return (
    <Shell right={<a className="rz-link" href="/create.html?new=1">Create a project</a>}>
      <div className="rz-card">
        {r === undefined && <><div className="rz-skel" /><div className="rz-skel" /><div className="rz-skel" /></>}
        {r === null && (
          <div className="rz-head"><h1>Project not found</h1><p>This page may be unpublished or the link is wrong.</p>
            <div className="rz-actions"><a className="rz-btn pri" href="/">Back to home</a></div></div>
        )}
        {r && (
          <>
            <div className="rz-head" style={{ marginBottom: "1.2rem" }}>
              <span className="rz-pill">Release</span>
              <h1 style={{ marginTop: ".6rem", fontSize: "1.6rem" }}>{r.title}</h1>
              <p>by <b>{r.creator_name || "Rhozeland artist"}</b></p>
            </div>
            {r.answers?.making && <p style={{ fontSize: ".85rem", lineHeight: 1.5, textAlign: "center", maxWidth: 520, margin: "0 auto 1.2rem" }}>{r.answers.making}</p>}

            <div className="rz-split" style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".75rem", fontWeight: 600 }}><span>Budget</span><span>{money(r.budget_cents)}</span></div>
              <div className="rz-bar">
                <i className="rz-c-a" style={{ width: `${r.artist_pct}%` }} /><i className="rz-c-f" style={{ width: `${r.fee_pct}%` }} /><i className="rz-c-c" style={{ width: `${r.cause_pct}%` }} />
              </div>
              {[["rz-c-a", "Artist", r.artist_pct], ["rz-c-f", "Rhozeland fee", r.fee_pct], ["rz-c-c", r.cause_name ? `Cause · ${r.cause_name}` : "Cause", r.cause_pct]].map(([c, l, p]) => (
                <div className="rz-split-row" key={l as string}><span className={`rz-sw ${c}`} /><span>{l}</span><span className="rz-amt" style={{ fontWeight: 500 }}>{Number(p)}%</span><span className="rz-amt">{money(r.budget_cents * Number(p) / 100)}</span></div>
              ))}
            </div>

            <div className="rz-inv">
              <div className="rz-inv-h" style={{ gridTemplateColumns: "1.6rem 1fr 1.4fr 7rem" }}><span>#</span><span>Milestone</span><span>Deliverable</span><span style={{ textAlign: "right" }}>Amount</span></div>
              {(r.milestones || []).map((m: any, i: number) => (
                <div key={i} className="rz-row" style={{ gridTemplateColumns: "1.6rem 1fr auto", fontSize: ".78rem" }}>
                  <span className="rz-num" style={{ paddingTop: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                  <div><b>{m.title}</b><div style={{ color: "hsl(var(--mut))", fontSize: ".72rem", marginTop: ".15rem" }}>{m.deliverable}</div></div>
                  <span className="rz-amt">{money(m.amount_cents)}</span>
                </div>
              ))}
            </div>

            {r.coin_mint && r.coin_ticker && (
              <div className="rz-coin" style={{ display: "inline-flex", padding: ".45rem .8rem .45rem .45rem", borderRadius: 999, gap: ".55rem" }}>
                {r.coin_image && <img src={r.coin_image} alt={r.coin_ticker} style={{ width: 28, height: 28, borderRadius: "50%" }} />}
                <div><b style={{ fontSize: ".8rem" }}>Hold ${r.coin_ticker} to unlock</b><small>Attached on Pump.fun</small></div>
              </div>
            )}
            <div className="rz-actions"><a className="rz-btn pri" href="/">Back to home</a></div></div>
        )}
        {r && (
          <>
            <div className="rz-head" style={{ marginBottom: "1.2rem" }}>
              <span className="rz-pill">Release</span>
              <h1 style={{ marginTop: ".6rem", fontSize: "1.6rem" }}>{r.title}</h1>
              <p>by <b>{r.creator_name || "Rhozeland artist"}</b></p>
            </div>
            {r.answers?.making && <p style={{ fontSize: ".85rem", lineHeight: 1.5, textAlign: "center", maxWidth: 520, margin: "0 auto 1.2rem" }}>{r.answers.making}</p>}

            <div className="rz-split" style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".75rem", fontWeight: 600 }}><span>Budget</span><span>{money(r.budget_cents)}</span></div>
              <div className="rz-bar">
                <i className="rz-c-a" style={{ width: `${r.artist_pct}%` }} /><i className="rz-c-f" style={{ width: `${r.fee_pct}%` }} /><i className="rz-c-c" style={{ width: `${r.cause_pct}%` }} />
              </div>
              {[["rz-c-a", "Artist", r.artist_pct], ["rz-c-f", "Rhozeland fee", r.fee_pct], ["rz-c-c", r.cause_name ? `Cause · ${r.cause_name}` : "Cause", r.cause_pct]].map(([c, l, p]) => (
                <div className="rz-split-row" key={l as string}><span className={`rz-sw ${c}`} /><span>{l}</span><span className="rz-amt" style={{ fontWeight: 500 }}>{Number(p)}%</span><span className="rz-amt">{money(r.budget_cents * Number(p) / 100)}</span></div>
              ))}
            </div>

            <div className="rz-inv">
              <div className="rz-inv-h" style={{ gridTemplateColumns: "1.6rem 1fr 1.4fr 7rem" }}><span>#</span><span>Milestone</span><span>Deliverable</span><span style={{ textAlign: "right" }}>Amount</span></div>
              {(r.milestones || []).map((m: any, i: number) => (
                <div key={i} className="rz-row" style={{ gridTemplateColumns: "1.6rem 1fr auto", fontSize: ".78rem" }}>
                  <span className="rz-num" style={{ paddingTop: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                  <div><b>{m.title}</b><div style={{ color: "hsl(var(--mut))", fontSize: ".72rem", marginTop: ".15rem" }}>{m.deliverable}</div></div>
                  <span className="rz-amt">{money(m.amount_cents)}</span>
                </div>
              ))}
            </div>

            {r.coin_mint && (
              <a className="rz-coin" style={{ textDecoration: "none", color: "inherit" }} href={`https://pump.fun/coin/${r.coin_mint}`} target="_blank" rel="noreferrer">
                {r.coin_image && <img src={r.coin_image} alt={r.coin_ticker} />}
                <div style={{ minWidth: 0, flex: 1 }}><b>${r.coin_ticker}</b> <span className="rz-opt" style={{ fontSize: ".72rem" }}>{r.coin_name}</span><small>{r.coin_mint}</small></div>
                <span className="rz-btn pri">Buy on Pump.fun</span>
              </a>
            )}
            <div className="rz-actions">
              <button className="rz-btn" onClick={() => navigator.clipboard?.writeText(location.href)}>Copy link</button>
              <a className="rz-btn pri" href="/book/">Book a project</a>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
