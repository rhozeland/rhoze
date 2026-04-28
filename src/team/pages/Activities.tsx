import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { useAuth } from "../lib/auth";

type ActType = "call" | "email" | "meeting" | "note" | "task";

export default function Activities() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "note" as ActType, subject: "", body: "" });

  const { data } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("activities").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.subject.trim()) throw new Error("Subject required");
      const { error } = await supabase.from("activities").insert({
        type: form.type,
        subject: form.subject.trim(),
        body: form.body.trim() || null,
        owner_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Activity logged" });
      setOpen(false);
      setForm({ type: "note", subject: "", body: "" });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Activities</h1>
          <p className="text-sm text-muted-foreground">Calls, emails, notes, meetings, tasks.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus size={14} /> Log activity</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log activity</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as ActType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["note", "call", "email", "meeting", "task"] as ActType[]).map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Subject *</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Body</Label><Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {(data ?? []).length === 0 && <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-8 text-center">No activities yet.</div>}
        {(data ?? []).map((a: any) => (
          <div key={a.id} className="border border-border rounded-lg p-4 bg-card">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="capitalize font-medium text-foreground">{a.type}</span>
              <span>{new Date(a.created_at).toLocaleString()}</span>
            </div>
            <div className="font-medium mt-1">{a.subject}</div>
            {a.body && <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.body}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}