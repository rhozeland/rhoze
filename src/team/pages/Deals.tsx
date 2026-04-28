import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { useAuth } from "../lib/auth";

type Stage = "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
type Deal = { id: string; title: string; value: number; stage: Stage; contact_id: string | null };

const STAGES: Stage[] = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];

export default function Deals() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", value: "", stage: "lead" as Stage });

  const { data: deals } = useQuery({
    queryKey: ["deals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deals").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Deal[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Title required");
      const { error } = await supabase.from("deals").insert({
        title: form.title.trim(),
        value: Number(form.value || 0),
        stage: form.stage,
        owner_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Deal added" });
      setOpen(false);
      setForm({ title: "", value: "", stage: "lead" });
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: Stage }) => {
      const { error } = await supabase.from("deals").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deals"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Deals</h1>
          <p className="text-sm text-muted-foreground">Pipeline by stage.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus size={14} /> New deal</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New deal</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Value (USD)</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
                <div className="space-y-1.5">
                  <Label>Stage</Label>
                  <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as Stage })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAGES.map((stage) => {
          const list = (deals ?? []).filter((d) => d.stage === stage);
          const total = list.reduce((s, d) => s + Number(d.value ?? 0), 0);
          return (
            <div key={stage} className="border border-border rounded-lg bg-card p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold uppercase tracking-wider capitalize">{stage}</div>
                <div className="text-xs text-muted-foreground">{list.length}</div>
              </div>
              <div className="text-xs text-muted-foreground mb-3">${total.toLocaleString()}</div>
              <div className="space-y-2">
                {list.map((d) => (
                  <div key={d.id} className="border border-border rounded-md p-2 text-xs space-y-1.5 bg-background">
                    <div className="font-medium">{d.title}</div>
                    <div className="text-muted-foreground">${Number(d.value).toLocaleString()}</div>
                    <Select value={d.stage} onValueChange={(v) => updateStage.mutate({ id: d.id, stage: v as Stage })}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}