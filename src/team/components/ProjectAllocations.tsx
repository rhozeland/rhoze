import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { useAuth } from "../lib/auth";
import { cn } from "@/lib/utils";

/**
 * Revenue-share allocations per project.
 * Each row = one team member + their share % of project revenue.
 * Used by the payroll runner to compute revshare amounts from collected payments.
 */
export default function ProjectAllocations({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ user_id: "", share_pct: "0", role_label: "" });

  const { data: rows } = useQuery({
    queryKey: ["project_allocations", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_allocations")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: team } = useQuery({
    queryKey: ["team_members_for_alloc"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "employee"]);
      const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, alias, email, job_title")
        .in("id", ids);
      return profs ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!form.user_id) throw new Error("Pick a team member");
      const pct = parseFloat(form.share_pct) || 0;
      const { error } = await supabase.from("project_allocations").insert({
        project_id: projectId,
        user_id: form.user_id,
        share_pct: pct,
        role_label: form.role_label || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Allocation added" });
      setForm({ user_id: "", share_pct: "0", role_label: "" });
      setAdding(false);
      qc.invalidateQueries({ queryKey: ["project_allocations", projectId] });
    },
    onError: (e: any) => toast({ title: "Couldn't add", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("project_allocations").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project_allocations", projectId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_allocations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Removed" });
      qc.invalidateQueries({ queryKey: ["project_allocations", projectId] });
    },
  });

  const profilesById = new Map((team ?? []).map((p: any) => [p.id, p]));
  const totalPct = (rows ?? []).reduce((s: number, r: any) => s + Number(r.share_pct || 0), 0);
  const overAllocated = totalPct > 100.001;

  const usedIds = new Set((rows ?? []).map((r: any) => r.user_id));
  const available = (team ?? []).filter((t: any) => !usedIds.has(t.id));

  return (
    <div className="border border-border rounded-lg bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <div className="text-sm font-semibold">Revenue share</div>
          <div className="text-xs text-muted-foreground">% of collected project revenue paid to each team member at payroll time.</div>
        </div>
        <div className={cn("text-xs tabular-nums px-2 py-1 rounded border",
          overAllocated ? "border-destructive text-destructive" : "border-border text-muted-foreground")}>
          {overAllocated && <AlertTriangle size={12} className="inline mr-1" />}
          {totalPct.toFixed(2)}% allocated
        </div>
      </div>

      <div className="divide-y divide-border">
        {(rows ?? []).length === 0 && (
          <div className="px-4 py-6 text-xs text-muted-foreground italic text-center">No revenue-share set. Add one below.</div>
        )}
        {(rows ?? []).map((r: any) => {
          const p: any = profilesById.get(r.user_id);
          return (
            <div key={r.id} className="grid grid-cols-12 gap-2 items-center px-4 py-2 text-sm">
              <div className="col-span-4 min-w-0">
                <div className="font-medium truncate">{p?.alias || p?.display_name || p?.email || "—"}</div>
                <div className="text-xs text-muted-foreground truncate">{p?.job_title || "Team member"}</div>
              </div>
              <Input
                className="col-span-3 h-8 text-xs"
                disabled={!isAdmin}
                placeholder="Role on this project"
                defaultValue={r.role_label ?? ""}
                onBlur={(e) => {
                  const v = e.target.value;
                  if (v !== (r.role_label ?? "")) update.mutate({ id: r.id, patch: { role_label: v || null } });
                }}
              />
              <div className="col-span-3 flex items-center gap-1">
                <Input
                  type="number" step="0.01" min="0" max="100"
                  className="h-8 text-xs text-right tabular-nums"
                  disabled={!isAdmin}
                  defaultValue={r.share_pct}
                  onBlur={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    if (v !== Number(r.share_pct)) update.mutate({ id: r.id, patch: { share_pct: v } });
                  }}
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <div className="col-span-2 flex justify-end">
                {isAdmin && (
                  <button onClick={() => remove.mutate(r.id)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isAdmin && (
        <div className="border-t border-border p-3">
          {!adding ? (
            <button onClick={() => setAdding(true)} className="w-full text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 rounded py-2 flex items-center justify-center gap-1.5">
              <Plus size={14} /> Add team member
            </button>
          ) : (
            <div className="grid grid-cols-12 gap-2 items-center">
              <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                <SelectTrigger className="col-span-4 h-8 text-xs"><SelectValue placeholder="Team member" /></SelectTrigger>
                <SelectContent>
                  {available.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.alias || t.display_name || t.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input className="col-span-3 h-8 text-xs" placeholder="Role label" value={form.role_label} onChange={(e) => setForm({ ...form, role_label: e.target.value })} />
              <div className="col-span-3 flex items-center gap-1">
                <Input type="number" step="0.01" min="0" max="100" placeholder="0.00" className="h-8 text-xs text-right tabular-nums" value={form.share_pct} onChange={(e) => setForm({ ...form, share_pct: e.target.value })} />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <div className="col-span-2 flex justify-end gap-1">
                <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => { setAdding(false); setForm({ user_id: "", share_pct: "0", role_label: "" }); }}>Cancel</Button>
                <Button size="sm" className="h-8 px-2 text-xs" disabled={add.isPending} onClick={() => add.mutate()}>Save</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}