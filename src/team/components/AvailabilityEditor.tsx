import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../lib/auth";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Eraser, Save, Pencil, Globe } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_BLOCKS = ["Morning", "Afternoon", "Evening", "Overnight"];
const VIEWER_TZ = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
  catch { return "UTC"; }
})();
const cellKey = (d: string, b: string) => `${d}|${b}`;

const BLOCK_HOUR: Record<string, number> = { Morning: 9, Afternoon: 13, Evening: 18, Overnight: 23 };
const HOUR_TO_BLOCK = (h: number): string => {
  if (h >= 5 && h < 12) return "Morning";
  if (h >= 12 && h < 17) return "Afternoon";
  if (h >= 17 && h < 22) return "Evening";
  return "Overnight";
};
const REFERENCE_SUNDAY = new Date(Date.UTC(2026, 0, 4));
function convertCell(day: string, block: string, fromTz: string, toTz: string) {
  if (fromTz === toTz) return { day, block };
  const dayIdx = DAYS.indexOf(day);
  const hour = BLOCK_HOUR[block];
  if (dayIdx < 0 || hour == null) return { day, block };
  const wallUtc = new Date(REFERENCE_SUNDAY);
  wallUtc.setUTCDate(wallUtc.getUTCDate() + dayIdx);
  wallUtc.setUTCHours(hour, 0, 0, 0);
  const offsetMin = (tz: string, instant: Date) => {
    const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const parts = dtf.formatToParts(instant).reduce<Record<string, string>>((a, p) => { if (p.type !== "literal") a[p.type] = p.value; return a; }, {});
    const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    return (asUtc - instant.getTime()) / 60000;
  };
  const fromOffset = offsetMin(fromTz, wallUtc);
  const utcInstant = new Date(wallUtc.getTime() - fromOffset * 60000);
  const dtfTo = new Intl.DateTimeFormat("en-US", { timeZone: toTz, hourCycle: "h23", weekday: "long", hour: "2-digit" });
  const partsTo = dtfTo.formatToParts(utcInstant).reduce<Record<string, string>>((a, p) => { if (p.type !== "literal") a[p.type] = p.value; return a; }, {});
  const newDay = partsTo.weekday;
  const newHour = Number(partsTo.hour);
  if (!DAYS.includes(newDay) || Number.isNaN(newHour)) return { day, block };
  return { day: newDay, block: HOUR_TO_BLOCK(newHour) };
}

export default function AvailabilityEditor({ showHeader = true }: { showHeader?: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: myAv } = useQuery({
    queryKey: ["my-availability-editor", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("team_availability").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [mySlots, setMySlots] = useState<Set<string>>(new Set());
  const [myNotes, setMyNotes] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!user) return;
    const storedTz = myAv?.timezone || VIEWER_TZ;
    const set = new Set<string>();
    if (myAv) {
      const raw: string[] = Array.isArray(myAv.slots) && myAv.slots.length
        ? (myAv.slots as string[])
        : ((myAv.days ?? []) as string[]).flatMap((d: string) =>
            ((myAv.time_blocks ?? []) as string[]).map((b: string) => cellKey(d, b)));
      raw.forEach((s: string) => {
        const [d, b] = s.split("|");
        const { day, block } = convertCell(d, b, storedTz, VIEWER_TZ);
        set.add(cellKey(day, block));
      });
    }
    setMySlots(set);
    setMyNotes(myAv?.notes ?? "");
    setDirty(false);
  }, [user, myAv]);

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

  const saveMine = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const slotsArr = Array.from(mySlots);
      const days = Array.from(new Set(slotsArr.map((s) => s.split("|")[0])));
      const blocks = Array.from(new Set(slotsArr.map((s) => s.split("|")[1])));
      const { error } = await supabase
        .from("team_availability")
        .upsert(
          { user_id: user.id, slots: slotsArr, days, time_blocks: blocks, notes: myNotes || null, timezone: VIEWER_TZ },
          { onConflict: "user_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["team-availability-all"] });
      qc.invalidateQueries({ queryKey: ["my-availability-editor"] });
      qc.invalidateQueries({ queryKey: ["my-availability"] });
      toast({ title: "Availability saved" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const clearMine = useCallback(() => { setMySlots(new Set()); setDirty(true); }, []);

  if (!user) return null;

  return (
    <div className="border border-border rounded-lg p-5 bg-card space-y-3">
      {(() => {
        const slotsArr = Array.from(mySlots);
        const daysSet = new Set(slotsArr.map((s) => s.split("|")[0]));
        const blocksSet = new Set(slotsArr.map((s) => s.split("|")[1]));
        const daysOrdered = DAYS.filter((d) => daysSet.has(d)).map((d) => d.slice(0, 3));
        const blocksOrdered = TIME_BLOCKS.filter((b) => blocksSet.has(b));
        const hasAny = slotsArr.length > 0 || (myNotes && myNotes.trim());
        return (
          <div className="border border-border rounded-md bg-muted/30 px-3 py-2 space-y-1 text-[11px]">
            <div className="uppercase tracking-wide text-muted-foreground flex items-center justify-between">
              <span>Preview {dirty && <span className="text-foreground/70 normal-case">· unsaved</span>}</span>
            </div>
            {hasAny ? (
              <>
                {daysOrdered.length > 0 && (
                  <div><span className="text-muted-foreground">Days:</span> {daysOrdered.join(", ")}</div>
                )}
                {blocksOrdered.length > 0 && (
                  <div><span className="text-muted-foreground">When:</span> {blocksOrdered.join(", ")}</div>
                )}
                {myNotes && myNotes.trim() && (
                  <div className="text-muted-foreground italic">{myNotes}</div>
                )}
              </>
            ) : (
              <div className="text-muted-foreground italic">No availability marked yet.</div>
            )}
          </div>
        );
      })()}

      <div className="flex items-end justify-between gap-4 flex-wrap">
        {showHeader && (
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Pencil size={12} /> Your availability
            </div>
            <div className="text-sm text-muted-foreground">
              Click or drag across cells to mark when you're free. Saves to the shared grid.
            </div>
            <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1 mt-1">
              <Globe size={11} /> {VIEWER_TZ}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
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
                          on ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted"
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
  );
}
