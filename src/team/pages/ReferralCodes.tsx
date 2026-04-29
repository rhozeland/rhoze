import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Copy, Trash2, Plus } from "lucide-react";

type Role = "admin" | "employee" | "client";
interface Code {
  id: string;
  code: string;
  role: Role;
  note: string | null;
  max_uses: number;
  uses: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

function makeCode() {
  // 12-char readable code
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += a[b % a.length];
  return `RHZ-${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

export default function ReferralCodes() {
  const [codes, setCodes] = useState<Code[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role>("employee");
  const [note, setNote] = useState("");
  const [maxUses, setMaxUses] = useState(1);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("referral_codes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Failed to load codes", description: error.message, variant: "destructive" });
    setCodes((data ?? []) as Code[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const code = makeCode();
    const { error } = await supabase.from("referral_codes").insert({
      code,
      role,
      note: note || null,
      max_uses: Math.max(1, Number(maxUses) || 1),
    });
    setBusy(false);
    if (error) {
      toast({ title: "Could not create code", description: error.message, variant: "destructive" });
      return;
    }
    setNote("");
    setMaxUses(1);
    toast({ title: "Code created", description: code });
    load();
  };

  const toggleActive = async (c: Code) => {
    const { error } = await supabase
      .from("referral_codes")
      .update({ is_active: !c.is_active })
      .eq("id", c.id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    load();
  };

  const remove = async (c: Code) => {
    if (!confirm(`Delete code ${c.code}?`)) return;
    const { error } = await supabase.from("referral_codes").delete().eq("id", c.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    load();
  };

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied", description: code });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Referral codes</h1>
        <p className="text-sm text-muted-foreground">
          Anyone signing up to the team portal must enter a valid code. Each code maps to a role.
        </p>
      </div>

      <form onSubmit={create} className="border border-border rounded-lg bg-card p-5 grid sm:grid-cols-4 gap-3 items-end">
        <div className="space-y-1.5">
          <Label>Role</Label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="employee">employee</option>
            <option value="admin">admin</option>
            <option value="client">client</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Max uses</Label>
          <Input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))} />
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <Label>Note (optional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Designer onboarding" />
        </div>
        <Button type="submit" disabled={busy}>
          <Plus size={14} /> Generate code
        </Button>
      </form>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2">Code</th>
              <th className="text-left px-4 py-2">Role</th>
              <th className="text-left px-4 py-2">Uses</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Note</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!loading && codes.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No codes yet — create one above.</td></tr>
            )}
            {codes.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-2 font-mono text-xs">
                  <button onClick={() => copy(c.code)} className="inline-flex items-center gap-2 hover:text-primary">
                    {c.code} <Copy size={12} />
                  </button>
                </td>
                <td className="px-4 py-2">{c.role}</td>
                <td className="px-4 py-2">{c.uses} / {c.max_uses}</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => toggleActive(c)}
                    className={c.is_active ? "text-emerald-600 hover:underline" : "text-muted-foreground hover:underline"}
                  >
                    {c.is_active ? "active" : "disabled"}
                  </button>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{c.note ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => remove(c)}>
                    <Trash2 size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}