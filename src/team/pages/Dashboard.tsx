import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../lib/auth";
import { Megaphone, Users, DollarSign, BookOpen, Settings as SettingsIcon, ListChecks, UserCircle2, FolderKanban, Clock, Inbox, Package } from "lucide-react";
import { useAuth as _useAuthIcons } from "../lib/auth";
import { cn } from "@/lib/utils";

const TILES = [
  { to: "/priorities", label: "Priorities", desc: "Eisenhower matrix", icon: ListChecks, tone: "from-red-500/10 to-amber-500/5" },
  { to: "/projects", label: "Projects", desc: "Client work & balances", icon: FolderKanban, tone: "from-orange-500/10 to-amber-500/5" },
  { to: "/timesheets", label: "Timesheets", desc: "Hours & expenses", icon: Clock, tone: "from-cyan-500/10 to-teal-500/5" },
  { to: "/marketing", label: "Marketing", desc: "Campaigns & outreach", icon: Megaphone, tone: "from-fuchsia-500/10 to-purple-500/5" },
  { to: "/crm", label: "CRM", desc: "Contacts, deals, pipeline", icon: Users, tone: "from-blue-500/10 to-cyan-500/5" },
  { to: "/payroll", label: "Payroll", desc: "Pay periods & stubs", icon: DollarSign, tone: "from-green-500/10 to-emerald-500/5" },
  { to: "/docs", label: "Docs & Training", desc: "SOPs, handbook, files", icon: BookOpen, tone: "from-indigo-500/10 to-blue-500/5" },
  { to: "/directory", label: "Team Directory", desc: "People & specialties", icon: UserCircle2, tone: "from-pink-500/10 to-rose-500/5" },
  { to: "/settings", label: "Settings", desc: "Your profile & account", icon: SettingsIcon, tone: "from-slate-500/10 to-zinc-500/5" },
];

const ADMIN_TILES = [
  { to: "/intake", label: "Intake", desc: "Project requests", icon: Inbox, tone: "from-yellow-500/10 to-orange-500/5" },
  { to: "/catalog", label: "Catalog", desc: "Tiers & services", icon: Package, tone: "from-violet-500/10 to-purple-500/5" },
];

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const name = user?.email?.split("@")[0] ?? "team";

  const { data: myTasks } = useQuery({
    queryKey: ["my-open-tasks", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("id, title, urgent, important, due_date").eq("owner_id", user!.id).eq("done", false).order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">Welcome, {name}</h1>
        <p className="text-sm text-muted-foreground mt-1">Your Rhozeland workspace.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...TILES, ...(isAdmin ? ADMIN_TILES : [])].map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className={cn(
              "group relative overflow-hidden border border-border rounded-lg p-5 bg-gradient-to-br transition-all hover:border-primary/50 hover:-translate-y-0.5",
              t.tone,
            )}
          >
            <t.icon size={20} className="text-foreground/80 mb-3" />
            <div className="font-medium">{t.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
          </Link>
        ))}
      </div>

      <section className="border border-border rounded-lg bg-card">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="font-medium">Top of mind</div>
            <div className="text-xs text-muted-foreground">Your open priorities.</div>
          </div>
          <Link to="/priorities" className="text-xs text-primary hover:underline">Open matrix →</Link>
        </div>
        <div className="divide-y divide-border">
          {(myTasks ?? []).length === 0 && (
            <div className="px-5 py-8 text-sm text-muted-foreground text-center">Nothing on your plate. Add a task in Priorities.</div>
          )}
          {(myTasks ?? []).map((t: any) => (
            <div key={t.id} className="px-5 py-3 flex items-center justify-between text-sm">
              <div className="truncate">{t.title}</div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                {t.important && <span className="text-blue-500">important</span>}
                {t.urgent && <span className="text-red-500">urgent</span>}
                {t.due_date && <span>{new Date(t.due_date).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
