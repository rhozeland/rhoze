import { ChevronDown, Globe } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState, useEffect } from "react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_BLOCKS = ["Morning", "Afternoon", "Evening", "Overnight"];
// Hour anchors (in author's local time) used to convert "block" labels into
// concrete instants so we can shift them across timezones safely.
const BLOCK_HOUR: Record<string, number> = {
  Morning: 9,     // 09:00
  Afternoon: 13,  // 13:00
  Evening: 18,    // 18:00
  Overnight: 23,  // 23:00
};
const HOUR_TO_BLOCK = (h: number): string => {
  if (h >= 5 && h < 12) return "Morning";
  if (h >= 12 && h < 17) return "Afternoon";
  if (h >= 17 && h < 22) return "Evening";
  return "Overnight";
};

const VIEWER_TZ = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
  catch { return "UTC"; }
})();

/**
 * Given a (day, block) authored in `fromTz`, return the corresponding
 * (day, block) as it lands in `toTz`. The conversion uses the canonical
 * hour anchor for the block. We anchor on a known reference week so DST
 * ambiguity is resolved consistently.
 */
const REFERENCE_SUNDAY = new Date(Date.UTC(2026, 0, 4)); // Sun Jan 4 2026 (UTC)

function convertCell(
  day: string,
  block: string,
  fromTz: string,
  toTz: string,
): { day: string; block: string } {
  if (fromTz === toTz) return { day, block };
  const dayIdx = DAYS.indexOf(day);
  const hour = BLOCK_HOUR[block];
  if (dayIdx < 0 || hour == null) return { day, block };

  // Build "wall clock" date in fromTz: reference Sunday + dayIdx, at `hour:00`.
  // We need the UTC instant whose representation in fromTz is exactly that
  // wall clock. Approach: take the reference UTC instant, format it in fromTz,
  // measure the offset, and adjust.
  const wallUtc = new Date(REFERENCE_SUNDAY);
  wallUtc.setUTCDate(wallUtc.getUTCDate() + dayIdx);
  wallUtc.setUTCHours(hour, 0, 0, 0);

  const offsetMin = (tz: string, instant: Date) => {
    // Use Intl to read the wall clock in the target tz, then compute delta.
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const parts = dtf.formatToParts(instant).reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
    const asUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    return (asUtc - instant.getTime()) / 60000;
  };

  // Find the UTC instant matching the desired wall clock in fromTz.
  const fromOffset = offsetMin(fromTz, wallUtc);
  const utcInstant = new Date(wallUtc.getTime() - fromOffset * 60000);

  // Read that instant in toTz to get the viewer's wall clock.
  const dtfTo = new Intl.DateTimeFormat("en-US", {
    timeZone: toTz, hourCycle: "h23", weekday: "long", hour: "2-digit",
  });
  const partsTo = dtfTo.formatToParts(utcInstant).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const newDay = partsTo.weekday;
  const newHour = Number(partsTo.hour);
  if (!DAYS.includes(newDay) || Number.isNaN(newHour)) return { day, block };
  return { day: newDay, block: HOUR_TO_BLOCK(newHour) };
}

const cellKey = (d: string, b: string) => `${d}|${b}`;

