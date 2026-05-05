import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, UserCircle2, FolderOpen, Sparkles, Coins, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight client-portal chrome. Deliberately separate from the team
 * sidebar (no Time & Pay / CRM / Catalog). Keeps a signed-in client from
 * accidentally landing in operational team pages — every link inside the
 * client portal stays inside `/client` and `/portal/:id`.
 */
export default function ClientLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: totals } = useQuery({
    queryKey: ["client_layout_totals", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: pcs } = await supabase
        .from("project_clients")
        .select("project_id")
        .eq("user_id", user!.id);
      const ids = (pcs ?? []).map((r: any) => r.project_id);
      if (!ids.length) return { rhoze: 0, credits: 0 };
      const [{ data: bals }, { data: projs }] = await Promise.all([
        supabase.from("rhoze_balances").select("balance").in("project_id", ids),
        supabase.from("projects").select("credit_balance").in("id", ids),
      ]);
      return {
        rhoze: (bals ?? []).reduce((s: number, r: any) => s + Number(r.balance ?? 0), 0),
        credits: (projs ?? []).reduce((s: number, r: any) => s + Number(r.credit_balance ?? 0), 0),
      };
    },
  });
  const totalRhoze = totals?.rhoze ?? 0;
  const totalCredits = totals?.credits ?? 0;

  const handleSignOut = async () => {
    await signOut();
    navigate("/client");
  };

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    cn(
      "inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors",
      isActive
        ? "bg-foreground text-background"
        : "text-muted-foreground hover:text-foreground hover:bg-accent",
    );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-2.5 flex items-center justify-between gap-4 flex-wrap">
          <a
            href="https://www.rhozeland.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 group"
            title="Visit rhozeland.com"
          >
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground group-hover:text-foreground transition-colors">Rhozeland</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs font-medium">Client portal</span>
          </a>
          <nav className="flex items-center gap-1">
            <NavLink to="/client/home" end className={linkCls}>
              <FolderOpen size={12} /> Projects
            </NavLink>
            <NavLink to="/client/requests" className={linkCls}>
              <Plus size={12} /> Requests
            </NavLink>
            <span
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-foreground text-background tabular-nums"
              title="Your total credit balance across all projects"
            >
              <Coins size={12} /> {totalCredits} cr
            </span>
            <span
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-accent/40 text-foreground"
              title="Your total $RHOZE balance across all projects"
            >
              <Sparkles size={12} /> {Number(totalRhoze).toLocaleString()} $RHOZE
            </span>
            <NavLink to="/client/profile" className={linkCls}>
              <UserCircle2 size={12} /> Profile
            </NavLink>
            <Button onClick={handleSignOut} variant="ghost" size="sm" className="h-7 px-2 text-xs">
              <LogOut size={12} /> Sign out
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}