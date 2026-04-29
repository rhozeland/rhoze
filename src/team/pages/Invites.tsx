import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Copy, Mail, Trash2 } from "lucide-react";

type Role = "admin" | "employee" | "client";
const ROLES: Role[] = ["admin", "employee", "client"];

export default function Invites() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [name, setName] = useState("");
  const [lastTempPw, setLastTempPw] = useState<{ email: string; pw: string } | null>(null);

  const { data: invites, isLoading } = useQuery({
    queryKey: ["team-invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_invites")
        .select("*")
        .order("invited_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const invite = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("invite-team-member", {
        body: { email: email.trim(), role, display_name: name.trim() || undefined },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { ok: boolean; temp_password?: string; created_new: boolean };
    },
    onSuccess: (data) => {
      toast({
        title: data.created_new ? "Invite sent" : "Role assigned",
        description: data.temp_password
          ? "Temp password generated below — copy it now."
          : "An invite email was sent (or role added if user already existed).",
      });
      if (data.temp_password) setLastTempPw({ email: email.trim(), pw: data.temp_password });
      setEmail("");
      setName("");
      setRole("employee");
      qc.invalidateQueries({ queryKey: ["team-invites"] });
      qc.invalidateQueries({ queryKey: ["all-roles"] });
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
    },
    onError: (e: any) =>
      toast({ title: "Invite failed", description: e.message, variant: "destructive" }),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("team_invites")
        .update({ status: "revoked" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Invite revoked" });
      qc.invalidateQueries({ queryKey: ["team-invites"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_invites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Invite removed" });
      qc.invalidateQueries({ queryKey: ["team-invites"] });
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Invite team members</h1>
        <p className="text-sm text-muted-foreground">
          Send an email invite and auto-assign a role. If email delivery isn't configured yet,
          you'll get a temporary password to share manually.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          invite.mutate();
        }}
        className="border border-border rounded-lg p-4 grid gap-3 sm:grid-cols-[1fr_1fr_180px_auto]"
      >
        <Input
          type="email"
          required
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          placeholder="Display name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Select value={role} onValueChange={(v) => setRole(v as Role)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={invite.isPending}>
          <Mail size={14} /> {invite.isPending ? "Sending…" : "Invite"}
        </Button>
      </form>

      {lastTempPw && (
        <div className="border border-amber-500/40 bg-amber-500/10 rounded-lg p-4 text-sm">
          <div className="font-medium mb-1">Temp password for {lastTempPw.email}</div>
          <p className="text-xs text-muted-foreground mb-2">
            Share securely. They should change it after first sign-in.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-background px-2 py-1 rounded border border-border font-mono text-xs">
              {lastTempPw.pw}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(lastTempPw.pw);
                toast({ title: "Copied" });
              }}
            >
              <Copy size={14} /> Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setLastTempPw(null)}>Dismiss</Button>
          </div>
        </div>
      )}

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Invited</th>
              <th className="px-4 py-3 w-32"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && (invites ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No invites yet</td></tr>
            )}
            {(invites ?? []).map((inv: any) => (
              <tr key={inv.id} className="border-t border-border">
                <td className="px-4 py-3">{inv.email}</td>
                <td className="px-4 py-3">{inv.role}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded ${
                    inv.status === "accepted" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : inv.status === "revoked" ? "bg-muted text-muted-foreground"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  }`}>{inv.status}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {new Date(inv.invited_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {inv.status === "pending" && (
                    <Button size="sm" variant="ghost" onClick={() => revoke.mutate(inv.id)}>
                      Revoke
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(inv.id)}>
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