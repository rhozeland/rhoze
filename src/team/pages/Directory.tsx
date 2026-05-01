import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../lib/auth";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Eraser, Save, Pencil } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_BLOCKS = ["Morning", "Afternoon", "Evening", "Overnight"];

const cellKey = (d: string, b: string) => `${d}|${b}`;

export default function Directory() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: people } = useQuery({
    queryKey: ["team-directory"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("display_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: availability } = useQuery({
    queryKey: ["team-availability-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_availability").select("user_id, days, time_blocks, slots, notes");
      if (error) throw error;
      const map: Record<string, any> = {};
      (data ?? []).forEach((r: any) => { map[r.user_id] = r; });
      return map;
    },
  });

  const profileMap = useMemo(() => {
    const m: Record<string, any> = {};
    (people ?? []).forEach((p: any) => { m[p.id] = p; });
    return m;
  }, [people]);

  // Build per-user slot set: prefer explicit `slots` array (precise cells); fall back to days × blocks crossproduct.
  const userSlots = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    Object.values(availability ?? {}).forEach((av: any) => {
      const set = new Set<string>();
      if (Array.isArray(av.slots) && av.slots.length) {
        av.slots.forEach((s: string) => set.add(s));
      } else {
        const days: string[] = av.days ?? [];
        const blocks: string[] = av.time_blocks ?? [];
        days.forEach((d) => blocks.forEach((b) => set.add(cellKey(d, b))));
      }
      map[av.user_id] = set;
    });
    return map;
  }, [availability]);

  // grid[day][block] = array of user ids available in that cell
  const grid = useMemo(() => {
    const g: Record<string, Record<string, string[]>> = {};
    DAYS.forEach((d) => {
      g[d] = {};
      TIME_BLOCKS.forEach((b) => { g[d][b] = []; });
    });
    Object.entries(userSlots).forEach(([uid, set]) => {
      set.forEach((k) => {
        const [d, b] = k.split("|");
        if (g[d]?.[b]) g[d][b].push(uid);
      });
    });
    return g;
  }, [userSlots]);

  const [active, setActive] = useState<{ day: string; block: string } | null>(null);
  const activeIds = active ? grid[active.day]?.[active.block] ?? [] : [];

  const heatColor = (n: number, max: number) => {
    if (n === 0) return "bg-muted/40 text-muted-foreground";
    const ratio = max ? n / max : 0;
    if (ratio > 0.66) return "bg-primary text-primary-foreground";
    if (ratio > 0.33) return "bg-primary/60 text-primary-foreground";
    return "bg-primary/25 text-foreground";
  };

  const maxCount = useMemo(() => {
    let m = 0;
    DAYS.forEach((d) => TIME_BLOCKS.forEach((b) => { m = Math.max(m, grid[d][b].length); }));
    return m;
  }, [grid]);

  /* ───────── Personal availability editor (current user) ───────── */
  const myAv = user ? availability?.[user.id] : null;
  const [mySlots, setMySlots] = useState<Set<string>>(new Set());
  const [myNotes, setMyNotes] = useState("");
  const [dirty, setDirty] = useState(false);

  // Hydrate from server when availability loads / changes for me
  useEffect(() => {
    if (!user) return;
    const set = new Set<string>();
    if (myAv) {
      if (Array.isArray(myAv.slots) && myAv.slots.length) {
        myAv.slots.forEach((s: string) => set.add(s));
      } else {
        (myAv.days ?? []).forEach((d: string) =>
          (myAv.time_blocks ?? []).forEach((b: string) => set.add(cellKey(d, b))),
        );
      }
    }
    setMySlots(set);
    setMyNotes(myAv?.notes ?? "");
    setDirty(false);
  }, [user, myAv]);

  // Drag-paint state
  const dragMode = useRef<"add" | "remove" | null>(null);
  const onCellPointerDown = (k: string) => {
    const next = new Set(mySlots);
    if (next.has(k)) { next.delete(k); dragMode.current = "remove"; }
    else { next.add(k); dragMode.current = "add"; }
    setMySlots(next); setDirty(true);
  };
  const onCellPointerEnter = (k: string) => {
    if (!dragMode.current) return;
    setMySlots((prev) => {
      const next = new Set(prev);
      if (dragMode.current === "add") next.add(k); else next.delete(k);
      return next;
    });
    setDirty(true);
  };
  useEffect(() => {
    const stop = () => { dragMode.current = null; };
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []);

  // Save / clear
  const saveMine = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const slotsArr = Array.from(mySlots);
      const days = Array.from(new Set(slotsArr.map((s) => s.split("|")[0])));
      const blocks = Array.from(new Set(slotsArr.map((s) => s.split("|")[1])));
      const { error } = await supabase
        .from("team_availability")
        .upsert(
          { user_id: user.id, slots: slotsArr, days, time_blocks: blocks, notes: myNotes || null },
          { onConflict: "user_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["team-availability-all"] });
      toast({ title: "Availability saved" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const clearMine = useCallback(() => {
    setMySlots(new Set()); setDirty(true);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Team directory</h1>
        <p className="text-sm text-muted-foreground">Who's who — and when everyone's free.</p>
      </div>

      {/* My availability editor */}
      {user && (
        <div className="border border-border rounded-lg p-5 bg-card space-y-3">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Pencil size={12} /> Your availability
              </div>
              <div className="text-sm text-muted-foreground">
                Click or drag across cells to mark when you're free. Saves to the shared grid below.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={clearMine}><Eraser size={14} /> Clear all</Button>
              <Button size="sm" onClick={() => saveMine.mutate()} disabled={!dirty || saveMine.isPending}>
                <Save size={14} /> {saveMine.isPending ? "Saving…" : dirty ? "Save" : "Saved"}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto select-none">
            <table className="w-full text-xs border-separate border-spacing-1 min-w-[560px]">
              <thead>
                <tr>
                  <th className="text-left font-medium text-muted-foreground px-2 py-1 w-20"> </th>
                  {DAYS.map((d) => (
                    <th key={d} className="text-center font-medium text-muted-foreground px-2 py-1">{d.slice(0, 3)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_BLOCKS.map((b) => (
                  <tr key={b}>
                    <td className="text-left text-muted-foreground px-2 py-1 align-middle">{b}</td>
                    {DAYS.map((d) => {
                      const k = cellKey(d, b);
                      const on = mySlots.has(k);
                      return (
                        <td key={d} className="p-0">
                          <button
                            type="button"
                            onPointerDown={() => onCellPointerDown(k)}
                            onPointerEnter={() => onCellPointerEnter(k)}
                            className={`w-full h-10 rounded text-xs font-medium transition-all touch-none ${
                              on
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/40 text-muted-foreground hover:bg-muted"
                            }`}
                            title={`${d} · ${b}`}
                          >
                            {on ? "✓" : ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Textarea
            value={myNotes}
            onChange={(e) => { setMyNotes(e.target.value); setDirty(true); }}
            placeholder="Notes (timezone, exceptions, preferred booking style…)"
            className="min-h-[60px] text-sm"
          />
        </div>
      )}

      <div className="border border-border rounded-lg p-5 bg-card space-y-3">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Shared availability</div>
            <div className="text-sm text-muted-foreground">Click a cell to see who's free.</div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>Fewer</span>
            <span className="inline-block h-3 w-4 rounded bg-muted/40 border border-border" />
            <span className="inline-block h-3 w-4 rounded bg-primary/25" />
            <span className="inline-block h-3 w-4 rounded bg-primary/60" />
            <span className="inline-block h-3 w-4 rounded bg-primary" />
            <span>More</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate border-spacing-1 min-w-[560px]">
            <thead>
              <tr>
                <th className="text-left font-medium text-muted-foreground px-2 py-1 w-20"> </th>
                {DAYS.map((d) => (
                  <th key={d} className="text-center font-medium text-muted-foreground px-2 py-1">{d.slice(0, 3)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_BLOCKS.map((b) => (
                <tr key={b}>
                  <td className="text-left text-muted-foreground px-2 py-1 align-middle">{b}</td>
                  {DAYS.map((d) => {
                    const ids = grid[d][b];
                    const isActive = active?.day === d && active?.block === b;
                    return (
                      <td key={d} className="p-0">
                        <button
                          type="button"
                          onClick={() => setActive(isActive ? null : { day: d, block: b })}
                          className={`w-full h-10 rounded text-xs font-medium transition-all ${heatColor(ids.length, maxCount)} ${isActive ? "ring-2 ring-foreground" : "hover:opacity-80"}`}
                          title={`${d} · ${b}: ${ids.length} available`}
                        >
                          {ids.length > 0 ? ids.length : ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {active && (
          <div className="border-t border-border pt-3">
            <div className="text-xs text-muted-foreground mb-2">
              {active.day} · {active.block} — {activeIds.length} available
            </div>
            {activeIds.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">No one is marked available.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activeIds.map((uid) => {
                  const p = profileMap[uid];
                  if (!p) return null;
                  return (
                    <div key={uid} className="flex items-center gap-2 border border-border rounded-full pl-1 pr-3 py-1 bg-background">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
                          {(p.display_name ?? "?").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs">{p.display_name ?? "Unnamed"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(people ?? []).map((p: any) => {
          const av = availability?.[p.id];
          return (
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
            {av && ((av.days?.length ?? 0) > 0 || (av.time_blocks?.length ?? 0) > 0 || av.notes) && (
              <div className="mt-3 pt-3 border-t border-border space-y-1 text-[11px]">
                <div className="uppercase tracking-wide text-muted-foreground">Availability</div>
                {av.days?.length > 0 && <div><span className="text-muted-foreground">Days:</span> {av.days.map((d: string) => d.slice(0,3)).join(", ")}</div>}
                {av.time_blocks?.length > 0 && <div><span className="text-muted-foreground">When:</span> {av.time_blocks.join(", ")}</div>}
                {av.notes && <div className="text-muted-foreground italic">{av.notes}</div>}
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
