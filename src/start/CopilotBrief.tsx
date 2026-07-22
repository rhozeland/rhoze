import type { Conversation, BriefState } from "./copilotClient";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

interface Props {
  conversation: Conversation | null;
  onContinue: () => void;
}

function money(cents?: number | null) {
  if (!cents) return null;
  if (cents >= 100_000) return `$${Math.round(cents / 100_000)}k`;
  return `$${Math.round(cents / 100)}`;
}

const PATHWAY_META: Record<string, { label: string; sub: string }> = {
  subscribe: { label: "Subscribe", sub: "Ongoing monthly retainer" },
  build: { label: "Build", sub: "Scoped one-off project" },
  request: { label: "Request", sub: "48h rapid brief" },
};

export default function CopilotBrief({ conversation, onContinue }: Props) {
  const brief: BriefState = (conversation?.brief_json as BriefState) ?? {};
  const pathway = conversation?.recommended_pathway ?? brief.recommended_pathway;
  const path = pathway ? PATHWAY_META[pathway] : null;
  const readiness = Math.min(1, Math.max(0, brief.readiness ?? 0));
  const lo = money(conversation?.estimate_low_cents ?? brief.budget_low_cents);
  const hi = money(conversation?.estimate_high_cents ?? brief.budget_high_cents);
  const tLo = conversation?.timeline_weeks_low ?? brief.timeline_weeks_low;
  const tHi = conversation?.timeline_weeks_high ?? brief.timeline_weeks_high;

  const rows: { k: string; v: string | null }[] = [
    { k: "Type", v: brief.project_type ?? null },
    { k: "Summary", v: brief.summary ?? null },
    { k: "Audience", v: brief.audience ?? null },
    { k: "Deliverables", v: brief.deliverables?.length ? brief.deliverables.join(" · ") : null },
    { k: "Timeline", v: tLo ? `${tLo}${tHi && tHi !== tLo ? `-${tHi}` : ""} wk` : null },
    { k: "Estimate", v: lo ? `${lo}${hi && hi !== lo ? `-${hi}` : ""}` : null },
  ];

  return (
    <aside className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-5 md:p-6 flex flex-col gap-5 md:sticky md:top-4 h-fit">
      <div className="flex items-center justify-between">
        <div className="text-[10px] tracking-[0.2em] uppercase text-neutral-500">Live Brief</div>
        <div className="flex items-center gap-1 text-[11px] text-neutral-500">
          <Sparkles className="h-3 w-3" /> {Math.round(readiness * 100)}%
        </div>
      </div>

      <div className="h-1 rounded-full bg-neutral-100 overflow-hidden">
        <div
          className="h-full bg-neutral-900 transition-all duration-500"
          style={{ width: `${Math.round(readiness * 100)}%` }}
        />
      </div>

      <dl className="grid gap-3 text-sm">
        {rows.map((r) => (
          <div key={r.k} className="grid grid-cols-[80px_1fr] gap-3">
            <dt className="text-[11px] uppercase tracking-wider text-neutral-400 pt-0.5">{r.k}</dt>
            <dd className={r.v ? "text-neutral-900" : "text-neutral-300"}>{r.v ?? "-"}</dd>
          </div>
        ))}
      </dl>

      {brief.references?.length ? (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-neutral-400 mb-2">References</div>
          <ul className="space-y-1 text-sm text-neutral-700">
            {brief.references.slice(0, 4).map((r, i) => <li key={i} className="truncate">- {r}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="mt-auto pt-4 border-t border-neutral-100">
        {path ? (
          <div className="mb-3">
            <div className="text-[10px] tracking-[0.2em] uppercase text-neutral-500 mb-1">Recommended</div>
            <div className="text-lg font-medium text-neutral-900">{path.label}</div>
            <div className="text-xs text-neutral-500">{path.sub}</div>
          </div>
        ) : (
          <div className="mb-3 text-xs text-neutral-400">Keep chatting - a recommendation appears once we have enough context.</div>
        )}
        <Button
          onClick={onContinue}
          disabled={readiness < 0.4}
          className="w-full bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40"
        >
          Continue <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}