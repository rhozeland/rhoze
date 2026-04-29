import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Search, CheckCircle2, Circle } from "lucide-react";
import { useAuth } from "../lib/auth";
import EmbedPreview, { toEmbedUrl } from "../components/EmbedPreview";

export default function Docs() {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ title: "", category: "general", content: "", file_url: "", is_required: false });

  const { data: docs } = useQuery({
    queryKey: ["docs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("docs").select("*").order("category").order("title");
      if (error) throw error;
      return data;
    },
  });

  const { data: completions } = useQuery({
    queryKey: ["doc_completions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("doc_completions").select("doc_id").eq("user_id", user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((c) => c.doc_id));
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Title required");
      const { error } = await supabase.from("docs").insert({
        title: form.title.trim(),
        category: form.category.trim() || "general",
        content: form.content.trim() || null,
        file_url: form.file_url.trim() || null,
        is_required: form.is_required,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Doc added" });
      setOpen(false);
      setForm({ title: "", category: "general", content: "", file_url: "", is_required: false });
      qc.invalidateQueries({ queryKey: ["docs"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const toggleComplete = useMutation({
    mutationFn: async ({ docId, done }: { docId: string; done: boolean }) => {
      if (done) {
        const { error } = await supabase.from("doc_completions").delete().eq("doc_id", docId).eq("user_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("doc_completions").insert({ doc_id: docId, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["doc_completions", user?.id] }),
  });

  const filtered = (docs ?? []).filter((d: any) =>
    !q || d.title.toLowerCase().includes(q.toLowerCase()) || d.category.toLowerCase().includes(q.toLowerCase()),
  );

  const grouped = filtered.reduce((acc: Record<string, any[]>, d: any) => {
    (acc[d.category] = acc[d.category] || []).push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Docs & Training</h1>
          <p className="text-sm text-muted-foreground">Internal handbook, SOPs, training materials.</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus size={14} /> New doc</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New doc</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Content (markdown)</Label><Textarea rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>File URL (optional)</Label><Input value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} /></div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.is_required} onCheckedChange={(v) => setForm({ ...form, is_required: !!v })} />
                  Required for all team members
                </label>
              </div>
              <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
        <Input className="pl-9" placeholder="Search docs…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {Object.entries(grouped).length === 0 && (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-8 text-center">No docs yet.</div>
      )}
      {Object.entries(grouped).map(([cat, list]) => (
        <div key={cat}>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{cat}</div>
          <div className="space-y-2">
            {list.map((d: any) => {
              const done = completions?.has(d.id) ?? false;
              return (
                <div key={d.id} className="border border-border rounded-lg p-4 bg-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{d.title}</span>
                        {d.is_required && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">Required</span>}
                      </div>
                      {d.content && <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{d.content}</div>}
                      {d.file_url && (
                        <div className="mt-3">
                          {toEmbedUrl(d.file_url) ? (
                            <EmbedPreview url={d.file_url} title={d.title} height={420} />
                          ) : (
                            <a href={d.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-block">Open file →</a>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => toggleComplete.mutate({ docId: d.id, done })}
                      className="text-xs flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                      title={done ? "Mark incomplete" : "Mark complete"}
                    >
                      {done ? <CheckCircle2 size={18} className="text-green-500" /> : <Circle size={18} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}