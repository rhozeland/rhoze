import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Directory() {
  const { data: people } = useQuery({
    queryKey: ["team-directory"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("display_name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Team directory</h1>
        <p className="text-sm text-muted-foreground">Who's who at Rhozeland.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(people ?? []).map((p: any) => (
          <div key={p.id} className="border border-border rounded-lg p-4 bg-card">
            <div className="flex items-start gap-3">
              {p.avatar_url ? (
                <img src={p.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover border border-border" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                  {(p.display_name ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{p.display_name ?? "Unnamed"}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {[p.job_title, p.pronouns].filter(Boolean).join(" · ") || "—"}
                </div>
                {p.specialty && <div className="text-xs text-primary mt-1">{p.specialty}</div>}
              </div>
            </div>
            {p.bio && <div className="text-sm text-muted-foreground mt-3 line-clamp-3">{p.bio}</div>}
            <div className="flex gap-3 mt-3 text-xs">
              {p.website && <a href={p.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">Website</a>}
              {p.portfolio_url && <a href={p.portfolio_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">Portfolio</a>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
