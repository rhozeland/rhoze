import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Search, FolderOpen, Copy } from "lucide-react";
import { useAuth } from "../lib/auth";
import { formatCents } from "../lib/format";

function generateCode() {
  // RHZ-XXXX-XXXX
  const seg = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RHZ-${seg()}-${seg()}`;
}

export default function Projects() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    title: "",
    client_name: "",
    client_email: "",
    client_phone: "",
    package_id: "",
    notes: "",
  });

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects", q],
    queryFn: async () => {
      let query = supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (q) query = query.or(`title.ilike.%${q}%,client_name.ilike.%${q}%,client_email.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: packages } = useQuery({
    queryKey: ["service_packages_active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_packages").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim() || !form.client_name.trim()) throw new Error("Title and client name required");
      const code = generateCode();
      const pkg = packages?.find((p: any) => p.id === form.package_id);
      const { data, error } = await supabase
        .from("projects")
        .insert({
          title: form.title.trim(),
          client_name: form.client_name.trim(),
          client_email: form.client_email.trim() || null,
          client_phone: form.client_phone.trim() || null,
          package_id: form.package_id || null,
          credit_balance: pkg?.credits ?? 0,
          notes: form.notes.trim() || null,
          project_code: code,
          status: "active",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (project: any) => {
      toast({
        title: "Project created",
        description: `Client code: ${project.project_code}`,
      });
      setOpen(false);
      setForm({ title: "", client_name: "", client_email: "", client_phone: "", package_id: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">Client work, balances, deliverables.</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus size={14} /> New project</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Project title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Cozal — Album rollout" /></div>
                <div className="space-y-1.5"><Label>Client name *</Label><Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Phone</Label><Input value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} /></div>
                </div>
                <div className="space-y-1.5">
                  <Label>Package (optional)</Label>
                  <Select value={form.package_id} onValueChange={(v) => setForm({ ...form, package_id: v })}>
                    <SelectTrigger><SelectValue placeholder="No package" /></SelectTrigger>
                    <SelectContent>
                      {(packages ?? []).filter((p: any) => p.kind === "subscription").map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} — {formatCents(p.price_cents)}/mo · {p.credits} credits</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
        <Input className="pl-9" placeholder="Search projects, clients, emails…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!isLoading && (projects ?? []).length === 0 && (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-8 text-center">
          No projects yet. Create one to start tracking client work.
        </div>
      )}

      <div className="grid gap-2">
        {(projects ?? []).map((p: any) => (
          <Link
            key={p.id}
            to={`/projects/${p.id}`}
            className="border border-border rounded-lg p-4 bg-card hover:border-primary/40 transition-colors flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <FolderOpen size={18} className="text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="font-medium truncate">{p.title}</div>
                <div className="text-xs text-muted-foreground truncate">{p.client_name} · {p.status}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Balance</div>
                <div className="text-sm font-medium">{formatCents(p.dollar_balance_cents)} · {p.credit_balance} cr</div>
              </div>
              {p.project_code && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    navigator.clipboard.writeText(p.project_code);
                    toast({ title: "Code copied", description: p.project_code });
                  }}
                  className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-muted text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  title="Copy client code"
                >
                  <Copy size={10} /> {p.project_code}
                </button>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}