import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronDown, FolderOpen, ArrowUpRight, Trash2 } from "lucide-react";
import "./existing-projects.css";
import ProjectCall from "./ProjectCall";
import { coinLaunchRequested } from "./project-flow";
export default function ExistingProjects({ expandedBar = false }: { expandedBar?: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session) supabase.rpc("my_releases").then(({ data }) => setRows((data || []).filter((r) => r.status !== "archived"))); }); }, []);
  const del = async (r: any) => {
    setErr("");
    const { error } = await (supabase.rpc as any)("release_delete", { p_id: r.id });
    if (error) { setConfirmId(null); return setErr("Could not delete. Please try again."); }
    const m = r.cover_url && String(r.cover_url).match(/\/avatars\/(covers\/.+)$/);
    if (m) supabase.storage.from("avatars").remove([m[1]]);
    setRows((list) => list.filter((x) => x.id !== r.id));
    setConfirmId(null);
  };
  if (!rows.length) return null;
  return <div className={`rz-existing ${expandedBar ? "rz-existing-bar" : ""}`}><Button variant="outline" size="sm" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="existing-projects-list"><FolderOpen size={16} /><span>Your projects · edit or delete</span><small>{rows.length}</small><ChevronDown size={15} /></Button>{open && <div id="existing-projects-list">{err && <p style={{ fontSize: 13, margin: "4px 8px" }}>{err}</p>}{rows.map((r) => <div className="rz-drafts-row" key={r.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <a href={r.status === "draft" ? `/create.html?draft=${r.id}` : `/workspace/${r.id}`} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, color: "inherit", textDecoration: "none", minWidth: 0 }}><span>{r.title || "Untitled project"} <small style={{ opacity: .6 }}>· {r.status === "draft" ? "Draft" : "Published"}</small> {coinLaunchRequested(r) && <small style={{ opacity: .75 }}>· Coin launch requested</small>} <ProjectCall releaseId={r.id} compact /></span><ArrowUpRight size={15} /></a>
    {confirmId === r.id
      ? <span style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12 }}>Delete forever?<Button size="sm" variant="destructive" onClick={() => del(r)}>Delete</Button><Button size="sm" variant="outline" onClick={() => setConfirmId(null)}>Keep</Button></span>
      : <Button size="sm" variant="ghost" aria-label={`Delete ${r.title || "project"}`} title="Delete project" onClick={() => setConfirmId(r.id)}><Trash2 size={15} /></Button>}
  </div>)}</div>}</div>;
}
