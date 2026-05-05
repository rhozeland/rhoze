import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Sparkles, Plus, Check, X as XIcon, Calendar } from "lucide-react";
import { useAuth } from "../lib/auth";
import { formatDate } from "../lib/format";

type Mode = "client" | "team";

export default function CreditRequestsPanel({
  projectId,
  creditBalance,
  mode,
}: {
  projectId: string;
  creditBalance: number;
  mode: Mode;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    kind: "custom" as "custom" | "catalog",
    package_id: "",
    title: "",
    description: "",
    requested_credits: "1",
  });

  const { data: requests } = useQuery({
    queryKey: ["credit_requests", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_requests")
        .select("*")
        .eq("project_id", projectId)
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

  const submit = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Title required");
      const credits = Math.max(1, parseInt(form.requested_credits || "1", 10));
      const { error } = await supabase.from("credit_requests").insert({
        project_id: projectId,
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
      toast({ title: "Request submitted", description: "The team will review your request shortly." });
      setOpen(false);
      setForm({ kind: "custom", package_id: "", title: "", description: "", requested_credits: "1" });
      qc.invalidateQueries({ queryKey: ["credit_requests", projectId] });
    },
    onError: (e: any) => toast({ title: "Could not submit", description: e.message, variant: "destructive" }),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("credit_request_cancel", { _request_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["credit_requests", projectId] }),
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("credit_request_client_approve", { _request_id: id, _client_notes: null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Approved", description: "Credits have been deducted and the work is queued." });
      qc.invalidateQueries({ queryKey: ["credit_requests", projectId] });
      qc.invalidateQueries({ queryKey: ["portal_project", projectId] });
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

  return (
    <section className="rounded-2xl border border-border bg-card p-5 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Use credits</div>
          <div className="text-base font-semibold mt-0.5">Request work with credits</div>
          <p className="text-xs text-muted-foreground mt-1">
            1 credit = $75 (1 hr of focused work or one deliverable). Pick from the catalog or describe a custom request — the team confirms scope before any credits are deducted.
          </p>
        </div>
        {mode === "client" && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg"><Plus size={16} className="mr-1" /> New request</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Request work with credits</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as any, package_id: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Custom request</SelectItem>
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
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} · {p.credits_cost} cr
                          </SelectItem>
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
                  <Textarea
                    rows={4}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="What you need, deadlines, references, links…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Estimated credits</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.requested_credits}
                    onChange={(e) => setForm({ ...form, requested_credits: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Your starting estimate. Team will confirm or adjust before any credits are deducted.
                    Available balance: <strong>{creditBalance} cr</strong>.
                  </p>
                </div>
                <a
                  href="https://calendar.app.google/MWxuv9pVT4Y2P3kx9"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Calendar size={11} /> Or book a call to scope this together
                </a>
              </div>
              <DialogFooter>
                <Button onClick={() => submit.mutate()} disabled={submit.isPending}>Submit request</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {(requests ?? []).length === 0 ? (
        <div className="text-xs text-muted-foreground border border-dashed border-border rounded-lg p-4">
          No credit requests yet.
        </div>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
          {(requests ?? []).map((r: any) => (
            <li key={r.id} className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{r.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatDate(r.created_at)} · {r.kind} ·{" "}
                    <span className="tabular-nums">
                      {r.estimated_credits ?? r.requested_credits} cr
                    </span>
                  </div>
                </div>
                <StatusPill status={r.status} />
              </div>
              {r.description && (
                <div className="text-xs text-muted-foreground whitespace-pre-wrap">{r.description}</div>
              )}
              {r.team_notes && (
                <div className="text-xs rounded-md bg-muted/40 px-2 py-1.5">
                  <span className="text-muted-foreground">Team note: </span>
                  {r.team_notes}
                </div>
              )}
              {mode === "client" && r.status === "client_review" && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" onClick={() => approve.mutate(r.id)} disabled={approve.isPending}>
                    <Check size={12} className="mr-1" /> Approve & spend {r.estimated_credits} cr
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => cancel.mutate(r.id)}>
                    <XIcon size={12} className="mr-1" /> Decline
                  </Button>
                  <a
                    href="https://calendar.app.google/MWxuv9pVT4Y2P3kx9"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 py-1.5"
                  >
                    <Calendar size={11} /> Book a call first
                  </a>
                </div>
              )}
              {mode === "client" && r.status === "pending_team" && (
                <Button size="sm" variant="ghost" onClick={() => cancel.mutate(r.id)}>
                  <XIcon size={12} className="mr-1" /> Cancel request
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
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
  const label = status.replace("_", " ");
  return (
    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${map[status] ?? "bg-muted text-muted-foreground border-border"}`}>
      <Sparkles size={9} className="inline mr-1" />
      {label}
    </span>
  );
}