import { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Shell } from "./shared";
import AuthModal from "./AuthModal";

type Row = { id: string; slug: string | null; title: string; status: string; cover_url: string | null; coin_image: string | null; updated_at: string; answers: any };
const FILTERS = ["All", "Draft", "Published", "Archived"] as const;
const label = (s: string) => (s === "published" ? "Published" : s === "archived" ? "Archived" : "Draft");

export default function MyProjects() {
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
  const [rows, setRows] = useState<Row[] | undefined>(undefined);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(() => {
    const f = new URLSearchParams(location.search).get("filter");
    return f === "archived" ? "Archived" : f === "draft" ? "Draft" : f === "published" ? "Published" : "All";
  });
  const [menu, setMenu] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const [note, setNote] = useState("");

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setSignedIn(!!session);
    if (!session) return;
    const token = localStorage.getItem("rz_release_token");
    if (token) await (supabase.rpc as any)("release_claim", { p_token: token });
    const { data } = await (supabase.rpc as any)("my_releases");
    setRows((data ?? []) as Row[]);
  };
  useEffect(() => {
    document.title = "My projects | Rhozeland";
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") load(); });
    const close = () => setMenu(null);
    document.addEventListener("click", close);
    return () => { sub.subscription.unsubscribe(); document.removeEventListener("click", close); };
  }, []);

  const setArchived = async (r: Row, archived: boolean) => {
    const { error } = await (supabase.rpc as any)("release_set_archived", { p_id: r.id, p_archived: archived });
    if (error) return setNote("Something went wrong. Please try again.");
    setRows((x) => x?.map((y) => (y.id === r.id ? { ...y, status: archived ? "archived" : "published" } : y)));
  };
  const del = async (r: Row) => {
    if (r.cover_url) { const m = r.cover_url.match(/\/avatars\/(covers\/.+)$/); if (m) await supabase.storage.from("avatars").remove([m[1]]); }
    const { error } = await (supabase.rpc as any)("release_delete", { p_id: r.id });
    setConfirm(null);
    if (error) return setNote("Could not delete. Please try again.");
    setRows((x) => x?.filter((y) => y.id !== r.id));
  };

  const visible = rows?.filter((r) => filter === "All" || label(r.status) === filter);

  return (
    <Shell right={<a className="rz-link" href="/create.html?new=1">Create a project</a>}>
      <div className="rz-card rz-card-wide">
        <div className="rz-head"><h1>My projects</h1><p>Everything you've created, on any device.</p></div>
        {signedIn === false && (
          <AuthModal onClose={() => (location.href = "/")} onDone={load} redirectTo={`${location.origin}/my-projects`}
            intro="Sign in to see and manage your projects." />
        )}
        {signedIn && (
          <>
            <div className="rz-chips">
              {FILTERS.map((f) => (
                <button key={f} className={`rz-chipbtn ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>
                  {f}{rows ? ` (${f === "All" ? rows.length : rows.filter((r) => label(r.status) === f).length})` : ""}
                </button>
              ))}
            </div>
            {rows === undefined && <><div className="rz-skel" /><div className="rz-skel" /></>}
            {visible && visible.length === 0 && (
              <div className="rz-empty"><p>No {filter === "All" ? "" : filter.toLowerCase() + " "}projects yet.</p><a className="rz-btn pri" href="/create.html?new=1">Create a project</a></div>
            )}
            <ul className="rz-my">
              {visible?.map((r) => {
                const img = r.cover_url || r.coin_image;
                const href = r.status === "published" && r.slug ? `/release/${r.slug}` : `/create.html?draft=${r.id}`;
                return (
                  <li key={r.id} className="rz-my-row">
                    <a className="rz-my-thumb" href={href}>{img ? <img src={img} alt="" /> : <span>{(r.title || "?").charAt(0)}</span>}</a>
                    <a className="rz-my-main" href={href}>
                      <b>{r.title || "Untitled project"}</b>
                      <small>{r.answers?.project_type === "brand" ? "Brand" : "Artist"} · updated {new Date(r.updated_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</small>
                    </a>
                    <span className={`rz-my-status s-${r.status}`}>{label(r.status)}</span>
                    <div className="rz-my-menu" onClick={(e) => e.stopPropagation()}>
                      <button className="rz-ico" aria-label={`Options for ${r.title}`} onClick={() => setMenu(menu === r.id ? null : r.id)}><MoreHorizontal size={15} /></button>
                      {menu === r.id && (
                        <div className="rz-my-pop">
                          <a href={`/create.html?draft=${r.id}`}>Edit</a>
                          {r.status === "published" && <button onClick={() => { setMenu(null); setArchived(r, true); }}>Archive</button>}
                          {r.status === "archived" && <button onClick={() => { setMenu(null); setArchived(r, false); }}>Unarchive</button>}
                          <button className="danger" onClick={() => { setMenu(null); setConfirm(r); }}>Delete</button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {note && <div className="rz-err">{note}</div>}
            <div style={{ textAlign: "center", marginTop: "1rem" }}><button className="rz-textlink" onClick={() => supabase.auth.signOut()}>Sign out</button></div>
          </>
        )}
      </div>
      {confirm && (
        <div className="rz-modal" onClick={() => setConfirm(null)}>
          <div className="rz-card" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="rz-head" style={{ marginBottom: 0 }}><h1>Delete “{confirm.title || "Untitled"}”?</h1>
              <p>This can't be undone. The roadmap, roles, applicants, cover art and receipts will be removed.</p>
              <div className="rz-actions"><button className="rz-btn" onClick={() => setConfirm(null)}>Cancel</button><button className="rz-btn pri" onClick={() => del(confirm)}>Delete forever</button></div></div>
          </div>
        </div>
      )}
    </Shell>
  );
}
