import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../lib/auth";

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-border rounded-lg p-5 bg-card">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-3xl font-semibold mt-2">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user, roles } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [contacts, deals, activities] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("deals").select("id, value, stage").neq("stage", "lost"),
        supabase.from("activities").select("id", { count: "exact", head: true }),
      ]);
      const openValue = (deals.data ?? [])
        .filter((d) => d.stage !== "won")
        .reduce((s, d) => s + Number(d.value ?? 0), 0);
      return {
        contacts: contacts.count ?? 0,
        deals: deals.data?.length ?? 0,
        activities: activities.count ?? 0,
        pipelineValue: openValue,
      };
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Welcome{user?.email ? `, ${user.email.split("@")[0]}` : ""}</h1>
        <p className="text-sm text-muted-foreground">Roles: {roles.length ? roles.join(", ") : "none"}</p>
      </header>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Contacts" value={stats?.contacts ?? "—"} />
        <StatCard label="Open deals" value={stats?.deals ?? "—"} />
        <StatCard label="Activities" value={stats?.activities ?? "—"} />
        <StatCard
          label="Pipeline value"
          value={
            stats ? `$${stats.pipelineValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"
          }
        />
      </div>
    </div>
  );
}