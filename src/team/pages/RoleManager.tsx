import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

type Role = "admin" | "employee" | "client";
const ROLES: Role[] = ["admin", "employee", "client"];
type Dept = "marketing" | "hr" | "development" | "sales";
const DEPTS: { value: Dept; label: string }[] = [
  { value: "marketing", label: "Marketing" },
  { value: "hr", label: "HR" },
  { value: "development", label: "Development" },
  { value: "sales", label: "Sales" },
];

export default function RoleManager() {
  const qc = useQueryClient();
  const [picks, setPicks] = useState<Record<string, Role>>({});
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});

  const { data: profiles } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, display_name, department, job_title").order("display_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: rolesByUser } = useQuery({
    queryKey: ["all-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role, id");
      if (error) throw error;
      const map: Record<string, { role: Role; id: string }[]> = {};
      (data ?? []).forEach((r) => {
        (map[r.user_id] = map[r.user_id] || []).push({ role: r.role as Role, id: r.id });
      });
      return map;
    },
  });

  const grant = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Role granted" });
      qc.invalidateQueries({ queryKey: ["all-roles"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Role removed" });
      qc.invalidateQueries({ queryKey: ["all-roles"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const setDept = useMutation({
    mutationFn: async ({ userId, department }: { userId: string; department: Dept | null }) => {
      const { error } = await supabase.from("profiles").update({ department }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Department updated" });
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const setTitle = useMutation({
    mutationFn: async ({ userId, job_title }: { userId: string; job_title: string | null }) => {
      const { error } = await supabase.from("profiles").update({ job_title }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Job title updated" });
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Role manager</h1>
        <p className="text-sm text-muted-foreground">Grant team access and assign department / job title. New users have no role until you assign one.</p>
      </header>

      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3 w-44">Department</th>
              <th className="px-4 py-3 w-56">Job title</th>
              <th className="px-4 py-3">Current roles</th>
              <th className="px-4 py-3 w-72">Add role</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p: any) => {
              const cur = rolesByUser?.[p.id] ?? [];
              const titleVal = titleDrafts[p.id] ?? p.job_title ?? "";
              return (
                <tr key={p.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.display_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{p.id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={p.department ?? "__none"}
                      onValueChange={(v) => setDept.mutate({ userId: p.id, department: v === "__none" ? null : (v as Dept) })}
                    >
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Unassigned</SelectItem>
                        {DEPTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      className="h-9"
                      placeholder="e.g. Lead Designer"
                      value={titleVal}
                      onChange={(e) => setTitleDrafts({ ...titleDrafts, [p.id]: e.target.value })}
                      onBlur={() => {
                        const next = (titleDrafts[p.id] ?? "").trim();
                        if (next !== (p.job_title ?? "")) {
                          setTitle.mutate({ userId: p.id, job_title: next || null });
                        }
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {cur.length === 0 && <span className="text-xs text-muted-foreground">none</span>}
                      {cur.map((r) => (
                        <span key={r.id} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded">
                          {r.role}
                          <button onClick={() => revoke.mutate(r.id)} className="hover:text-destructive"><Trash2 size={12} /></button>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Select value={picks[p.id] ?? "employee"} onValueChange={(v) => setPicks({ ...picks, [p.id]: v as Role })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button size="sm" onClick={() => grant.mutate({ userId: p.id, role: picks[p.id] ?? "employee" })}>Add</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}