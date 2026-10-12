import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
export default function ExistingProjects() {
  const [rows, setRows] = useState<{ id: string; title: string | null }[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session) supabase.rpc("my_releases").then(({ data }) => setRows((data || []).filter((r) => r.status !== "archived"))); }); }, []);
  if (!rows.length) return null;
  return <div className="rz-existing"><Button variant="ghost" size="sm" onClick={() => setOpen(!open)} aria-expanded={open}>Existing Projects</Button>{open && <div>{rows.map((r) => <a className="rz-drafts-row" href={`/workspace/${r.id}`} key={r.id}>{r.title || "Untitled project"}</a>)}</div>}</div>;
}
