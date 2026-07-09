import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "../lib/auth";
import { ArrowDown, ArrowUp, Plus, Trash2, Save, ExternalLink } from "lucide-react";

type Item = {
  id: string;
  label: string;
  headline: string;
  href: string | null;
  sort_order: number;
  is_active: boolean;
};

type Draft = Omit<Item, "id"> & { id?: string; dirty?: boolean };

function blank(sort_order: number): Draft {
  return { label: "", headline: "", href: "", sort_order, is_active: true, dirty: true };
}

export default function Newsroom() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["news-ticker-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_ticker_items")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  useEffect(() => {
    if (data) setDrafts(data.map((d) => ({ ...d, href: d.href ?? "" })));
  }, [data]);

  const activePreview = useMemo(
    () => drafts.filter((d) => d.is_active && d.headline.trim()).sort((a, b) => a.sort_order - b.sort_order),
    [drafts],
  );

  const saveMutation = useMutation({
    mutationFn: async (row: Draft) => {
      const payload = {
        label: row.label.trim() || "News",
        headline: row.headline.trim(),
        href: row.href?.trim() ? row.href.trim() : null,
        sort_order: row.sort_order,
        is_active: row.is_active,
      };
      if (row.id) {
        const { error } = await supabase.from("news_ticker_items").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("news_ticker_items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["news-ticker-items"] });
      toast({ title: "Saved" });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("news_ticker_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["news-ticker-items"] });
      toast({ title: "Deleted" });
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  function update(idx: number, patch: Partial<Draft>) {
    setDrafts((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch, dirty: true };
      return next;
    });
  }

  function move(idx: number, dir: -1 | 1) {
    setDrafts((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next.map((row, i) => ({ ...row, sort_order: (i + 1) * 10, dirty: true }));
    });
  }

  function addRow() {
    setDrafts((prev) => [...prev, blank(((prev.at(-1)?.sort_order ?? 0) + 10))]);
  }

  async function saveAll() {
    const rows = drafts.filter((d) => d.dirty);
    if (!rows.length) {
      toast({ title: "Nothing to save" });
      return;
    }
    for (const r of rows) {
      if (!r.headline.trim()) continue;
      await saveMutation.mutateAsync(r);
    }
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md space-y-2">
        <h1 className="text-2xl font-semibold">Newsroom</h1>
        <p className="text-sm text-muted-foreground">Admin access required to edit the homepage news ticker.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Homepage</div>
          <h1 className="text-2xl font-semibold">Newsroom · News Ticker</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Manage the scrolling headlines in the top strip of <span className="font-mono">rhozeland.com</span>. Each item has a
            short label (e.g. Podcast, Exhibition, Hackathon), a headline, and an optional link.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addRow}><Plus size={14} /> Add item</Button>
          <Button size="sm" onClick={saveAll} disabled={saveMutation.isPending}><Save size={14} /> Save changes</Button>
        </div>
      </header>

      {/* Preview */}
      <Card className="p-3">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Live preview</div>
        <div className="flex items-stretch border border-border rounded-md overflow-hidden bg-card">
          <div className="flex items-center gap-2 border-r border-border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground bg-background">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            News
          </div>
          <div className="relative flex-1 overflow-hidden">
            <div className="flex gap-6 whitespace-nowrap py-2 px-4 animate-[ticker-preview_40s_linear_infinite]">
              {[...activePreview, ...activePreview].map((it, i) => (
                <span key={i} className="inline-flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{it.label}</span>
                  <span className="text-xs font-semibold text-foreground">{it.headline}</span>
                  <span className="text-muted-foreground/50">·</span>
                </span>
              ))}
            </div>
          </div>
        </div>
        <style>{`@keyframes ticker-preview { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
      </Card>

      {/* Rows */}
      <div className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {drafts.map((row, idx) => (
          <Card key={row.id ?? `new-${idx}`} className="p-4">
            <div className="grid gap-3 md:grid-cols-[7rem_1fr_1fr_auto] md:items-end">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Label</Label>
                <Input value={row.label} onChange={(e) => update(idx, { label: e.target.value })} placeholder="Podcast" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Headline</Label>
                <Input value={row.headline} onChange={(e) => update(idx, { headline: e.target.value })} placeholder="Rhoze Podcast Ep. 7 · out now" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Link (optional)</Label>
                <div className="flex gap-1">
                  <Input value={row.href ?? ""} onChange={(e) => update(idx, { href: e.target.value })} placeholder="https://… or /page.html" />
                  {row.href ? (
                    <a href={row.href} target="_blank" rel="noreferrer" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground" title="Open link">
                      <ExternalLink size={14} />
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => move(idx, -1)} disabled={idx === 0} title="Move up"><ArrowUp size={14} /></Button>
                <Button variant="ghost" size="icon" onClick={() => move(idx, 1)} disabled={idx === drafts.length - 1} title="Move down"><ArrowDown size={14} /></Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    if (row.id) {
                      if (!confirm("Delete this ticker item?")) return;
                      await deleteMutation.mutateAsync(row.id);
                    } else {
                      setDrafts((prev) => prev.filter((_, i) => i !== idx));
                    }
                  }}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <div className="flex items-center gap-2">
                <Switch checked={row.is_active} onCheckedChange={(v) => update(idx, { is_active: v })} id={`active-${idx}`} />
                <Label htmlFor={`active-${idx}`} className="text-xs">{row.is_active ? "Visible on site" : "Hidden"}</Label>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Sort {row.sort_order}{row.dirty ? " · unsaved" : ""}
              </div>
            </div>
          </Card>
        ))}
        {!isLoading && !drafts.length && (
          <p className="text-sm text-muted-foreground">No items yet. Click <span className="font-medium">Add item</span> to create one.</p>
        )}
      </div>
    </div>
  );
}
