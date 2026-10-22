import { useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtSlot } from "./call-slots";

export type ProjectCallRow = { release_id: string; slot_start: string; paid_credits: number };
let cache: Promise<ProjectCallRow[]> | null = null;
export const loadMyCalls = () => (cache ||= (supabase.rpc as any)("my_project_calls").then(({ data }: any) => data || []));

/** Shows the booked call for a project the signed-in owner has. */
export default function ProjectCall({ releaseId, compact = false }: { releaseId: string; compact?: boolean }) {
  const [row, setRow] = useState<ProjectCallRow | null>(null);
  useEffect(() => { loadMyCalls().then((rs) => setRow(rs.filter((x) => x.release_id === releaseId).sort((a, b) => a.slot_start.localeCompare(b.slot_start)).pop() || null)); }, [releaseId]);
  if (!row) return null;
  const when = fmtSlot(new Date(row.slot_start));
  if (compact) return <small style={{ display: "inline-flex", gap: ".25rem", alignItems: "center", opacity: .75 }}><CalendarCheck size={12} />{when}</small>;
  const fresh = new URLSearchParams(location.search).get("booked");
  return (
    <div className="rz-split" role="status" style={{ marginBottom: ".9rem" }}>
      <div className="rz-split-row" style={{ gridTemplateColumns: "auto 1fr" }}><CalendarCheck size={16} /><b>{fresh ? "You're booked! " : ""}Call with Rhozeland · {when}{row.paid_credits ? ` · paid with ${row.paid_credits} credit` : ""}</b></div>
    </div>
  );
}
