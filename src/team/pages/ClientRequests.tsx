import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Check, X as XIcon, Calendar, Sparkles } from "lucide-react";
import { formatDate } from "../lib/format";

/**
 * Standalone "Requests" surface — separate from any single project.
 * Lists every credit request the signed-in client has across all
 * projects, and lets them open a new request scoped to whichever
 * project they pick. Deductions still happen against the chosen
 * project's credit balance after team estimate + client approval.
 */
export default function ClientRequests() {
  const { loading, session, user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    project_id: "",
    kind: "custom" as "custom" | "catalog",
    package_id: "",
    title: "",
    description: "",
    requested_credits: "1",
  });

  const { data: projects } = useQuery({
    queryKey: ["client_requests_projects", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id,title,credit_balance,status")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const ids = (projects ?? []).map((p: any) => p.id);

  const { data: requests } = useQuery({
    queryKey: ["client_all_requests", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_requests")
        .select("*")
        .in("project_id", ids)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: packages } = useQuery({
    queryKey: ["catalog_credit_packages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_packages")
        .select("id,name,description,credits_cost,kind")
        .eq("is_active", true)
        .eq("kind", "a_la_carte")
        .order("sort_order");
      return data ?? [];
    },
  });

  const projectsById = useMemo(
    () => Object.fromEntries((projects ?? []).map((p: any) => [p.id, p])),
    [projects],
  );
  const selectedProject = projectsById[form.project_id];

  const submit = useMutation({
    mutationFn: async () => {
      if (!form.project_id) throw new Error("Pick a project");
      if (!form.title.trim()) throw new Error("Title required");
      const credits = Math.max(1, parseInt(form.requested_credits || "1", 10));
      const { error } = await supabase.from("credit_requests").insert({
        project_id: form.project_id,
        requested_by: user!.id,
        kind: form.kind,
        package_id: form.kind === "catalog" && form.package_id ? form.package_id : null,
        title: form.title.trim(),
        description: form.description.trim() || null,
        requested_credits: credits,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Request submitted", description: "The team will review and confirm scope." });
      setOpen(false);
      setForm({ project_id: "", kind: "custom", package_id: "", title: "", description: "", requested_credits: "1" });
      qc.invalidateQueries({ queryKey: ["client_all_requests"] });
    },
    onError: (e: any) => toast({ title: "Could not submit", description: e.message, variant: "destructive" }),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("credit_request_cancel", { _request_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client_all_requests"] }),
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("credit_request_client_approve", { _request_id: id, _client_notes: null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Approved", description: "Credits deducted and queued with the team." });
      qc.invalidateQueries({ queryKey: ["client_all_requests"] });
      qc.invalidateQueries({ queryKey: ["client_requests_projects"] });
      qc.invalidateQueries({ queryKey: ["client_layout_totals"] });
    },
    onError: (e: any) => toast({ title: "Approval failed", description: e.message, variant: "destructive" }),
  });

  const onPickPackage = (id: string) => {
    const p = (packages ?? []).find((x: any) => x.id === id);
    setForm((f) => ({
      ...f,
      package_id: id,
      title: p?.name || f.title,
      description: p?.description || f.description,
      requested_credits: String(p?.credits_cost ?? 1),
    }));
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!session) return <Navigate to="/client" replace />;

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-10 space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Use credits</div>
          <h1 className="text-2xl font-semibold mt-1">Requests</h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            One place for every credit request across your projects. The team reviews scope, sends a
            final estimate, and only then do you approve and spend.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus size={14} className="mr-1" /> New request</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New credit request</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Project *</Label>
                <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose project…" /></SelectTrigger>
                  <SelectContent>
                    {(projects ?? []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title} · {p.credit_balance ?? 0} cr available
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as any, package_id: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom request (variable credits)</SelectItem>
                    <SelectItem value="catalog">From catalog</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.kind === "catalog" && (
                <div className="space-y-1.5">
                  <Label>Service</Label>
                  <Select value={form.package_id} onValueChange={onPickPackage}>
                    <SelectTrigger><SelectValue placeholder="Choose a service…" /></SelectTrigger>
                    <SelectContent>
                      {(packages ?? []).map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} · {p.credits_cost} cr</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Mix revision on Track 02" />
              </div>
              <div className="space-y-1.5">
                <Label>Details</Label>
                <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What you need, deadlines, references…" />
              </div>
              <div className="space-y-1.5">
                <Label>Estimated credits</Label>
                <Input type="number" min={1} value={form.requested_credits} onChange={(e) => setForm({ ...form, requested_credits: e.target.value })} />
                <p className="text-[11px] text-muted-foreground">
                  Starting estimate. Team will confirm before any credits are deducted.
                  {selectedProject && <> Available: <strong>{selectedProject.credit_balance ?? 0} cr</strong>.</>}
                </p>
              </div>
              <a href="https://calendar.app.google/MWxuv9pVT4Y2P3kx9" target="_blank" rel="noreferrer" className="text-[11px] inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                <Calendar size={11} /> Or book a call to scope this together
              </a>
            </div>
            <DialogFooter>
              <Button onClick={() => submit.mutate()} disabled={submit.isPending}>Submit request</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {(requests ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No requests yet. Hit <strong className="text-foreground">New request</strong> to get started.
        </div>
      ) : (
        <ul className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          {(requests ?? []).map((r: any) => {
            const proj = projectsById[r.project_id];
            return (
              <li key={r.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {proj?.title ?? "Project"} · {formatDate(r.created_at)} · {r.kind} ·{" "}
                      <span className="tabular-nums">{r.estimated_credits ?? r.requested_credits} cr</span>
                    </div>
                  </div>
                  <StatusPill status={r.status} />
                </div>
                {r.description && <div className="text-xs text-muted-foreground whitespace-pre-wrap">{r.description}</div>}
                {r.team_notes && (
                  <div className="text-xs rounded-md bg-muted/40 px-2 py-1.5">
                    <span className="text-muted-foreground">Team note: </span>{r.team_notes}
                  </div>
                )}
                {r.status === "client_review" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" onClick={() => approve.mutate(r.id)} disabled={approve.isPending}>
                      <Check size={12} className="mr-1" /> Approve & spend {r.estimated_credits} cr
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => cancel.mutate(r.id)}>
                      <XIcon size={12} className="mr-1" /> Decline
                    </Button>
                    <a href="https://calendar.app.google/MWxuv9pVT4Y2P3kx9" target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 py-1.5">
                      <Calendar size={11} /> Book a call first
                    </a>
                  </div>
                )}
                {r.status === "pending_team" && (
                  <Button size="sm" variant="ghost" onClick={() => cancel.mutate(r.id)}>
                    <XIcon size={12} className="mr-1" /> Cancel request
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending_team: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    client_review: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    accepted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    rejected: "bg-destructive/15 text-destructive border-destructive/30",
    cancelled: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${map[status] ?? "bg-muted text-muted-foreground border-border"}`}>
      <Sparkles size={9} className="inline mr-1" />{status.replace("_", " ")}
    </span>
  );
}