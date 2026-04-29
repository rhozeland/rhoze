import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, ShieldCheck } from "lucide-react";
import { useAuth } from "../lib/auth";
import { formatCents, toCents } from "../lib/format";
import { getStripeEnvironment } from "@/lib/stripe";

export default function Catalog() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", slug: "", kind: "a_la_carte", description: "",
    price: "", credits: "0", billing_interval: "", is_active: true,
  });

  const { data: pkgs } = useQuery({
    queryKey: ["service_packages_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_packages").select("*").order("kind").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim() || !form.slug.trim()) throw new Error("Name and slug required");
      const { error } = await supabase.from("service_packages").insert({
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase().replace(/\s+/g, "-"),
        kind: form.kind,
        description: form.description.trim() || null,
        price_cents: toCents(form.price || "0"),
        credits: parseInt(form.credits || "0", 10) || 0,
        billing_interval: form.kind === "subscription" ? (form.billing_interval || "month") : null,
        is_active: form.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Item added" });
      setOpen(false);
      setForm({ name: "", slug: "", kind: "a_la_carte", description: "", price: "", credits: "0", billing_interval: "", is_active: true });
      qc.invalidateQueries({ queryKey: ["service_packages_all"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("service_packages").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["service_packages_all"] }),
  });

  const subs = (pkgs ?? []).filter((p: any) => p.kind === "subscription");
  const aLaCarte = (pkgs ?? []).filter((p: any) => p.kind === "a_la_carte");

  const setTaxCodes = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("set-tax-codes", {
        body: { environment: getStripeEnvironment() },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error || "Failed");
      return data;
    },
    onSuccess: (data: any) => toast({ title: "Tax codes synced", description: `${Object.keys(data?.updated ?? {}).length} products updated` }),
    onError: (e: any) => toast({ title: "Tax sync failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Catalog</h1>
          <p className="text-sm text-muted-foreground">Subscription tiers and à la carte services.</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTaxCodes.mutate()} disabled={setTaxCodes.isPending} title="Apply tax codes to all Stripe products for compliance handling">
            <ShieldCheck size={14} /> Sync tax codes
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus size={14} /> New item</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New catalog item</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || e.target.value.toLowerCase().replace(/\s+/g, "-") })} /></div>
                <div className="space-y-1.5"><Label>Slug *</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
                <div className="space-y-1.5">
                  <Label>Kind</Label>
                  <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subscription">Subscription tier</SelectItem>
                      <SelectItem value="a_la_carte">À la carte service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Price ($)</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Credits {form.kind === "subscription" ? "/ month" : "(if package)"}</Label><Input type="number" value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} /></div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  Active (visible to clients)
                </label>
              </div>
              <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        )}
      </div>

      <Section title="Subscription tiers" items={subs} onToggle={(id, v) => toggleActive.mutate({ id, is_active: v })} canToggle={isAdmin} />
      <Section title="À la carte services" items={aLaCarte} onToggle={(id, v) => toggleActive.mutate({ id, is_active: v })} canToggle={isAdmin} />
    </div>
  );
}

function Section({ title, items, onToggle, canToggle }: { title: string; items: any[]; onToggle: (id: string, v: boolean) => void; canToggle: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      <div className="grid gap-2">
        {items.length === 0 && <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-6 text-center">None yet.</div>}
        {items.map((p) => (
          <div key={p.id} className="border border-border rounded-lg p-4 bg-card flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium">{p.name} <span className="text-xs text-muted-foreground font-normal">· {p.slug}</span></div>
              {p.description && <div className="text-xs text-muted-foreground mt-0.5">{p.description}</div>}
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right text-sm">
                <div className="font-medium">{formatCents(p.price_cents)}{p.billing_interval ? `/${p.billing_interval === "month" ? "mo" : p.billing_interval}` : ""}</div>
                {p.credits > 0 && <div className="text-xs text-muted-foreground">{p.credits} credits</div>}
              </div>
              {canToggle && <Switch checked={p.is_active} onCheckedChange={(v) => onToggle(p.id, v)} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}