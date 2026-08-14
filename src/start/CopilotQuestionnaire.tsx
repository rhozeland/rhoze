// Build → Questionnaire, redesigned as a conversational co-pilot.
// Deterministic scripted flow (no AI credits) that progressively collects
// description, goals, timeline, budget and extra notes.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp, Check, Pencil } from "lucide-react";

export type CopilotAnswers = {
  desc: string;
  goals: string;
  timeline: string;
  budget: string;
  notes: string;
};

type FieldKey = keyof CopilotAnswers;

type StepDef = {
  key: FieldKey;
  ask: (label: string) => string;
  ack: string;
  placeholder: string;
  chips: (suggested: string) => string[];
  summary: string;
};

const STEPS: StepDef[] = [
  {
    key: "desc",
    ask: (label) =>
      `Hey — I'm your Rhozeland co-pilot. I already know you're looking to create ${label}. Tell me a little about what you have in mind.`,
    ack: "Got it, that gives me a picture to work from.",
    placeholder: "Tell your co-pilot about your project…",
    chips: (s) => [s],
    summary: "Project",
  },
  {
    key: "goals",
    ask: () => "What are you hoping this project actually accomplishes?",
    ack: "Noted — I'll keep that as the north star.",
    placeholder: "What does success look like?",
    chips: (s) => [s],
    summary: "Goals",
  },
  {
    key: "timeline",
    ask: () => "When are you hoping to have this completed?",
    ack: "Perfect, I'll scope the team around that.",
    placeholder: "e.g. in about a month",
    chips: () => ["1–2 weeks", "2–4 weeks", "1–2 months", "No hard deadline"],
    summary: "Timeline",
  },
  {
    key: "budget",
    ask: () => "And roughly what budget are you working with? A range is fine.",
    ack: "Thanks — that helps me right-size the build.",
    placeholder: "e.g. around $3,000 CAD",
    chips: () => ["Flexible", "Under $2,000", "$2,000–$5,000", "$5,000+"],
    summary: "Budget",
  },
  {
    key: "notes",
    ask: () =>
      "Last one: anything else I should know — references, locations, people involved, must-haves?",
    ack: "Great. I've got everything I need to put an estimate together.",
    placeholder: "Anything else, or just say 'nothing else'",
    chips: () => ["Nothing else", "I have references to share", "Not sure yet"],
    summary: "Notes",
  },
];

type Msg = { id: number; role: "copilot" | "user"; text: string };

export default function CopilotQuestionnaire({
  label,
  prefill,
  value,
  onChange,
  onBack,
  onContinue,
}: {
  label: string;
  prefill: { desc: string; goals: string };
  value: CopilotAnswers;
  onChange: (next: CopilotAnswers) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [idx, setIdx] = useState(0); // index of the question awaiting an answer
  const [draft, setDraft] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    { id: 0, role: "copilot", text: STEPS[0].ask(label.toLowerCase()) },
  ]);
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const seq = useRef(1);

  const done = idx >= STEPS.length;
  const current = done ? null : STEPS[idx];
  const suggested = current
    ? current.key === "desc"
      ? prefill.desc
      : current.key === "goals"
        ? prefill.goals
        : ""
    : "";
  const chips = current ? current.chips(suggested).filter(Boolean) : [];

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, done]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [idx, editing]);

  const push = (role: Msg["role"], text: string) =>
    setMsgs((m) => [...m, { id: seq.current++, role, text }]);

  const submit = (raw?: string) => {
    const text = (raw ?? draft).trim();
    if (!text) return;
    setDraft("");

    if (editing) {
      onChange({ ...value, [editing]: text });
      push("user", text);
      push("copilot", "Updated — I've swapped that into the brief.");
      setEditing(null);
      return;
    }
    if (!current) return;

    onChange({ ...value, [current.key]: text });
    push("user", text);

    const next = STEPS[idx + 1];
    push("copilot", next ? `${current.ack} ${next.ask(label.toLowerCase())}` : current.ack);
    setIdx(idx + 1);
  };

  const startEdit = (key: FieldKey) => {
    const step = STEPS.find((s) => s.key === key)!;
    setEditing(key);
    setDraft(value[key]);
    push("copilot", `Sure — let's revisit that. ${step.ask(label.toLowerCase())}`);
  };

  const filled = STEPS.filter((s) => value[s.key].trim());
  const placeholder = editing
    ? STEPS.find((s) => s.key === editing)!.placeholder
    : current
      ? current.placeholder
      : "Add anything else, or continue to your estimate…";

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
          Rhozeland Co-Pilot
        </div>
        <h3 className="mt-1.5 text-2xl md:text-3xl tracking-tight">Let's build your project together.</h3>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
          Tell me what you're trying to create, and I'll help shape the details.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-background overflow-hidden">
        <div
          ref={scrollRef}
          className="max-h-[46vh] min-h-[240px] overflow-y-auto px-4 py-5 md:px-6 space-y-4 scrollbar-hide"
        >
          {msgs.map((m) =>
            m.role === "copilot" ? (
              <div key={m.id} className="flex gap-3 max-w-[92%]">
                <span className="mt-0.5 w-7 h-7 shrink-0 rounded-full bg-primary/15 border border-primary/30 grid place-items-center text-[10px] tracking-wider text-foreground">
                  R
                </span>
                <p className="text-sm leading-relaxed">{m.text}</p>
              </div>
            ) : (
              <div key={m.id} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                  {m.text}
                </p>
              </div>
            ),
          )}
        </div>

        <div className="border-t border-border bg-card p-3 md:p-4 space-y-3">
          {chips.length > 0 && !editing && (
            <div className="flex flex-wrap gap-2">
              {chips.map((c) => (
                <button
                  key={c}
                  onClick={() => submit(c)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-foreground/40 hover:text-foreground transition text-left"
                >
                  {c.length > 60 ? `${c.slice(0, 58)}…` : c}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={placeholder}
              className="flex-1 resize-none bg-transparent text-sm leading-relaxed py-2.5 px-1 outline-none placeholder:text-muted-foreground max-h-32"
            />
            <Button
              size="icon"
              className="rounded-full shrink-0"
              aria-label="Send"
              disabled={!draft.trim()}
              onClick={() => submit()}
            >
              <ArrowUp className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {filled.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
            Brief so far
          </div>
          <div className="mt-2 divide-y divide-border">
            {filled.map((s) => (
              <div key={s.key} className="flex items-start gap-3 py-2.5">
                <Check className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted-foreground">{s.summary}</div>
                  <div className="text-sm break-words">{value[s.key]}</div>
                </div>
                <button
                  onClick={() => startEdit(s.key)}
                  className="text-muted-foreground hover:text-foreground transition shrink-0"
                  aria-label={`Edit ${s.summary}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Button variant="outline" onClick={onBack} className="sm:w-auto">← Back</Button>
        <Button className="flex-1" disabled={!value.desc.trim()} onClick={onContinue}>
          Continue to estimate →
        </Button>
      </div>
      {!done && value.desc.trim() && (
        <p className="text-xs text-muted-foreground text-center">
          You can continue any time — I'll use what we've covered so far.
        </p>
      )}
    </div>
  );
}