export default function Directory() {
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
      const { data, error } = await supabase.from("team_availability").select("user_id, days, time_blocks, slots, notes, timezone");
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

  // Build per-user slot set, converted into the VIEWER's timezone so that
  // "Tuesday Evening" always means Tuesday Evening in the local week of the
  // person looking at the screen.
  const userSlots = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    Object.values(availability ?? {}).forEach((av: any) => {
      const fromTz = av.timezone || "UTC";
      const set = new Set<string>();
      const raw: string[] = Array.isArray(av.slots) && av.slots.length
        ? av.slots
        : ((av.days ?? []) as string[]).flatMap((d) =>
            ((av.time_blocks ?? []) as string[]).map((b) => cellKey(d, b)),
          );
      raw.forEach((s) => {
        const [d, b] = s.split("|");
        const { day, block } = convertCell(d, b, fromTz, VIEWER_TZ);
        set.add(cellKey(day, block));
      });
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
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  useEffect(() => { setSelectedUid(null); }, [active?.day, active?.block]);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Team Directory</h1>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
          Click or drag across cells to mark when you and everyone else is free.
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-border bg-muted/40 text-muted-foreground">
            <Globe size={11} /> Showing in your local time · {VIEWER_TZ}
          </span>
        </p>
      </div>

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
                        {ids.length > 0 ? (
                          <HoverCard
                            openDelay={120}
                            closeDelay={60}
                            open={hoverKey === cellKey(d, b)}
                            onOpenChange={(o) => setHoverKey(o ? cellKey(d, b) : (hoverKey === cellKey(d, b) ? null : hoverKey))}
                          >
                            <HoverCardTrigger asChild>
                              <button
                                type="button"
                                onClick={() => {
                                  setHoverKey(null);
                                  setActive(isActive ? null : { day: d, block: b });
                                }}
                                className={`w-full h-10 rounded text-xs font-medium transition-all ${heatColor(ids.length, maxCount)} ${isActive ? "ring-2 ring-foreground" : "hover:opacity-80"}`}
                              >
                                {ids.length}
                              </button>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-56 p-2" side="top" align="center">
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-1 pb-1.5 flex items-center justify-between">
                                <span>{d.slice(0,3)} · {b}</span>
                                <span>{ids.length} avail</span>
                              </div>
                              {(() => {
                                const PREVIEW = 3;
                                const preview = ids.slice(0, PREVIEW);
                                const rest = ids.slice(PREVIEW);
                                return (
                                  <>
                                    <div className="flex flex-wrap gap-1.5">
                                      {preview.map((uid) => {
                                        const p = profileMap[uid];
                                        if (!p) return null;
                                        return (
                                          <div key={uid} className="flex items-center gap-1.5 border border-border rounded-full pl-0.5 pr-2 py-0.5 bg-background">
                                            {p.avatar_url ? (
                                              <img src={p.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                                            ) : (
                                              <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium">
                                                {(p.display_name ?? "?").slice(0, 1).toUpperCase()}
                                              </div>
                                            )}
                                            <span className="text-[11px]">{p.display_name ?? "Unnamed"}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    {rest.length > 0 && (
                                      <details className="mt-1.5 group">
                                        <summary className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer list-none px-1 select-none">
                                          + {rest.length} more <span className="group-open:hidden">▾</span><span className="hidden group-open:inline">▴</span>
                                        </summary>
                                        <div className="mt-1.5 max-h-32 overflow-y-auto pr-1 flex flex-wrap gap-1.5">
                                          {rest.map((uid) => {
                                            const p = profileMap[uid];
                                            if (!p) return null;
                                            return (
                                              <div key={uid} className="flex items-center gap-1.5 border border-border rounded-full pl-0.5 pr-2 py-0.5 bg-background">
                                                {p.avatar_url ? (
                                                  <img src={p.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                                                ) : (
                                                  <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium">
                                                    {(p.display_name ?? "?").slice(0, 1).toUpperCase()}
                                                  </div>
                                                )}
                                                <span className="text-[11px]">{p.display_name ?? "Unnamed"}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </details>
                                    )}
                                  </>
                                );
                              })()}
                              <div className="text-[10px] text-muted-foreground px-1 pt-1.5">Click cell for details</div>
                            </HoverCardContent>
                          </HoverCard>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActive(isActive ? null : { day: d, block: b })}
                            className={`w-full h-10 rounded text-xs font-medium transition-all ${heatColor(0, maxCount)} ${isActive ? "ring-2 ring-foreground" : "hover:opacity-80"}`}
                          />
                        )}
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
              <>
              <div className="flex flex-wrap gap-2">
                {activeIds.map((uid) => {
                  const p = profileMap[uid];
                  if (!p) return null;
                  const isOpen = selectedUid === uid;
                  return (
                    <button
                      key={uid}
                      type="button"
                      onClick={() => setSelectedUid(isOpen ? null : uid)}
                      className={`flex items-center gap-2 border rounded-full pl-1 pr-2 py-1 transition-colors cursor-pointer ${
                        isOpen ? "border-foreground bg-muted" : "border-border bg-background hover:bg-muted/50"
                      }`}
                    >
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
                          {(p.display_name ?? "?").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs">{p.display_name ?? "Unnamed"}</span>
                      <ChevronDown size={12} className={`text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                  );
                })}
              </div>
              {selectedUid && (() => {
                const p = profileMap[selectedUid];
                if (!p) return null;
                const av = availability?.[selectedUid];
                return (
                  <div className="mt-3 border border-border rounded-lg p-4 bg-card animate-in fade-in slide-in-from-top-1 duration-150">
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
                        {p.alias && <div className="text-xs text-muted-foreground truncate">aka {p.alias}</div>}
                        <div className="text-xs text-muted-foreground truncate">
                          {[p.job_title, p.pronouns].filter(Boolean).join(" · ") || "—"}
                        </div>
                        {p.email && (
                          <a href={`mailto:${p.email}`} className="text-xs text-primary hover:underline truncate block mt-0.5">
                            {p.email}
                          </a>
                        )}
                      </div>
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
              })()}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
