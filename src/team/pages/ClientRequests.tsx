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
import { Plus, Check, X as XIcon, Calendar, Sparkles, FolderOpen, FilePlus2, ExternalLink, Camera, Music2, Activity } from "lucide-react";
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
  const [scope, setScope] = useState<"existing" | "new">("existing");
  const [activeCat, setActiveCat] = useState<"visual" | "audio" | "development">("visual");
  const [form, setForm] = useState({
    project_id: "",
    kind: "custom" as "custom" | "catalog",
    package_id: "",
    title: "",
    description: "",
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
        .select("id,name,description,credits_cost,kind,category,sort_order")
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
      // Client doesn't estimate credits — team confirms scope and credit cost.
      // For catalog picks we still seed `requested_credits` from the package
      // so the team has a starting point; for custom requests it's just 1.
      const seedCredits =
        form.kind === "catalog" && form.package_id
          ? (packages ?? []).find((p: any) => p.id === form.package_id)?.credits_cost ?? 1
          : 1;
      const { error } = await supabase.from("credit_requests").insert({
        project_id: form.project_id,
        requested_by: user!.id,
        kind: form.kind,
        package_id: form.kind === "catalog" && form.package_id ? form.package_id : null,
        title: form.title.trim(),
        description: form.description.trim() || null,
        requested_credits: seedCredits,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Request submitted", description: "The team will review and confirm scope." });
      setOpen(false);
      setForm({ project_id: "", kind: "custom", package_id: "", title: "", description: "" });
      setScope("existing");
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
    }));
  };

  const CATS: { id: "visual" | "audio" | "development"; label: string; Icon: typeof Camera }[] = [
    { id: "visual", label: "Visual", Icon: Camera },
    { id: "audio", label: "Audio", Icon: Music2 },
    { id: "development", label: "Development", Icon: Activity },
  ];
  const catalogInCat = (packages ?? []).filter((p: any) => (p.category ?? "visual") === activeCat);

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
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Scope: existing project vs. new project */}
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">For</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScope("existing")}
                    className={`text-left rounded-lg px-3 py-2.5 border transition-colors ${
                      scope === "existing" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <FolderOpen size={13} /> Existing project
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Add work to a project you already have.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope("new")}
                    className={`text-left rounded-lg px-3 py-2.5 border transition-colors ${
                      scope === "new" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <FilePlus2 size={13} /> New project
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Start something fresh — we'll scope and quote it.</div>
                  </button>
                </div>
              </div>

              {scope === "new" ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm space-y-3">
                  <p className="text-muted-foreground">
                    New projects use the full intake flow so we can confirm scope, deposit and timeline together.
                  </p>
                  <Button asChild size="sm">
                    <a href="/start.html" target="_blank" rel="noreferrer">
                      Start a new project <ExternalLink size={12} className="ml-1.5" />
                    </a>
                  </Button>
                </div>
              ) : (
                <>
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
                    <SelectItem value="catalog">Pick from catalog</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.kind === "catalog" && (
                <div className="space-y-2">
                  <Label>Service</Label>
                  <div className="inline-flex items-center gap-1 rounded-full bg-muted/40 p-1 border border-border">
                    {CATS.map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setActiveCat(id)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-colors ${
                          activeCat === id
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon size={12} /> {label}
                      </button>
                    ))}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2 pt-1">
                    {catalogInCat.map((p: any) => {
                      const active = form.package_id === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => onPickPackage(p.id)}
                          className={`text-left rounded-lg px-3 py-2 border transition-colors ${
                            active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-medium truncate">{p.name}</span>
                            <span className={`text-[11px] tabular-nums shrink-0 ${active ? "text-primary font-medium" : "text-muted-foreground"}`}>
                              {p.credits_cost} cr
                            </span>
                          </div>
                          {p.description && (
                            <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{p.description}</div>
                          )}
                        </button>
                      );
                    })}
                    {catalogInCat.length === 0 && (
                      <div className="col-span-full text-center text-xs text-muted-foreground py-4">
                        Nothing in this category yet.
                      </div>
                    )}
                  </div>
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
              <p className="text-[11px] text-muted-foreground">
                The team will scope this and send back a credit estimate for you to approve — no credits are deducted until then.
                {selectedProject && <> Available on this project: <strong>{selectedProject.credit_balance ?? 0} cr</strong>.</>}
              </p>
              <a href="https://calendar.app.google/MWxuv9pVT4Y2P3kx9" target="_blank" rel="noreferrer" className="text-[11px] inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                <Calendar size={11} /> Or book a call to scope this together
              </a>
                </>
              )}
            </div>
            <DialogFooter>
              {scope === "existing" && (
                <Button onClick={() => submit.mutate()} disabled={submit.isPending}>Submit request</Button>
              )}
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