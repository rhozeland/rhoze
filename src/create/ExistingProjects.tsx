import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronDown, FolderOpen, ArrowUpRight } from "lucide-react";
import "./existing-projects.css";
export default function ExistingProjects({ expandedBar = false }: { expandedBar?: boolean }) {
  const [rows, setRows] = useState<{ id: string; title: string | null }[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session) supabase.rpc("my_releases").then(({ data }) => setRows((data || []).filter((r) => r.status !== "archived"))); }); }, []);
  if (!rows.length) return null;
  return <div className={`rz-existing ${expandedBar ? "rz-existing-bar" : ""}`}><Button variant="outline" size="sm" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="existing-projects-list"><FolderOpen size={16} /><span>Existing Projects</span><small>{rows.length}</small><ChevronDown size={15} /></Button>{open && <div id="existing-projects-list">{rows.map((r) => <a className="rz-drafts-row" href={`/workspace/${r.id}`} key={r.id}><span>{r.title || "Untitled project"}</span><ArrowUpRight size={15} /></a>)}</div>}</div>;
}
